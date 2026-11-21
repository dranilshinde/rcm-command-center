import { z } from "zod";

export const mailboxProvider = z.enum(["google_mail", "microsoft_outlook"]);
export type MailboxProvider = z.infer<typeof mailboxProvider>;
export const mailboxInput = z.object({ hospitalId: z.string().uuid(), provider: mailboxProvider });
export const mailboxCompletionInput = mailboxInput.extend({
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  code: z.string().min(1).max(2048),
});

export const MAILBOX_PROVIDERS = {
  google_mail: { label: "Gmail", scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/gmail.readonly"] },
  microsoft_outlook: { label: "Microsoft Outlook", scopes: ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Read"] },
} satisfies Record<MailboxProvider, { label: string; scopes: string[] }>;

// Gateway grants are keyed by the authorising user and provider. A new grant
// cannot be reused for a different hospital, even when that user manages both.
export function assertMailboxBinding(
  target: { hospitalId: string; userId: string },
  userGrant: { hospital_id: string } | null,
  hospitalGrant: { user_id: string } | null,
) {
  if (userGrant && userGrant.hospital_id !== target.hospitalId) {
    throw new Error("Your account already connected this provider for another hospital. A different hospital administrator must authorise this mailbox.");
  }
  if (hospitalGrant && hospitalGrant.user_id !== target.userId) {
    throw new Error("Ask the administrator who connected this mailbox to reconnect it, or disconnect it before connecting a replacement.");
  }
}

export function validMailboxIntent(
  intent: { hospital_id: string; user_id: string; connector_id: string; expires_at: string; consumed_at: string | null } | null,
  target: { hospitalId: string; userId: string; provider: MailboxProvider },
  now: number,
) {
  return !!intent && intent.hospital_id === target.hospitalId && intent.user_id === target.userId
    && intent.connector_id === target.provider && intent.consumed_at === null
    && Date.parse(intent.expires_at) > now;
}