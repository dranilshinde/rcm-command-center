// Server-only helpers for inviting hospital admins. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type InviteArgs = {
  organizationId: string;
  hospitalId: string;
  email: string;
  fullName: string;
  roleKey: string;
  invitedBy: string;
  redirectTo: string;
};

/** Invites (or re-uses) a user, grants hospital role + scope, and records the invitation. */
export async function inviteHospitalAdmin(a: InviteArgs): Promise<{ ok: true } | { ok: false; reason: string }> {
  const email = a.email.trim().toLowerCase();
  const { data: role } = await supabaseAdmin.from("roles").select("id").eq("key", a.roleKey).maybeSingle();
  if (!role) return { ok: false, reason: `${email}: unknown role.` };

  let userId: string | null = null;
  let invited = false;
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) {
    userId = existing.id;
  } else {
    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: a.fullName },
      redirectTo: a.redirectTo,
    });
    if (error || !inv.user) return { ok: false, reason: `${email}: invitation could not be sent.` };
    userId = inv.user.id;
    invited = true;
    await supabaseAdmin.rpc("bootstrap_user", { _user_id: userId, _email: email, _full_name: a.fullName });
  }

  await supabaseAdmin.from("profiles").update({ organization_id: a.organizationId }).eq("id", userId).is("organization_id", null);
  const { error: re } = await supabaseAdmin.from("user_roles").insert({
    user_id: userId, role_id: role.id, organization_id: a.organizationId, hospital_id: a.hospitalId, created_by: a.invitedBy,
  });
  const { error: se } = await supabaseAdmin.from("user_scopes").insert({
    user_id: userId, scope_type: "hospital", organization_id: a.organizationId, hospital_id: a.hospitalId, created_by: a.invitedBy,
  });
  if ((re && !re.message.includes("duplicate")) || (se && !se.message.includes("duplicate"))) {
    return { ok: false, reason: `${email}: access could not be granted.` };
  }

  await supabaseAdmin.from("admin_invitations").insert({
    organization_id: a.organizationId,
    hospital_id: a.hospitalId,
    user_id: userId,
    email,
    full_name: a.fullName,
    role_key: a.roleKey,
    status: invited ? "pending" : "accepted",
    accepted_at: invited ? null : new Date().toISOString(),
    invited_by: a.invitedBy,
  });
  return { ok: true };
}
