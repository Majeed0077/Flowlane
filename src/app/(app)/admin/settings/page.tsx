import { apiFetch } from "@/lib/apiClient";
import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import type { AdminSettings } from "@/types";

async function getSettings() {
  try {
    const data = await apiFetch<{ success: boolean; data: AdminSettings }>(`/api/admin/settings`);
    return data.data ?? { orgName: "Flowlane", timezone: "UTC", logoUrl: "" };
  } catch {
    return { orgName: "Flowlane", timezone: "UTC", logoUrl: "" };
  }
}

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Owner-only workspace configuration.
        </p>
      </div>
      <AdminSettingsForm initial={settings} />
    </div>
  );
}
