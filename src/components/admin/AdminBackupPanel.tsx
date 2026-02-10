"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AdminBackupPanel() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flowlane-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exported.");
    } catch (error: any) {
      toast.error(error?.message ?? "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(file: File) {
    setLoading(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await api.importBackup(payload);
      toast.success("Backup imported.");
    } catch (error: any) {
      toast.error(error?.message ?? "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Backup & restore</h2>
        <p className="text-xs text-muted-foreground">
          Export all data or import a previous snapshot.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleExport} disabled={loading}>
          {loading ? "Working..." : "Export JSON"}
        </Button>
        <label className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 cursor-pointer">
          Import JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </label>
      </div>
    </Card>
  );
}
