import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import logo from "@/assets/rcm-buddy-logo.png.asset.json";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — RCM Buddy" },
      { name: "description", content: "Sign in to the RCM Buddy hospital revenue cycle console." },
      { property: "og:title", content: "Sign in — RCM Buddy" },
      { property: "og:description", content: "Sign in to the RCM Buddy hospital revenue cycle console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Please check your email and confirm it, then sign in.");
          setMode("signin");
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(
        message.toLowerCase().includes("invalid login")
          ? "That email and password combination is not recognised."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo.url} alt="RCM Buddy" className="h-14 w-14 object-contain" />
          <span className="text-sm font-semibold text-sidebar-accent-foreground">RCM Buddy</span>
        </Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-snug text-sidebar-accent-foreground">
            Every hospital, every branch, every rupee — in one operating system.
          </h2>
          <p className="mt-3 max-w-md text-[14px] text-sidebar-foreground/70">
            The first account created becomes the platform Super Admin and can set up hospital groups,
            hospitals, branches, teams and users.
          </p>
        </div>
        <p className="text-[11px] text-sidebar-foreground/45">Synthetic demo data only. No real patient information.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === "signin" ? "Use your work email address." : "Use your work email address to get started."}
          </p>

          {notice ? (
            <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-[13px] text-foreground">
              {notice}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            className="mt-4 text-[13px] text-primary hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setNotice(null);
            }}
          >
            {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
