"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor";
  avatarUrl?: string;
};

export function ProfileClient({ initialProfile }: { initialProfile?: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !data.data) return;
        setProfile(data.data);
        setName(data.data.name ?? "");
        setAvatarUrl(data.data.avatarUrl ?? "");
      })
      .catch(() => undefined);
  }, []);

  async function handleUpload(file: File) {
    const form = new FormData();
    form.append("files", file);
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.data?.length) {
      throw new Error(payload?.error ?? "Upload failed");
    }
    return payload.data[0]?.url as string;
  }

  async function persistProfile(nextName: string, nextAvatarUrl: string) {
    const response = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName.trim(), avatarUrl: nextAvatarUrl }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error ?? "Unable to update profile.");
    }
    setProfile(payload.data);
    window.dispatchEvent(new Event("vaultflow-profile-updated"));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await persistProfile(name, avatarUrl);
      toast.success("Profile updated.");
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your name and profile photo.
        </p>
      </div>

      <Card className="max-w-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border bg-muted">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                {profile?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Profile photo</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                Upload photo
              </Button>
              {avatarUrl ? (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setAvatarUrl("")}
                >
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or WEBP. We store only a URL (no raw files in DB).
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const url = await handleUpload(file);
                setAvatarUrl(url);
                await persistProfile(name || profile?.name || "User", url);
                toast.success("Photo uploaded.");
              } catch (err: any) {
                toast.error(err?.message ?? "Upload failed.");
              } finally {
                event.target.value = "";
              }
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={profile?.role ? profile.role.toUpperCase() : ""}
              disabled
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
