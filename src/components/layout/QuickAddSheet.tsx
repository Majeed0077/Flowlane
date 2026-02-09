"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/rbac";
import { useRole } from "@/lib/useRole";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useActivity } from "@/lib/activityStore";
import { useLocalData } from "@/lib/localDataStore";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function QuickAddSheet({
  children,
  open: openProp,
  onOpenChange,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const isControlled = typeof openProp === "boolean";
  const open = isControlled ? openProp : openState;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setOpenState(next);
    }
  };
  const role = useRole();
  const canAdd = hasPermission(role, "contacts:create");
  const { addActivity } = useActivity();
  const { contacts, setContacts } = useLocalData();
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      const selectOpen = target instanceof Element && target.closest("[data-vf-select-content]");
      if (selectOpen) return;
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      document.body.dataset.quickAddOpen = "true";
      document.documentElement.dataset.quickAddOpen = "true";
    } else {
      delete document.body.dataset.quickAddOpen;
      delete document.documentElement.dataset.quickAddOpen;
    }
    return () => {
      delete document.body.dataset.quickAddOpen;
      delete document.documentElement.dataset.quickAddOpen;
    };
  }, [open]);

  const [leadName, setLeadName] = useState("");
  const [leadSource, setLeadSource] = useState("referral");
  const [otherSource, setOtherSource] = useState("");
  const [showOtherSource, setShowOtherSource] = useState(false);
  const otherSourceRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (showOtherSource) {
      otherSourceRef.current?.focus();
    }
  }, [showOtherSource]);
  const [followupDate, setFollowupDate] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10),
  );

  const canSave = useMemo(() => {
    if (!leadName.trim()) return false;
    if (!followupDate) return false;
    if (!leadSource) return false;
    if (leadSource === "other" && !otherSource.trim()) return false;
    return true;
  }, [leadName, followupDate, leadSource, otherSource]);

  async function handleSave() {
    if (!canSave) {
      toast.error("Every lead must have a next follow-up.");
      return;
    }
    const normalizedSource =
      leadSource === "other"
        ? { source: "other", sourceLabel: otherSource.trim() }
        : { source: leadSource, sourceLabel: undefined };

    const newContact = {
      id: `c-${Math.random().toString(36).slice(2, 8)}`,
      name: leadName.trim(),
      company: "New lead",
      email: "",
      phone: "",
      whatsapp: "",
      source: normalizedSource.source as typeof leadSource,
      sourceLabel: normalizedSource.sourceLabel,
      stage: "new" as const,
      nextFollowUpAt: new Date(followupDate).toISOString(),
      tags: [],
      notes: [],
      archived: false,
    };
    try {
      const created = await api.createContact(newContact);
      setContacts([created, ...contacts]);
      api
        .createNotification({
          title: "New lead captured",
          body: `${created.name} - ${created.source}`,
          type: "lead_created",
          entityType: "contact",
          entityId: created.id,
        })
        .catch(() => undefined);
      toast.success("Lead captured.");
    } catch {
      toast.error("Unable to create lead.");
      return;
    }
    addActivity({
      entityType: "contact",
      entityId: newContact.id,
      action: "Lead created",
      meta: `${newContact.name} - ${newContact.source}`,
    });
    setOpen(false);
  }

  if (!canAdd) {
    const trigger =
      children && typeof children !== "string"
        ? React.cloneElement(children as React.ReactElement, { disabled: true })
        : <Button disabled>{children ?? "Quick Add"}</Button>;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>Owner only</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const trigger = children
    ? React.isValidElement(children)
      ? (() => {
          const childElement = children as React.ReactElement;
          return React.cloneElement(childElement, {
            onClick: (event: React.MouseEvent) => {
              childElement.props.onClick?.(event);
              setOpen(true);
            },
          });
        })()
      : <Button onClick={() => setOpen(true)}>Quick Add</Button>
    : <Button onClick={() => setOpen(true)}>Quick Add</Button>;

  return (
    <>
      {trigger}

      <div
        className={[
          "fixed inset-y-0 right-0 z-50 h-screen w-[420px] border-l border-border shadow-xl glass",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none",
        ].join(" ")}
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label="Quick add"
        aria-hidden={!open}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-sm font-semibold">Quick Add</p>
            <p className="text-xs text-muted-foreground">Capture a lead in under 20 seconds.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
            X
          </Button>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-4">
            <Input
              placeholder="Name *"
              value={leadName}
              onChange={(event) => setLeadName(event.target.value)}
            />
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <Select
                value={leadSource}
                onValueChange={(value) => {
                  setLeadSource(value);
                  if (value === "other") {
                    setShowOtherSource(false);
                    setTimeout(() => setShowOtherSource(true), 0);
                  } else {
                    setShowOtherSource(false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upwork">Upwork</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {showOtherSource ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Specify source</label>
                <Input
                  ref={otherSourceRef}
                  placeholder="e.g. Facebook group, Cold email"
                  value={otherSource}
                  onChange={(event) => setOtherSource(event.target.value)}
                />
              </div>
            ) : null}
            <Input
              type="date"
              value={followupDate}
              onChange={(event) => setFollowupDate(event.target.value)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
