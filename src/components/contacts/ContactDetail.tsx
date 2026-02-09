"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Contact, ContactStage, Invoice, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/common/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/lib/rbac";
import { useRole } from "@/lib/useRole";
import { DisableIfNoPermission, Can } from "@/components/common/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/common/ActivityTimeline";
import { useActivity } from "@/lib/activityStore";
import { useLocalData } from "@/lib/localDataStore";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

const stageOptions: { value: ContactStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export function ContactDetail({
  contact,
  projects,
  invoices,
}: {
  contact: Contact;
  projects: Project[];
  invoices: Invoice[];
}) {
  const [stage, setStage] = useState<ContactStage>(contact.stage);
  const [archived, setArchived] = useState(contact.archived);
  const [cadence, setCadence] = useState(
    contact.followUpCadence ?? "none",
  );
  const [intervalDays, setIntervalDays] = useState(
    contact.followUpIntervalDays ?? 14,
  );
  const role = useRole();
  const { addActivity } = useActivity();
  const { setContacts } = useLocalData();

  const formatLinkLabel = (value: string, index: number) => {
    try {
      const url = new URL(value);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return `Link ${index + 1}`;
    }
  };

  const { visibleLinks, remainingLinks } = useMemo(() => {
    const allLinks = projects.flatMap((project) =>
      (project.links ?? []).map((value, index) => ({
        id: `${project.id}-${index}`,
        label: `${project.title} - ${formatLinkLabel(value, index)}`,
        value,
      })),
    );
    return {
      visibleLinks: allLinks.slice(0, 3),
      remainingLinks: Math.max(0, allLinks.length - 3),
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{contact.company}</p>
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <StageBadge stage={stage} />
            {archived && <Badge variant="secondary">Archived</Badge>}
            <span className="text-xs text-muted-foreground">
              Next follow-up: {formatDate(contact.nextFollowUpAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DisableIfNoPermission permission="contacts:archive">
            <Button
              variant="outline"
              onClick={() => {
                const next = !archived;
                api
                  .updateContact(contact.id, { archived: next })
                  .then(() => {
                    setArchived(next);
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, archived: next } : item,
                      ),
                    );
                    toast.success(next ? "Archived." : "Restored.");
                    addActivity({
                      entityType: "contact",
                      entityId: contact.id,
                      action: next ? "Contact archived" : "Contact restored",
                    });
                  })
                  .catch(() => {
                    toast.error("Unable to update contact.");
                  });
              }}
            >
              {archived ? "Restore" : "Archive"}
            </Button>
          </DisableIfNoPermission>
          <Can permission="contacts:delete">
            <Button
              variant="destructive"
              onClick={() => {
                api
                  .deleteContact(contact.id)
                  .then(() => {
                    setContacts((prev) => prev.filter((item) => item.id !== contact.id));
                    toast.success("Deleted.");
                  })
                  .catch(() => toast.error("Unable to delete contact."));
              }}
            >
              Delete
            </Button>
          </Can>
          <Select
            value={stage}
            onValueChange={(value) => {
              if (!hasPermission(role, "contacts:edit")) {
                toast.error("Only the owner can do this.");
                return;
              }
              api
                .updateContact(contact.id, { stage: value as ContactStage })
                .then(() => {
                  setStage(value as ContactStage);
                  setContacts((prev) =>
                    prev.map((item) =>
                      item.id === contact.id ? { ...item, stage: value as ContactStage } : item,
                    ),
                  );
                  toast.success("Stage updated.");
                  addActivity({
                    entityType: "contact",
                    entityId: contact.id,
                    action: "Stage updated",
                    meta: `Stage set to ${value}`,
                  });
                })
                .catch(() => toast.error("Unable to update stage."));
            }}
            disabled={!hasPermission(role, "contacts:edit")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cadence}
            onValueChange={(value) => {
              if (!hasPermission(role, "followups:update")) {
                toast.error("Only the owner can do this.");
                return;
              }
              setCadence(value as typeof cadence);
              const payload: Record<string, unknown> = {
                followUpCadence: value,
              };
              if (value !== "custom") {
                payload.followUpIntervalDays = 0;
              }
              api
                .updateContact(contact.id, payload)
                .then(() => {
                  setContacts((prev) =>
                    prev.map((item) =>
                      item.id === contact.id
                        ? { ...item, followUpCadence: value as any, followUpIntervalDays: payload.followUpIntervalDays as number | undefined }
                        : item,
                    ),
                  );
                  toast.success("Follow-up cadence updated.");
                })
                .catch(() => toast.error("Unable to update cadence."));
            }}
            disabled={!hasPermission(role, "followups:update")}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Follow-up cadence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No recurrence</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="custom">Custom days</SelectItem>
            </SelectContent>
          </Select>
          {cadence === "custom" ? (
            <Input
              type="number"
              min={1}
              className="w-[120px]"
              value={intervalDays}
              onChange={(event) => setIntervalDays(Number(event.target.value))}
              onBlur={() => {
                if (!hasPermission(role, "followups:update")) return;
                if (!intervalDays || intervalDays < 1) return;
                api
                  .updateContact(contact.id, {
                    followUpCadence: "custom",
                    followUpIntervalDays: intervalDays,
                  })
                  .then(() => {
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id
                          ? { ...item, followUpCadence: "custom", followUpIntervalDays: intervalDays }
                          : item,
                      ),
                    );
                    toast.success("Custom cadence saved.");
                  })
                  .catch(() => toast.error("Unable to update cadence."));
              }}
              disabled={!hasPermission(role, "followups:update")}
            />
          ) : null}
          <Button asChild variant="outline">
            <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </Button>
          <DisableIfNoPermission permission="followups:update">
            <Button
              onClick={() => {
                const nextDate = new Date(
                  Date.now() + 1000 * 60 * 60 * 24 * 2,
                ).toISOString();
                api
                  .updateContact(contact.id, { nextFollowUpAt: nextDate })
                  .then(() => {
                    toast.success("Follow-up scheduled.");
                    setContacts((prev) =>
                      prev.map((item) =>
                        item.id === contact.id ? { ...item, nextFollowUpAt: nextDate } : item,
                      ),
                    );
                    addActivity({
                      entityType: "contact",
                      entityId: contact.id,
                      action: "Follow-up scheduled",
                    });
                  })
                  .catch(() => toast.error("Unable to update follow-up."));
              }}
            >
              Schedule Follow-up
            </Button>
          </DisableIfNoPermission>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold">Notes</p>
              <div className="mt-3 space-y-3">
                {contact.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  contact.notes.map((note) => (
                    <div key={note.id} className="rounded-lg border bg-background p-3">
                      <p className="text-sm">{note.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Contact Details</p>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
                <span>{contact.email}</span>
                <span>{contact.phone}</span>
              </div>
            </div>
          </Card>
          <div className="mt-6 space-y-3">
            <p className="text-sm font-semibold">Activity</p>
            <ActivityTimeline entityType="contact" entityId={contact.id} />
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid gap-3">
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No active projects linked to this contact.
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-lg border bg-background p-4 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(project.dueDate)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="grid gap-3">
            {invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No invoices recorded for this contact.
              </div>
            ) : (
              invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="rounded-lg border bg-background p-4 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold">{invoice.invoiceNo}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(invoice.dueDate)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="links">
          <div className="grid gap-3">
            {visibleLinks.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No shared links yet.
              </div>
            ) : (
              <>
                {visibleLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.value}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border bg-background p-4 text-sm hover:bg-muted/40"
                  >
                    {link.label}
                  </a>
                ))}
                {remainingLinks > 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    +{remainingLinks} more links
                  </div>
                ) : null}
              </>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
