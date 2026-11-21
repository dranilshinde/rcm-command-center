import { describe, expect, it } from "vitest";
import { assertMailboxBinding, MAILBOX_PROVIDERS, validMailboxIntent } from "../mailbox-domain";
import { decryptConnectionKey, encryptConnectionKey } from "../connectionKeyCrypto.server";

describe("hospital mailbox isolation", () => {
  it("prevents reusing a Gmail or Outlook grant for another hospital", () => {
    expect(() => assertMailboxBinding({ hospitalId: "hospital-b", userId: "admin-a" }, { hospital_id: "hospital-a" }, null)).toThrow();
  });
  it("prevents another administrator from overwriting a hospital grant", () => {
    expect(() => assertMailboxBinding({ hospitalId: "hospital-a", userId: "admin-b" }, null, { user_id: "admin-a" })).toThrow();
  });
  it("allows the authorising administrator to reconnect the same hospital", () => {
    expect(() => assertMailboxBinding({ hospitalId: "hospital-a", userId: "admin-a" }, { hospital_id: "hospital-a" }, { user_id: "admin-a" })).not.toThrow();
  });
});

describe("hospital-owned OAuth requests", () => {
  const now = Date.parse("2026-11-21T15:00:00Z");
  const target = { hospitalId: "hospital-a", userId: "admin-a", provider: "microsoft_outlook" as const };
  const intent = { hospital_id: "hospital-a", user_id: "admin-a", connector_id: "microsoft_outlook", expires_at: "2026-11-21T15:10:00Z", consumed_at: null };
  it("only accepts the signed-in administrator's own hospital request", () => {
    expect(validMailboxIntent(intent, target, now)).toBe(true);
    expect(validMailboxIntent(intent, { ...target, hospitalId: "hospital-b" }, now)).toBe(false);
    expect(validMailboxIntent(intent, { ...target, userId: "admin-b" }, now)).toBe(false);
    expect(validMailboxIntent(intent, { ...target, provider: "google_mail" }, now)).toBe(false);
  });
  it("rejects expired or already-used requests", () => {
    expect(validMailboxIntent(intent, target, Date.parse(intent.expires_at))).toBe(false);
    expect(validMailboxIntent({ ...intent, consumed_at: "2026-11-21T15:01:00Z" }, target, now)).toBe(false);
  });
});

describe("mailbox credentials", () => {
  it("stores only ciphertext and rejects tampered ciphertext", async () => {
    const secret = btoa(Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => String.fromCharCode(b)).join(""));
    const stored = await encryptConnectionKey("test-only-connection-handle", secret);
    expect(stored).not.toContain("test-only-connection-handle");
    expect(await decryptConnectionKey(stored, secret)).toBe("test-only-connection-handle");
    const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const last = bytes.length - 1;
    bytes[last] = (bytes[last] ?? 0) ^ 1;
    const tampered = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
    await expect(decryptConnectionKey(tampered, secret)).rejects.toThrow();
  });
  it("requests Gmail and Outlook read permissions, not sending or editing permissions", () => {
    expect(MAILBOX_PROVIDERS.google_mail.scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(MAILBOX_PROVIDERS.microsoft_outlook.scopes).toContain("Mail.Read");
    expect(MAILBOX_PROVIDERS.microsoft_outlook.scopes).toContain("offline_access");
    expect(MAILBOX_PROVIDERS.google_mail.scopes.some((s) => /gmail\.(send|modify|compose)/.test(s))).toBe(false);
    expect(MAILBOX_PROVIDERS.microsoft_outlook.scopes.some((s) => /Mail\.(Send|ReadWrite)/.test(s))).toBe(false);
  });
});