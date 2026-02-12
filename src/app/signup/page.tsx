"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AuthSession = {
  role?: "owner" | "editor";
  defaultLandingPage?: "today" | "dashboard";
};

function getLandingPath(session?: AuthSession | null) {
  return session?.defaultLandingPage === "dashboard" ? "/dashboard" : "/today";
}

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const inviteEmail = searchParams.get("email") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingSession, setExistingSession] = useState<AuthSession | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.data?.role) {
          setExistingSession(data.data as AuthSession);
        }
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
  }, [inviteEmail]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, inviteToken: inviteToken || undefined }),
    });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok || !payload?.success) {
      toast.error(payload?.error ?? "Unable to create account.");
      return;
    }

    const me = await fetch("/api/auth/me").then((res) => res.json()).catch(() => null);
    router.push(getLandingPath(me?.data));
  }

  return (
    <div className="relative px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.25),transparent_60%)]" />
        <div className="absolute -bottom-32 right-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_55%)]" />
      </div>
      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden flex-col justify-center gap-8 rounded-[32px] border bg-background/70 p-12 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)] lg:flex">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight">
                Launch a calmer,
                <br />
                smarter client workflow.
              </h1>
              <p className="text-sm text-muted-foreground">
                Capture leads fast, keep follow-ups tight, and run projects without
                clutter.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-muted-foreground">
              <div className="rounded-2xl border bg-muted/30 p-4">
                Built for owners, PMs, designers, and delivery teams.
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                Daily focus view keeps work moving.
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                Role-aware finance privacy baked in.
              </div>
            </div>
          </div>

          <Card className="w-full space-y-6 rounded-[32px] border bg-background/90 p-10 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)]">
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">Create your account</h1>
              <p className="text-sm text-muted-foreground">
                {inviteToken ? "You were invited to join the team." : "New accounts start as Editor by default."}
              </p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={Boolean(inviteEmail)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Sign up"}
              </Button>
            </form>
            {existingSession ? (
              <div className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
                You are already signed in.
                <Button
                  variant="ghost"
                  className="px-1 text-xs"
                  onClick={() => router.push(getLandingPath(existingSession))}
                >
                  Go to dashboard
                </Button>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Button variant="ghost" className="px-1 text-xs" onClick={() => router.push("/signin")}>
                Sign in
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
