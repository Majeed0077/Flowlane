"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { addDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateShort, isOverdue } from "@/lib/format";
import { Bell, CalendarClock, CheckCircle2, FileText, FolderKanban, MoveRight } from "lucide-react";
import { DisableIfNoPermission } from "@/components/common/PermissionGate";
import { useActivity } from "@/lib/activityStore";

export type FocusItem = {
  id: string;
  title: string;
  meta: string;
  type: "Follow-up" | "Milestone" | "Invoice";
  dueAt: string;
  href: string;
  entityType: "contact" | "project" | "invoice" | "milestone";
  entityId: string;
};

const typeIcon = {
  "Follow-up": Bell,
  Milestone: FolderKanban,
  Invoice: FileText,
};

export function FocusList({
  items,
  maxItems,
  viewAllHref,
}: {
  items: FocusItem[];
  maxItems?: number;
  viewAllHref?: string;
}) {
  const [list, setList] = useState(items);
  const visible = maxItems ? list.slice(0, maxItems) : list;
  const { addActivity } = useActivity();

  function handleDone(id: string) {
    setList((prev) => prev.filter((item) => item.id !== id));
    toast.success("Marked as done.");
    const item = list.find((entry) => entry.id === id);
    if (item) {
      addActivity({
        entityType: item.entityType,
        entityId: item.entityId,
        action: "Marked done",
        meta: item.title,
      });
    }
  }

  function handleSnooze(id: string) {
    setList((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, dueAt: addDays(parseISO(item.dueAt), 2).toISOString() }
          : item,
      ),
    );
    toast.message("Snoozed for 2 days.");
    const item = list.find((entry) => entry.id === id);
    if (item) {
      addActivity({
        entityType: item.entityType,
        entityId: item.entityId,
        action: "Snoozed",
        meta: "+2 days",
      });
    }
  }

  return (
    <div className="space-y-3">
      {viewAllHref && (
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href={viewAllHref}>View all</Link>
          </Button>
        </div>
      )}
      {visible.map((item) => {
        const Icon = typeIcon[item.type];
        const overdue = isOverdue(item.dueAt);
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {overdue && <Badge variant="danger">Overdue</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{item.meta}</p>
                <p className="text-xs text-muted-foreground">
                  Next due {formatDateShort(item.dueAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <DisableIfNoPermission permission="followups:update" tooltip="Owner only">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDone(item.id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </DisableIfNoPermission>
                <DisableIfNoPermission permission="followups:update" tooltip="Owner only">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleSnooze(item.id)}
                  >
                    <CalendarClock className="h-4 w-4" />
                  </Button>
                </DisableIfNoPermission>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild size="icon" variant="ghost">
                      <Link href={item.href}>
                        <MoveRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        );
      })}
    </div>
  );
}
