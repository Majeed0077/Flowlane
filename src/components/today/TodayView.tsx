"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, isAfter, isBefore, isSameDay, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateShort } from "@/lib/format";
import { useActivity } from "@/lib/activityStore";
import { CalendarClock, CheckCircle2, Link as LinkIcon, MessageSquare } from "lucide-react";
import { useLocalData } from "@/lib/localDataStore";
import { useRole } from "@/lib/useRole";
import { api } from "@/lib/api";

type TodayItem = {
  id: string;
  type: "followup" | "milestone" | "invoice";
  title: string;
  meta: string;
  dueAt: string;
  href: string;
  entityType: "contact" | "project" | "invoice" | "milestone";
  entityId: string;
  whatsapp?: string;
  waitingClient?: boolean;
};

type Filter = "all" | "overdue" | "today" | "week" | "priority";

export function TodayView({ initialItems }: { initialItems: TodayItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [completed, setCompleted] = useState<TodayItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const { addActivity } = useActivity();
  const {
    contacts,
    setContacts,
    milestones,
    setMilestones,
    invoices,
    setInvoices,
    projects,
    setProjects,
  } = useLocalData();
  const role = useRole();
  const isOwner = role === "owner";
  const today = new Date();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const due = parseISO(item.dueAt);
      const overdue = isBefore(due, today);
      const isToday = isSameDay(due, today);
      const isWeek = isAfter(due, today) && isBefore(due, addDays(today, 7));
      const isPriority = overdue || isToday;
      if (filter === "overdue") return overdue;
      if (filter === "today") return isToday;
      if (filter === "week") return isWeek;
      if (filter === "priority") return isPriority;
      return true;
    });
  }, [items, filter, today]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDate = parseISO(a.dueAt).getTime();
      const bDate = parseISO(b.dueAt).getTime();
      return aDate - bDate;
    });
  }, [filtered]);

  function getNextFollowupDate(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const cadence = contact?.followUpCadence ?? "none";
    if (cadence === "weekly") return addDays(today, 7).toISOString();
    if (cadence === "monthly") return addDays(today, 30).toISOString();
    if (cadence === "custom" && contact?.followUpIntervalDays) {
      return addDays(today, contact.followUpIntervalDays).toISOString();
    }
    return addDays(today, 2).toISOString();
  }

  async function markDone(item: TodayItem) {
    if (item.type === "invoice" && !isOwner) {
      toast.error("Only the owner can do this.");
      return;
    }
    if (item.type === "followup") {
      const nextDate = getNextFollowupDate(item.entityId);
      try {
        await api.updateContact(item.entityId, { nextFollowUpAt: nextDate });
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === item.entityId ? { ...contact, nextFollowUpAt: nextDate } : contact,
          ),
        );
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setCompleted((prev) => [item, ...prev]);
        toast.success("Marked as done.");
        addActivity({
          entityType: item.entityType,
          entityId: item.entityId,
          action: "Marked done",
          meta: item.title,
        });
      } catch {
        toast.error("Unable to update follow-up.");
      }
    }
    if (item.type === "milestone") {
      try {
        await api.updateMilestone(item.entityId, { status: "done" });
        setMilestones((prev) =>
          prev.map((milestone) =>
            milestone.id === item.entityId ? { ...milestone, status: "done" } : milestone,
          ),
        );
        const updatedMilestones = milestones.map((milestone) =>
          milestone.id === item.entityId ? { ...milestone, status: "done" } : milestone,
        );
        const completedProjectIds = new Set(
          updatedMilestones
            .filter((milestone) => milestone.status === "done")
            .map((milestone) => milestone.projectId),
        );
        const projectsToComplete = projects.filter((project) => {
          const projectMilestones = updatedMilestones.filter(
            (milestone) => milestone.projectId === project.id,
          );
          if (projectMilestones.length === 0) return false;
          return projectMilestones.every((milestone) => milestone.status === "done");
        });
        if (projectsToComplete.length > 0) {
          await Promise.all(
            projectsToComplete.map((project) => api.updateProject(project.id, { status: "completed" })),
          );
          setProjects((prev) =>
            prev.map((project) =>
              projectsToComplete.find((item) => item.id === project.id)
                ? { ...project, status: "completed" }
                : project,
            ),
          );
        }
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setCompleted((prev) => [item, ...prev]);
        toast.success("Marked as done.");
        addActivity({
          entityType: item.entityType,
          entityId: item.entityId,
          action: "Marked done",
          meta: item.title,
        });
      } catch {
        toast.error("Unable to update milestone.");
      }
    }
    if (item.type === "invoice") {
      try {
        await api.updateInvoice(item.entityId, { status: "paid" });
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === item.entityId ? { ...invoice, status: "paid" } : invoice,
          ),
        );
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setCompleted((prev) => [item, ...prev]);
        toast.success("Marked as done.");
        addActivity({
          entityType: item.entityType,
          entityId: item.entityId,
          action: "Marked done",
          meta: item.title,
        });
      } catch {
        toast.error("Unable to update invoice.");
      }
    }
  }

  async function snooze(item: TodayItem, days: number) {
    const nextDue = addDays(parseISO(item.dueAt), days).toISOString();
    if (item.type === "followup") {
      const nextDate = addDays(parseISO(contacts.find((c) => c.id === item.entityId)?.nextFollowUpAt ?? item.dueAt), days).toISOString();
      try {
        await api.updateContact(item.entityId, { nextFollowUpAt: nextDate });
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === item.entityId ? { ...contact, nextFollowUpAt: nextDate } : contact,
          ),
        );
      } catch {
        toast.error("Unable to snooze follow-up.");
        return;
      }
    }
    if (item.type === "milestone") {
      const nextDate = addDays(parseISO(item.dueAt), days).toISOString().slice(0, 10);
      try {
        await api.updateMilestone(item.entityId, { dueDate: nextDate });
        setMilestones((prev) =>
          prev.map((milestone) =>
            milestone.id === item.entityId ? { ...milestone, dueDate: nextDate } : milestone,
          ),
        );
      } catch {
        toast.error("Unable to snooze milestone.");
        return;
      }
    }
    if (item.type === "invoice") {
      const nextDate = addDays(parseISO(item.dueAt), days).toISOString().slice(0, 10);
      try {
        await api.updateInvoice(item.entityId, { dueDate: nextDate });
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === item.entityId ? { ...invoice, dueDate: nextDate } : invoice,
          ),
        );
      } catch {
        toast.error("Unable to snooze invoice.");
        return;
      }
    }
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, dueAt: nextDue } : i)),
    );
    toast.message(`Snoozed for ${days} days.`);
    addActivity({
      entityType: item.entityType,
      entityId: item.entityId,
      action: "Snoozed",
      meta: `+${days} days`,
    });
  }

  function ping(item: TodayItem) {
    if (item.whatsapp) {
      window.open(`https://wa.me/${item.whatsapp}`, "_blank");
      return;
    }
    navigator.clipboard.writeText(
      "Hi! Just checking in on the pending items. Let me know if you need anything from us.",
    );
    toast.success("Reminder copied to clipboard.");
  }

  const overdueItems = sortedFiltered.filter((item) => isBefore(parseISO(item.dueAt), today));
  const todayItems = sortedFiltered.filter((item) => isSameDay(parseISO(item.dueAt), today));
  const weekItems = sortedFiltered.filter((item) => {
    const due = parseISO(item.dueAt);
    return isAfter(due, today) && isBefore(due, addDays(today, 7));
  });
  const waitingItems = sortedFiltered.filter((item) => item.waitingClient);

  const sections = [
    { title: "Overdue", items: overdueItems },
    { title: "Due Today", items: todayItems },
    { title: "Due This Week", items: weekItems },
    { title: "Waiting on Client", items: waitingItems },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-sm text-muted-foreground">
            Focus on follow-ups, milestones, and overdue invoices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "priority", "overdue", "today", "week"] as Filter[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "secondary" : "ghost"}
              onClick={() => setFilter(key)}
            >
              {key === "all"
                ? "All"
                : key === "priority"
                  ? "Priority"
                : key === "overdue"
                  ? "Overdue"
                  : key === "today"
                    ? "Today"
                    : "This Week"}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          You&apos;re clear for today.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) =>
            section.items.length ? (
              <div key={section.title} className="space-y-3">
                <h2 className="text-sm font-semibold">{section.title}</h2>
                {section.items.map((item) => {
                  const due = parseISO(item.dueAt);
                  const overdue = isBefore(due, today);
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{item.title}</p>
                            {overdue && <Badge variant="danger">Overdue</Badge>}
                            {item.waitingClient && (
                              <Badge variant="warning">Waiting on client</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{item.meta}</p>
                          <p className="text-xs text-muted-foreground">
                            Due {formatDateShort(item.dueAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => markDone(item)}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark done</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => snooze(item, 2)}>
                                  <CalendarClock className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Snooze +2 days</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => snooze(item, 7)}>
                                  <CalendarClock className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Snooze +7 days</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button asChild size="icon" variant="ghost">
                                  <Link href={item.href}>
                                    <LinkIcon className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open</TooltipContent>
                            </Tooltip>
                            {item.waitingClient && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" onClick={() => ping(item)}>
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ping client</TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null,
          )}
        </div>
      )}
      {completed.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Completed ({completed.length})</h2>
          <div className="space-y-3">
            {completed.map((item) => (
              <Card key={`done-${item.id}`} className="p-4 opacity-70">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.meta}</p>
                    <p className="text-xs text-muted-foreground">
                      Done {formatDateShort(new Date().toISOString())}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={item.href}>Open</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
