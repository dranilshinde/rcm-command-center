import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { assertMailboxBinding, MAILBOX_PROVIDERS, validMailboxIntent, type MailboxProvider } from "./mailbox-domain";
import { decryptConnectionKey, encryptConnectionKey, hashMailboxNonce } from "./connectionKeyCrypto.server";
import { appUserReconnectRequired, authorizeAppUserOAuth, callAsAppUser, disconnectAppUser, exchangeAppUserOAuthCode } from "@/integrations/lovable/appUserConnector";

type Context = { supabase: SupabaseClient<Database>; userId: string };
type Configuration = { clients: Record<MailboxProvider, string | undefined>; encryptionSecret: string | undefined; gatewayKeyPresent: boolean };
const GATEWAY = "https://connector-gateway.lovable.dev";

// Only imported dynamically by authenticated server handlers; never client code.
export function mailboxConfiguration(): Configuration {
  return {
    clients: { google_mail: process.env["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"], microsoft_outlook: process.env["MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY"] },
    encryptionSecret: process.env["APP_USER_CONNECTION_KEY_SECRET"], gatewayKeyPresent: !!process.env["LOVABLE_API_KEY"],
  };
}

async function hospitalAccess(context: Context, hospitalId: string) {
  const [{ data: hospital, error }, { data: admin, error: roleError }, { data: profile }] = await Promise.all([
    context.supabase.from("hospitals").select("id, name, organization_id").eq("id", hospitalId).is("deleted_at", null).maybeSingle(),
    context.supabase.rpc("is_hospital_admin", { _user_id: context.userId, _hospital_id: hospitalId }),
    context.supabase.from("profiles").select("status").eq("id", context.userId).maybeSingle(),
  ]);
  if (error || !hospital) throw new Error("This hospital is not available to you.");
  if (roleError) throw new Error("We could not verify your hospital access.");
  return { hospital, canManage: admin === true && profile?.status === "active" };
}

async function requireHospitalAdmin(context: Context, hospitalId: string) {
  const access = await hospitalAccess(context, hospitalId);
  if (!access.canManage) throw new Error("Only this hospital's administrator can manage its mailbox connections.");
  return access.hospital;
}

function requireConfiguration(config: Configuration, provider: MailboxProvider) {
  const clientKey = config.clients[provider];
  if (!clientKey || !config.encryptionSecret || !config.gatewayKeyPresent) {
    throw new Error("RCM Buddy must activate this email provider first. Your hospital does not need to supply API keys or mailbox passwords.");
  }
  return { clientKey, encryptionSecret: config.encryptionSecret };
}

export async function readHospitalMailboxState(context: Context, hospitalId: string, config: Configuration) {
  const { canManage } = await hospitalAccess(context, hospitalId);
  const configured = {
    google_mail: !!(config.clients.google_mail && config.encryptionSecret && config.gatewayKeyPresent),
    microsoft_outlook: !!(config.clients.microsoft_outlook && config.encryptionSecret && config.gatewayKeyPresent),
  };
  if (!canManage) return { canManage, configured, connections: [] as { id: string; provider: string; email: string; status: string; verifiedAt: string | null; canReconnect: boolean }[] };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("app_user_connections")
    .select("id, connector_id, email_address, status, verified_at, user_id").eq("hospital_id", hospitalId);
  if (error) throw new Error("We could not load this hospital's mailbox connections.");
  return { canManage, configured, connections: (data ?? []).map((r) => ({
    id: r.id, provider: r.connector_id, email: r.email_address, status: r.status,
    verifiedAt: r.verified_at, canReconnect: r.user_id === context.userId,
  })) };
}

async function checkBinding(context: Context, hospitalId: string, provider: MailboxProvider) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [userGrant, hospitalGrant] = await Promise.all([
    supabaseAdmin.from("app_user_connections").select("hospital_id").eq("user_id", context.userId).eq("connector_id", provider).maybeSingle(),
    supabaseAdmin.from("app_user_connections").select("user_id").eq("hospital_id", hospitalId).eq("connector_id", provider).maybeSingle(),
  ]);
  if (userGrant.error || hospitalGrant.error) throw new Error("We could not check the existing mailbox connection.");
  assertMailboxBinding({ hospitalId, userId: context.userId }, userGrant.data, hospitalGrant.data);
}

export async function startHospitalMailbox(context: Context, input: { hospitalId: string; provider: MailboxProvider }, config: Configuration) {
  await requireHospitalAdmin(context, input.hospitalId);
  const { clientKey } = requireConfiguration(config, input.provider);
  await checkBinding(context, input.hospitalId, input.provider);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  const nonceHash = await hashMailboxNonce(nonce);
  const request = getRequest();
  const url = new URL(request.url);
  const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  const returnUrl = new URL("/api/public/mailbox-return", sandboxHost ? `https://${sandboxHost}` : url.origin);
  returnUrl.searchParams.set("nonce", nonce);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Bounded cleanup piggybacks on user action; no new polling/scheduled job.
  await supabaseAdmin.from("mailbox_oauth_intents").delete().eq("user_id", context.userId).lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin.from("mailbox_oauth_intents").insert({
    nonce_hash: nonceHash, hospital_id: input.hospitalId, user_id: context.userId,
    connector_id: input.provider, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error("We could not start a secure mailbox connection.");
  const result = await authorizeAppUserOAuth({
    gatewayBaseUrl: GATEWAY, connectorId: input.provider, appUserId: context.userId,
    clientAPIKey: clientKey, returnUrl: returnUrl.toString(),
    credentialsConfiguration: {
      scopes: MAILBOX_PROVIDERS[input.provider].scopes,
      ...(input.provider === "microsoft_outlook" ? { domain_hint: "none", prompt: "select_account" } : {}),
    },
  });
  return { authorizationUrl: result.authorizationUrl, nonce };
}

async function providerIdentity(provider: MailboxProvider, credential: string): Promise<{ reconnect: true } | { reconnect: false; email: string }> {
  const call = (path: string) => callAsAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: credential, connectorId: provider, path, requiredScopes: MAILBOX_PROVIDERS[provider].scopes });
  const response = await call(provider === "google_mail" ? "/gmail/v1/users/me/profile" : "/me?$select=mail,userPrincipalName");
  if (await appUserReconnectRequired(response)) return { reconnect: true };
  if (!response.ok) return providerFailure(response);
  const payload: unknown = await response.json();
  let email: string;
  if (provider === "google_mail") {
    email = z.object({ emailAddress: z.string().email().max(320) }).parse(payload).emailAddress;
  } else {
    const profile = z.object({ mail: z.string().nullable().optional(), userPrincipalName: z.string().optional() }).parse(payload);
    email = z.string().email().max(320).parse(profile.mail || profile.userPrincipalName);
    const probe = await call("/me/mailFolders/inbox?$select=id");
    if (await appUserReconnectRequired(probe)) return { reconnect: true };
    if (!probe.ok) return providerFailure(probe);
  }
  return { reconnect: false, email };
}

async function providerFailure(response: Response): Promise<never> {
  const text = await response.text();
  console.error(`Mailbox verification failed [${response.status}]: ${text}`);
  throw new Error(`Mailbox verification failed [${response.status}]: ${text}`);
}

export async function completeHospitalMailbox(context: Context, input: { hospitalId: string; provider: MailboxProvider; nonce: string; code: string }, config: Configuration) {
  await requireHospitalAdmin(context, input.hospitalId);
  const { encryptionSecret } = requireConfiguration(config, input.provider);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nonceHash = await hashMailboxNonce(input.nonce);
  const { data: intent, error } = await supabaseAdmin.from("mailbox_oauth_intents").select("*").eq("nonce_hash", nonceHash).maybeSingle();
  if (error || !validMailboxIntent(intent, { ...input, userId: context.userId }, Date.now())) throw new Error("This connection request expired or belongs to a different hospital. Please connect again.");
  await checkBinding(context, input.hospitalId, input.provider);
  const { data: consumed, error: consumeError } = await supabaseAdmin.from("mailbox_oauth_intents")
    .update({ consumed_at: new Date().toISOString() }).eq("nonce_hash", nonceHash).eq("user_id", context.userId)
    .is("consumed_at", null).gt("expires_at", new Date().toISOString()).select("nonce_hash").maybeSingle();
  if (consumeError || !consumed) throw new Error("This connection request has already been used. Please connect again.");
  const exchange = await exchangeAppUserOAuthCode(GATEWAY, input.code);
  if (exchange.connectorId !== input.provider) throw new Error("The provider did not match your connection request.");
  const identity = await providerIdentity(input.provider, exchange.connectionAPIKey);
  if (identity.reconnect) throw new Error("The mailbox permission needs to be renewed. Please connect again.");
  const ciphertext = await encryptConnectionKey(exchange.connectionAPIKey, encryptionSecret);
  const { error: saveError } = await supabaseAdmin.from("app_user_connections").upsert({
    hospital_id: input.hospitalId, user_id: context.userId, connector_id: input.provider,
    connection_key_ciphertext: ciphertext, email_address: identity.email, status: "connected",
    verified_at: new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: context.userId,
  }, { onConflict: "hospital_id,connector_id" });
  if (saveError) throw new Error("The mailbox was authorised but could not be saved. Please reconnect; no emails were processed.");
  return { ok: true, email: identity.email };
}

export async function verifyHospitalMailbox(context: Context, input: { hospitalId: string; provider: MailboxProvider }, config: Configuration) {
  await requireHospitalAdmin(context, input.hospitalId);
  const { encryptionSecret } = requireConfiguration(config, input.provider);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("app_user_connections").select("*")
    .eq("hospital_id", input.hospitalId).eq("connector_id", input.provider).maybeSingle();
  if (error || !row) throw new Error("This hospital has no connected mailbox for this provider.");
  // A grant must not remain usable after its authorising administrator loses access.
  const [{ data: ownerAdmin }, { data: ownerProfile }] = await Promise.all([
    context.supabase.rpc("is_hospital_admin", { _user_id: row.user_id, _hospital_id: input.hospitalId }),
    context.supabase.from("profiles").select("status").eq("id", row.user_id).maybeSingle(),
  ]);
  const identity = ownerAdmin === true && ownerProfile?.status === "active"
    ? await providerIdentity(input.provider, await decryptConnectionKey(row.connection_key_ciphertext, encryptionSecret))
    : { reconnect: true as const };
  const { error: updateError } = await supabaseAdmin.from("app_user_connections").update({
    status: identity.reconnect ? "reconnect_required" : "connected", updated_by: context.userId,
    updated_at: new Date().toISOString(), ...(!identity.reconnect ? { verified_at: new Date().toISOString(), email_address: identity.email } : {}),
  }).eq("id", row.id).eq("hospital_id", input.hospitalId);
  if (updateError) throw new Error("We could not save the mailbox verification result.");
  return { ok: !identity.reconnect, reconnectRequired: identity.reconnect };
}

export async function disconnectHospitalMailbox(context: Context, input: { hospitalId: string; provider: MailboxProvider }, config: Configuration) {
  await requireHospitalAdmin(context, input.hospitalId);
  const { encryptionSecret } = requireConfiguration(config, input.provider);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("app_user_connections").select("id, connection_key_ciphertext")
    .eq("hospital_id", input.hospitalId).eq("connector_id", input.provider).maybeSingle();
  if (error || !row) throw new Error("This hospital has no connected mailbox for this provider.");
  await disconnectAppUser({ gatewayBaseUrl: GATEWAY, connectorId: input.provider, connectionAPIKey: await decryptConnectionKey(row.connection_key_ciphertext, encryptionSecret) });
  const { error: removeError } = await supabaseAdmin.from("app_user_connections").delete().eq("id", row.id).eq("hospital_id", input.hospitalId);
  if (removeError) throw new Error("Provider access was revoked, but the saved connection could not be removed. Try disconnecting again.");
  return { ok: true };
}