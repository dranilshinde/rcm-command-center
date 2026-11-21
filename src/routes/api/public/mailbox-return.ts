import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public consent return: no data access, no credential exchange, and no writes.
// The signed-in opener alone exchanges the one-time code in a server function.
export const Route = createFileRoute("/api/public/mailbox-return")({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    const parsed = z.object({
      connector_id: z.enum(["google_mail", "microsoft_outlook"]),
      nonce: z.string().regex(/^[a-f0-9]{64}$/),
      success: z.enum(["true", "false"]).optional(),
      code: z.string().min(1).max(2048).optional(),
      offline_access_allowed: z.enum(["true", "false"]).optional(),
    }).safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return new Response("Invalid mailbox connection response.", { status: 400, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    const { connector_id: provider, nonce, success, code, offline_access_allowed: offline } = parsed.data;
    const completed = success === "true" && !!code && offline !== "false";
    const result = { type: completed ? "mailboxOAuthComplete" : "mailboxOAuthFailed", provider, nonce, code: completed ? code : null,
      error: completed ? null : offline === "false" ? "RCM Buddy must enable background mailbox permission before this connection can work." : "Mailbox authorisation was cancelled or did not complete." };
    const safeJson = JSON.stringify(result).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
    const scriptNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Mailbox connection — RCM Buddy</title></head><body><p>${completed ? "Finishing your hospital mailbox connection…" : "Mailbox connection did not complete. Return to RCM Buddy."}</p><script nonce="${scriptNonce}">history.replaceState(null, "", location.pathname); if (window.opener && window.opener !== window) { window.opener.postMessage(${safeJson}, window.location.origin); window.close(); }</script></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${scriptNonce}'; base-uri 'none'; frame-ancestors 'none'` },
    });
  } } },
});