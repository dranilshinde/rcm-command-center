import { useEffect, useRef, useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, ShieldCheck, Link2, Unplug, RefreshCw, LockKeyhole, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { hospitalMailboxesQuery } from "@/lib/mailbox-queries";
import { MAILBOX_PROVIDERS, mailboxProvider, type MailboxProvider } from "@/lib/mailbox-domain";
import { startMailboxConnection, completeMailboxConnection, verifyMailboxConnection, disconnectMailboxConnection } from "@/lib/mailboxes.functions";

const completionMessage = z.object({
  type: z.enum(["mailboxOAuthComplete", "mailboxOAuthFailed"]),
  provider: mailboxProvider, nonce: z.string(), code: z.string().nullable(), error: z.string().nullable(),
});

function awaitConsent(popup: Window, provider: MailboxProvider, nonce: string) {
  let cancel = () => {};
  const promise = new Promise<string>((resolve, reject) => {
    let poll: number | undefined;
    let timeout: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
    cancel = () => { cleanup(); popup.close(); reject(new Error("Mailbox connection cancelled.")); };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      const parsed = completionMessage.safeParse(event.data);
      if (!parsed.success || parsed.data.provider !== provider || parsed.data.nonce !== nonce) return;
      cleanup();
      if (parsed.data.type === "mailboxOAuthComplete" && parsed.data.code) resolve(parsed.data.code);
      else reject(new Error(parsed.data.error ?? "The email provider did not complete the connection."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("Mailbox connection was closed before completion.")); } }, 500);
    timeout = window.setTimeout(() => { cleanup(); popup.close(); reject(new Error("Mailbox connection timed out. Please try again.")); }, 10 * 60_000);
  });
  return { promise, cancel };
}

export function HospitalMailboxes({ hospitalId, hospitalName }: { hospitalId: string; hospitalName: string }) {
  const { data } = useSuspenseQuery(hospitalMailboxesQuery(hospitalId));
  const qc = useQueryClient();
  const start = useServerFn(startMailboxConnection);
  const complete = useServerFn(completeMailboxConnection);
  const verify = useServerFn(verifyMailboxConnection);
  const disconnect = useServerFn(disconnectMailboxConnection);
  const [busy, setBusy] = useState<MailboxProvider | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const cancelConsent = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelConsent.current?.(); }, [hospitalId]);

  async function connect(provider: MailboxProvider) {
    const popup = window.open("", "rcm-mailbox-consent", "width=600,height=720");
    if (!popup) { toast.error("Allow popups to connect your hospital mailbox."); return; }
    setBusy(provider); setConfirmation(null);
    try {
      const authorization = await start({ data: { hospitalId, provider } });
      const consent = awaitConsent(popup, provider, authorization.nonce);
      cancelConsent.current = consent.cancel;
      popup.location.href = authorization.authorizationUrl;
      const code = await consent.promise;
      const result = await complete({ data: { hospitalId, provider, nonce: authorization.nonce, code } });
      await qc.invalidateQueries({ queryKey: ["hospital-mailboxes", hospitalId] });
      const message = `Connected ${result.email} to ${hospitalName}.`;
      setConfirmation(message); toast.success(message);
    } catch (error) {
      popup.close(); toast.error(error instanceof Error ? error.message : "We could not connect the mailbox.");
    } finally { cancelConsent.current = null; setBusy(null); }
  }

  async function run(provider: MailboxProvider, action: "verify" | "disconnect") {
    setBusy(provider); setConfirmation(null);
    try {
      if (action === "verify") {
        const result = await verify({ data: { hospitalId, provider } });
        if (result.reconnectRequired) toast.error("Mailbox access needs to be renewed. Reconnect the authorising administrator's account.");
        else { setConfirmation("Mailbox access verified."); toast.success("Mailbox access verified."); }
      } else {
        await disconnect({ data: { hospitalId, provider } });
        setConfirmation("Mailbox disconnected."); toast.success("Mailbox disconnected.");
      }
      await qc.invalidateQueries({ queryKey: ["hospital-mailboxes", hospitalId] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "We could not update the mailbox connection."); }
    finally { setBusy(null); }
  }

  if (!data.canManage) return <div className="flex items-center gap-3 border-y border-border py-6 text-sm text-muted-foreground"><LockKeyhole className="size-5 shrink-0" />Only this hospital's administrator can manage mailbox connections.</div>;
  const pending = !data.configured.google_mail && !data.configured.microsoft_outlook;
  return <section aria-label="Hospital email connections" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div><h2 className="text-base font-semibold">Connect your hospital email</h2><p className="mt-1 text-sm text-muted-foreground">Takes about a minute · {hospitalName}</p></div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-positive" />Hospital-only access</div>
    </div>
    <ol aria-label="How to connect" className="grid gap-3 sm:grid-cols-3">
      {[
        ["1", "Pick your email", "Choose Outlook or Gmail — whichever your TPA desk uses."],
        ["2", "Sign in once", "A small window opens. Sign in with your hospital email and press Allow."],
        ["3", "You're done", "You'll see “Connected” here. No passwords are stored or shown."],
      ].map(([n, title, body]) => <li key={n} className="flex gap-3 rounded-lg border border-border bg-card p-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{body}</p></div></li>)}
    </ol>
    {pending ? <div role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm"><p className="font-medium">Almost ready</p><p className="mt-1 text-muted-foreground">The Connect buttons will switch on once RCM Buddy finishes its one-time email setup. Nothing for you to do yet — no mailbox is connected or being read.</p></div> : null}
    {confirmation ? <p role="status" className="flex items-center gap-2 text-sm text-positive"><ShieldCheck className="size-4" />{confirmation}</p> : null}
    <div className="grid gap-4 lg:grid-cols-2">
      {(["microsoft_outlook", "google_mail"] as const).map((provider) => {
        const connection = data.connections.find((c) => c.provider === provider);
        const ready = data.configured[provider];
        const working = busy === provider;
        const reconnect = connection?.status === "reconnect_required";
        return <article key={provider} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><Mail className="size-5 text-primary" /><h3 className="font-semibold">{MAILBOX_PROVIDERS[provider].label}</h3></div><Badge variant="outline" className={reconnect ? "border-warning text-warning-foreground" : "text-muted-foreground"}>{reconnect ? "Reconnect required" : connection ? "Connected" : "Not connected"}</Badge></div>
          <div className="my-5 min-h-16 text-sm"><p className="break-all font-medium">{connection?.email ?? "No hospital mailbox connected"}</p><p className="mt-2 text-xs text-muted-foreground">{connection?.verifiedAt ? `Verified ${new Date(connection.verifiedAt).toLocaleString("en-IN")}` : ready ? "Ready — press Connect and sign in" : "Will be available soon"}</p></div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {(!connection || connection.canReconnect) ? <Button size="sm" onClick={() => void connect(provider)} disabled={!ready || busy !== null}>{working ? <LoaderCircle className="animate-spin" /> : <Link2 />}{connection ? "Reconnect" : `Connect ${provider === "google_mail" ? "Gmail" : "Outlook"}`}</Button> : <span className="text-xs text-muted-foreground">The authorising administrator must reconnect this mailbox.</span>}
            {connection ? <><Button variant="outline" size="sm" onClick={() => void run(provider, "verify")} disabled={!ready || busy !== null}><RefreshCw />Verify access</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={!ready || busy !== null}><Unplug />Disconnect</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disconnect this hospital mailbox?</AlertDialogTitle><AlertDialogDescription>RCM Buddy will revoke its connection to {connection.email}. Claims and existing records will not be changed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep connected</AlertDialogCancel><AlertDialogAction onClick={() => void run(provider, "disconnect")}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></> : null}
          </div>
        </article>;
      })}
    </div>
    <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><span>Mailbox passwords and connection keys are not shown or shared.</span><span>Email reading &amp; claim updates · Later phase</span></div>
  </section>;
}