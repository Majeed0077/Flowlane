"use client";

import * as React from "react";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingRole, setExistingRole] = useState<"owner" | "editor" | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.data?.role) {
          setExistingRole(data.data.role);
        }
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok || !payload?.success) {
      toast.error(payload?.error ?? "Invalid email or password.");
      return;
    }

    const me = await fetch("/api/auth/me").then((res) => res.json()).catch(() => null);
    const role = me?.data?.role;
    if (role === "owner") router.push("/owner");
    else router.push("/editor");
  }

  return (
    <div className="relative px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.25),transparent_60%)]" />
        <div className="absolute -bottom-32 left-10 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_55%)]" />
      </div>
      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden flex-col justify-center gap-8 rounded-[32px] border bg-background/70 p-12 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)] lg:flex">
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold leading-tight">
                A calmer CRM for
                <br />
                agency operations.
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Today-first tasks, clean pipeline handoffs, and shared context for
                every client—without the noise.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-muted-foreground">
              <div className="rounded-2xl border bg-muted/30 p-4">
                Focused daily workflow keeps the team aligned.
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                Owner-only finance stays private by design.
              </div>
              <div className="rounded-2xl border bg-muted/30 p-4">
                Conversations and actions live together.
              </div>
            </div>
          </div>

          <Card className="w-full space-y-6 rounded-[32px] border bg-background/90 p-10 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                  Sign in
                </p>
                <h2 className="text-2xl font-semibold">Welcome back</h2>
                <p className="text-sm text-muted-foreground">
                  Use your VaultFlow account to continue.
                </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
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
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            {existingRole ? (
              <div className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
                You are already signed in.
                <Button
                  variant="ghost"
                  className="px-1 text-xs"
                  onClick={() => router.push(existingRole === "owner" ? "/owner" : "/editor")}
                >
                  Go to dashboard
                </Button>
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              New here?{" "}
              <Button variant="ghost" className="px-1 text-xs" onClick={() => router.push("/signup")}>
                Create an account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
