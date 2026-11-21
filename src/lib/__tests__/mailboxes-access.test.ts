import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readHospitalMailboxState, startHospitalMailbox } from "../mailboxes.server";

const { privilegedFrom } = vi.hoisted(() => ({ privilegedFrom: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: privilegedFrom } }));

function staffContext(hospitalVisible = true) {
  const from = (table: string) => {
    const builder = {
      select: () => builder, eq: () => builder, is: () => builder,
      maybeSingle: async () => ({ error: null, data: table === "hospitals"
        ? hospitalVisible ? { id: "hospital-a", name: "Synthetic hospital", organization_id: "org-a" } : null
        : { status: "active" } }),
    };
    return builder;
  };
  return { userId: "staff-a", supabase: { from, rpc: async () => ({ data: false, error: null }) } as unknown as SupabaseClient<Database> };
}

const config = { clients: { google_mail: undefined, microsoft_outlook: undefined }, encryptionSecret: undefined, gatewayKeyPresent: false };

describe("hospital-side mailbox administration", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not expose mailbox metadata or credentials to hospital staff", async () => {
    const state = await readHospitalMailboxState(staffContext(), "hospital-a", config);
    expect(state.canManage).toBe(false);
    expect(state.connections).toEqual([]);
    expect(privilegedFrom).not.toHaveBeenCalled();
  });
  it("refuses a non-admin connection before touching privileged storage", async () => {
    await expect(startHospitalMailbox(staffContext(), { hospitalId: "hospital-a", provider: "microsoft_outlook" }, config)).rejects.toThrow("Only this hospital's administrator");
    expect(privilegedFrom).not.toHaveBeenCalled();
  });
  it("refuses access to a hospital outside the signed-in user's scope", async () => {
    await expect(readHospitalMailboxState(staffContext(false), "hospital-b", config)).rejects.toThrow("not available to you");
    expect(privilegedFrom).not.toHaveBeenCalled();
  });
});