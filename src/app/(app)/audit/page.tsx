import { apiFetch } from "@/lib/apiClient";
import { AuditLogTable, type AuditEvent } from "@/components/audit/AuditLogTable";

async function getAudit() {
  try {
    const data = await apiFetch<{ success: boolean; data: AuditEvent[] }>(`/api/audit`);
    return data.data ?? [];
  } catch {
    return [];
  }
}

export default async function AuditPage() {
  const items = await getAudit();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Owner-only history of sensitive actions across Flowlane.
        </p>
      </div>
      <AuditLogTable items={items} />
    </div>
  );
}
