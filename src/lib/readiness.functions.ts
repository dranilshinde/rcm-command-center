import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadinessReport = {
  readiness_score: number;
  summary: string;
  gaps: { area: string; severity: "high" | "medium" | "low"; issue: string; why_it_matters: string }[];
  next_steps: { title: string; owner_role: string; detail: string; priority: number }[];
  generated_at: string;
};

const MODEL = "openai/gpt-6-astra";

const SYSTEM = `You are an implementation consultant for RCM Buddy, a revenue cycle management platform for Indian hospitals (cashless insurance claims, TPAs, pre-auth, AR, denials).
You receive a JSON snapshot of one hospital's platform setup plus optional notes from its administrator.
Identify configuration gaps that would block or weaken go-live, and recommend concrete, tailored next steps.
Base every finding on the snapshot or notes. Do not invent facts. If something is unknown, say it needs confirmation.
Typical go-live essentials: at least one hospital admin who has accepted the invite, RCM / cashless / billing / AR departments, teams with managers, branches for multi-site hospitals, payers and TPAs mapped with SPOCs, tariffs, SLA and escalation rules, onboarding checklist progress.
Reply with ONLY a JSON object, no markdown, in this shape:
{"readiness_score": integer 0-100, "summary": "2-3 sentences", "gaps": [{"area": "short label", "severity": "high"|"medium"|"low", "issue": "what is missing or wrong", "why_it_matters": "impact on claims or cash"}], "next_steps": [{"title": "imperative action", "owner_role": "e.g. Hospital Admin", "detail": "1-2 sentences", "priority": 1-based integer}]}
Give at most 8 gaps and at most 8 next steps, ordered by importance.`;

async function buildSnapshot(sb: any, hospitalId: string) {
  const { data: hospital } = await sb.from("hospitals")
    .select("id, name, code, city, state, bed_count, status, go_live_date, hospital_group_id, hospital_groups(name, code, headquarters_city)")
    .eq("id", hospitalId).maybeSingle();
  if (!hospital) throw new Error("This hospital is not available to you.");
  const [br, de, te, st, ur, inv, ins, tpa, sp] = await Promise.all([
    sb.from("branches").select("id, name, code, city, status").eq("hospital_id", hospitalId).is("deleted_at", null),
    sb.from("departments").select("name, code, dept_type, branch_id, status").eq("hospital_id", hospitalId).is("deleted_at", null),
    sb.from("teams").select("name, code, manager_id, branch_id, department_id, status").eq("hospital_id", hospitalId).is("deleted_at", null),
    sb.from("onboarding_steps").select("title, status").eq("hospital_id", hospitalId).order("sort_order"),
    sb.from("user_roles").select("user_id, roles(name)").eq("hospital_id", hospitalId),
    sb.from("admin_invitations").select("role_key, status, send_count, last_sent_at").eq("hospital_id", hospitalId),
    sb.from("insurers").select("id", { count: "exact", head: true }),
    sb.from("tpas").select("id", { count: "exact", head: true }),
    sb.from("tpa_spocs").select("id", { count: "exact", head: true }).eq("hospital_id", hospitalId),
  ]);
  const g = hospital.hospital_groups as { name: string; code: string; headquarters_city: string | null } | null;
  return {
    hospital: {
      name: hospital.name, code: hospital.code, city: hospital.city, state: hospital.state,
      beds: hospital.bed_count, status: hospital.status, planned_go_live: hospital.go_live_date,
    },
    group: g ? { name: g.name, code: g.code, headquarters: g.headquarters_city } : null,
    branches: (br.data ?? []).map((b: any) => ({ name: b.name, code: b.code, city: b.city, status: b.status })),
    departments: (de.data ?? []).map((d: any) => ({ name: d.name, type: d.dept_type, branch_specific: !!d.branch_id, status: d.status })),
    teams: (te.data ?? []).map((t: any) => ({ name: t.name, has_manager: !!t.manager_id, status: t.status })),
    users_with_roles: (ur.data ?? []).map((u: any) => u.roles?.name).filter(Boolean),
    admin_invitations: (inv.data ?? []).map((i: any) => ({ role: i.role_key, status: i.status, times_sent: i.send_count })),
    onboarding_checklist: (st.data ?? []).map((s: any) => ({ step: s.title, status: s.status })),
    payer_network: { insurers_on_platform: ins.count ?? 0, tpas_on_platform: tpa.count ?? 0, tpa_contacts_for_this_hospital: sp.count ?? 0 },
    not_yet_available_in_platform: ["tariffs", "SLA rules", "escalation rules", "claims"],
  };
}

function gatewayError(status: number, body: string): Error {
  let msg = "";
  try { msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? ""; } catch { /* ignore */ }
  if (status === 402) return new Error(msg || "AI credits have run out for this workspace. Add credits in Settings → Plans & credits.");
  if (status === 429) return new Error("The AI service is busy. Please try again in a minute.");
  if (status === 403) return new Error(msg || "AI access is not available for this workspace.");
  if (status === 401) return new Error("The AI service is not configured for this app.");
  return new Error("The AI service could not complete the review. Please try again.");
}

export const analyzeReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ hospitalId: z.string().uuid(), notes: z.string().max(4000) }).parse(i))
  .handler(async ({ context, data }): Promise<ReadinessReport> => {
    const snapshot = await buildSnapshot(context.supabase, data.hospitalId);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The AI service is not configured for this app.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "medium", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions: SYSTEM,
        input: [{
          role: "user",
          content: `SETUP SNAPSHOT:\n${JSON.stringify(snapshot)}\n\nADMINISTRATOR NOTES:\n${data.notes.trim() || "(none)"}`,
        }],
      }),
    });
    if (!res.ok || !res.body) throw gatewayError(res.status, await res.text().catch(() => ""));

    // Consume the SSE stream server-side and accumulate the answer text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let failed: string | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
            else if (ev.type === "response.failed" || ev.type === "error") failed = ev.response?.error?.message ?? ev.message ?? "failed";
            else if (ev.type === "response.incomplete") failed = failed ?? "incomplete";
          } catch { /* partial frame */ }
        }
      }
    }
    if (!text && failed) {
      console.error("readiness AI failed:", failed);
      throw new Error("The AI review could not be completed. Please try again.");
    }

    const match = text.match(/\{[\s\S]*\}/);
    let parsed: any;
    try { parsed = JSON.parse(match?.[0] ?? ""); } catch {
      console.error("readiness AI returned non-JSON:", text.slice(0, 500));
      throw new Error("The AI review came back in an unexpected format. Please try again.");
    }
    const sev = (s: unknown) => (s === "high" || s === "medium" || s === "low" ? s : "medium");
    return {
      readiness_score: Math.max(0, Math.min(100, Math.round(Number(parsed.readiness_score) || 0))),
      summary: String(parsed.summary ?? ""),
      gaps: (Array.isArray(parsed.gaps) ? parsed.gaps : []).slice(0, 8).map((g: any) => ({
        area: String(g.area ?? ""), severity: sev(g.severity), issue: String(g.issue ?? ""), why_it_matters: String(g.why_it_matters ?? ""),
      })),
      next_steps: (Array.isArray(parsed.next_steps) ? parsed.next_steps : []).slice(0, 8).map((s: any, i: number) => ({
        title: String(s.title ?? ""), owner_role: String(s.owner_role ?? ""), detail: String(s.detail ?? ""), priority: Number(s.priority) || i + 1,
      })).sort((a: any, b: any) => a.priority - b.priority),
      generated_at: new Date().toISOString(),
    };
  });
