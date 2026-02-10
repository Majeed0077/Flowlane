"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSettings } from "@/types";

const timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Karachi", "Asia/Dubai"];

export function AdminSettingsForm({ initial }: { initial: AdminSettings }) {
  const [settings, setSettings] = useState<AdminSettings>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setSettings(initial), [initial]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      toast.success("Settings saved.");
    } catch (error: any) {
      toast.error(error?.message ?? "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Organization settings</h2>
        <p className="text-xs text-muted-foreground">
          Keep your workspace details consistent across the app.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Organization name</label>
          <Input
            value={settings.orgName ?? ""}
            onChange={(event) => setSettings((prev) => ({ ...prev, orgName: event.target.value }))}
            placeholder="Flowlane"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Timezone</label>
          <Select
            value={settings.timezone ?? "UTC"}
            onValueChange={(value) => setSettings((prev) => ({ ...prev, timezone: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Logo URL (optional)</label>
        <Input
          value={settings.logoUrl ?? ""}
          onChange={(event) => setSettings((prev) => ({ ...prev, logoUrl: event.target.value }))}
          placeholder="https://..."
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}
