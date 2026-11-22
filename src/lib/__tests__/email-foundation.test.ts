import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// Live, read-only database checks. Behavioural fixture tests are in the adjacent
// email-foundation.integration.sql and roll back all synthetic data.
type AccessState = {
  anonymous_read: boolean;
  staff_source_write: boolean;
  staff_review: boolean;
  staff_rewrite_proposal: boolean;
  attachments_public: boolean;
  anonymous_review_access: boolean;
};

let state: AccessState | undefined;
beforeAll(() => {
  const query = `SELECT
    EXISTS (SELECT 1 FROM unnest(ARRAY['inbound_emails','email_claim_matches','email_parsed_events','inbound_email_attachments']) t WHERE has_table_privilege('anon','public.'||t,'SELECT')) AS anonymous_read,
    EXISTS (SELECT 1 FROM unnest(ARRAY['inbound_emails','email_claim_matches','email_parsed_events','inbound_email_attachments']) t WHERE has_table_privilege('authenticated','public.'||t,'INSERT') OR has_table_privilege('authenticated','public.'||t,'DELETE')) AS staff_source_write,
    has_column_privilege('authenticated','public.email_parsed_events','review_status','UPDATE') AS staff_review,
    has_column_privilege('authenticated','public.email_parsed_events','proposed_changes','UPDATE') AS staff_rewrite_proposal,
    (SELECT public FROM storage.buckets WHERE id='inbound-email-attachments') AS attachments_public,
    has_function_privilege('anon','public.email_queue_access(uuid,text)','EXECUTE') AS anonymous_review_access`;
  const result = JSON.parse(execFileSync("lovable", ["supabase", "query", query, "--json"], { encoding: "utf8", timeout: 45_000 })) as { rows: AccessState[] };
  state = result.rows[0];
  if (!state) throw new Error("Email foundation database checks returned no result");
}, 60_000);

describe("email foundation access rules in the database", () => {
  it("gives anonymous visitors no email read privileges", () => {
    expect(state?.anonymous_read).toBe(false);
  });
  it("reserves message, match and attachment insertion or deletion for secure intake", () => {
    expect(state?.staff_source_write).toBe(false);
  });
  it("allows staff review decisions without allowing proposal rewrites", () => {
    expect(state?.staff_review).toBe(true);
    expect(state?.staff_rewrite_proposal).toBe(false);
  });
  it("keeps email attachments private", () => {
    expect(state?.attachments_public).toBe(false);
  });
  it("does not allow anonymous callers to execute review access checks", () => {
    expect(state?.anonymous_review_access).toBe(false);
  });
});