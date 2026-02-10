"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);

    const payload = await response.json().catch(() => null);
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md space-y-6 p-8">
        <div>
          <p className="text-sm text-muted-foreground">Flowlane</p>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access the internal CRM.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          Use your assigned credentials.
        </div>
      </Card>
    </div>
  );
}
