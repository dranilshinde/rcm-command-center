import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mailboxCompletionInput, mailboxInput } from "./mailbox-domain";

export const getHospitalMailboxes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ hospitalId: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { readHospitalMailboxState, mailboxConfiguration } = await import("./mailboxes.server");
    return readHospitalMailboxState(context, data.hospitalId, mailboxConfiguration());
  });

export const startMailboxConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => mailboxInput.parse(i))
  .handler(async ({ context, data }) => {
    const { startHospitalMailbox, mailboxConfiguration } = await import("./mailboxes.server");
    return startHospitalMailbox(context, data, mailboxConfiguration());
  });

export const completeMailboxConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => mailboxCompletionInput.parse(i))
  .handler(async ({ context, data }) => {
    const { completeHospitalMailbox, mailboxConfiguration } = await import("./mailboxes.server");
    return completeHospitalMailbox(context, data, mailboxConfiguration());
  });

export const verifyMailboxConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => mailboxInput.parse(i))
  .handler(async ({ context, data }) => {
    const { verifyHospitalMailbox, mailboxConfiguration } = await import("./mailboxes.server");
    return verifyHospitalMailbox(context, data, mailboxConfiguration());
  });

export const disconnectMailboxConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => mailboxInput.parse(i))
  .handler(async ({ context, data }) => {
    const { disconnectHospitalMailbox, mailboxConfiguration } = await import("./mailboxes.server");
    return disconnectHospitalMailbox(context, data, mailboxConfiguration());
  });