"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { formatDateShort, isOverdue } from "@/lib/format";
import type { Contact, ContactStage } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "@/components/common/SourceBadge";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Can } from "@/components/common/PermissionGate";
import { hasPermission } from "@/lib/rbac";
import { useRole } from "@/lib/useRole";
import { useActivity } from "@/lib/activityStore";
import { useLocalData } from "@/lib/localDataStore";
import { api } from "@/lib/api";

const stages: { id: ContactStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "meeting", label: "Meeting" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];


export function PipelineBoard() {
  const { contacts, setContacts } = useLocalData();
  const [followUpContact, setFollowUpContact] = useState<Contact | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const role = useRole();
  const { addActivity } = useActivity();

  const columns = useMemo(() => {
    return stages.reduce<Record<ContactStage, Contact[]>>((acc, stage) => {
      acc[stage.id] = contacts.filter((contact) => contact.stage === stage.id);
      return acc;
    }, {} as Record<ContactStage, Contact[]>);
  }, [contacts]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const newStage = over.id as ContactStage;
    const contactId = active.id as string;

    if (!hasPermission(role, "crm:move_stage")) {
      toast.error("Only the owner can do this.");
      return;
    }

    try {
      await api.updateContact(contactId, { stage: newStage });
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId ? { ...contact, stage: newStage } : contact,
        ),
      );
      toast.success("Stage updated.");
      addActivity({
        entityType: "contact",
        entityId: contactId,
        action: "Stage updated",
        meta: `Moved to ${newStage.replace("_", " ")}`,
      });
    } catch {
      toast.error("Unable to update stage.");
    }
  }

  const summary = useMemo(() => {
    const total = contacts.length;
    const won = contacts.filter((contact) => contact.stage === "won").length;
    const lost = contacts.filter((contact) => contact.stage === "lost").length;
    return { total, won, lost };
  }, [contacts]);

  useEffect(() => {
    if (followUpContact) {
      const iso = followUpContact.nextFollowUpAt
        ? new Date(followUpContact.nextFollowUpAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      setFollowUpDate(iso);
    }
  }, [followUpContact]);


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Drag cards to move leads between stages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground">
            Total <span className="font-semibold text-foreground">{summary.total}</span> · Won{" "}
            <span className="font-semibold text-foreground">{summary.won}</span> · Lost{" "}
            <span className="font-semibold text-foreground">{summary.lost}</span>
          </div>
          <Can permission="system:reset">
            <Button
              variant="outline"
              onClick={() => {
                toast.message("Reset is not available in live mode.");
              }}
            >
              Reset data
            </Button>
          </Can>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-4 xl:grid-cols-7">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage.id}
              label={stage.label}
              count={columns[stage.id]?.length ?? 0}
            >
              {columns[stage.id]?.length ? (
                columns[stage.id].map((contact) => (
                  <PipelineCard
                    key={contact.id}
                    contact={contact}
                    onSetFollowUp={() => setFollowUpContact(contact)}
                    canMove={hasPermission(role, "crm:move_stage")}
                    canFollowUp={hasPermission(role, "followups:update")}
                    canDelete={hasPermission(role, "contacts:delete")}
                    onDelete={async () => {
                      try {
                        await api.deleteContact(contact.id);
                        setContacts((prev) => prev.filter((item) => item.id !== contact.id));
                        toast.success("Contact deleted.");
                      } catch {
                        toast.error("Unable to delete contact.");
                      }
                    }}
                  />
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                  No leads
                </div>
              )}
            </PipelineColumn>
          ))}
        </div>
      </DndContext>

      <Sheet open={!!followUpContact} onOpenChange={() => setFollowUpContact(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Set follow-up</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Follow-up date"
              type="date"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
            />
            <Input placeholder="Note" />
            <Button
              onClick={async () => {
                if (!followUpContact) return;
                if (!followUpDate) {
                  toast.error("Follow-up date is required.");
                  return;
                }
                try {
                  const nextDate = new Date(followUpDate).toISOString();
                  await api.updateContact(followUpContact.id, { nextFollowUpAt: nextDate });
                  setContacts((prev) =>
                    prev.map((contact) =>
                      contact.id === followUpContact.id
                        ? { ...contact, nextFollowUpAt: nextDate }
                        : contact,
                    ),
                  );
                  toast.success("Follow-up scheduled.");
                  addActivity({
                    entityType: "contact",
                    entityId: followUpContact.id,
                    action: "Follow-up scheduled",
                  });
                  setFollowUpContact(null);
                  setFollowUpDate("");
                } catch {
                  toast.error("Unable to update follow-up.");
                }
              }}
            >
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PipelineColumn({
  stage,
  label,
  count,
  children,
}: {
  stage: ContactStage;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full flex-col rounded-xl border bg-card p-3",
        isOver && "ring-2 ring-primary/30",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function PipelineCard({
  contact,
  onSetFollowUp,
  canMove,
  canFollowUp,
  canDelete,
  onDelete,
}: {
  contact: Contact;
  onSetFollowUp: () => void;
  canMove: boolean;
  canFollowUp: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });
  const overdue = isOverdue(contact.nextFollowUpAt);

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={cn(
        "rounded-lg border bg-background p-4 shadow-sm transition",
        canMove ? "cursor-grab" : "cursor-not-allowed opacity-90",
        isDragging && "opacity-60",
      )}
      {...(canMove ? listeners : {})}
      {...(canMove ? attributes : {})}
    >
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold">{contact.name}</p>
          <p className="text-xs text-muted-foreground">{contact.company}</p>
        </div>
        <div className="flex items-center justify-between">
          <SourceBadge source={contact.source} />
          <span className="text-xs text-muted-foreground">
            Next: {formatDateShort(contact.nextFollowUpAt)}
          </span>
        </div>
        {overdue && (
          <span className="text-xs font-medium text-rose-600">Overdue</span>
        )}
        <div className="flex items-center justify-between pt-2">
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href={`/contacts/${contact.id}`}>Open</Link>
          </Button>
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${contact.id}`}>Open contact</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${contact.id}`}>Edit contact</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  if (!canFollowUp) {
                    toast.error("Only the owner can do this.");
                    return;
                  }
                  onSetFollowUp();
                }}
              >
                Set follow-up
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-500 focus:text-rose-500"
                onClick={() => {
                  if (!canDelete) {
                    toast.error("Only the owner can do this.");
                    return;
                  }
                  onDelete();
                }}
              >
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}
