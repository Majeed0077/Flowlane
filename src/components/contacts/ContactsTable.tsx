"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Contact, ContactSource, ContactStage } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SourceBadge } from "@/components/common/SourceBadge";
import { StageBadge } from "@/components/common/StatusBadge";
import { formatDate, isDueToday, isOverdue } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { Can } from "@/components/common/PermissionGate";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useLocalData } from "@/lib/localDataStore";
import { useRole } from "@/lib/useRole";
import { toast } from "sonner";

const sourceOptions: { value: ContactSource | "all"; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "upwork", label: "Upwork" },
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "local", label: "Local" },
  { value: "event", label: "Event" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const stageOptions: { value: ContactStage | "all"; label: string }[] = [
  { value: "all", label: "All stages" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export function ContactsTable({
  contacts,
  initialFilter,
}: {
  contacts: Contact[];
  initialFilter?: string;
}) {
  const [visibility, setVisibility] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<ContactSource | "all">("all");
  const [stage, setStage] = useState<ContactStage | "all">("all");
  const { setContacts } = useLocalData();
  const role = useRole();
  const canDelete = role === "owner";

  const today = new Date();

  const filtered = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.name.toLowerCase().includes(search.toLowerCase()) ||
        contact.company.toLowerCase().includes(search.toLowerCase());
      const matchesSource = source === "all" || contact.source === source;
      const matchesStage = stage === "all" || contact.stage === stage;
      const matchesFilter =
        initialFilter === "followupsToday"
          ? isDueToday(contact.nextFollowUpAt, today)
          : initialFilter === "followupsOverdue"
            ? isOverdue(contact.nextFollowUpAt, today)
            : true;
      const matchesArchived =
        visibility === "archived" ? contact.archived : !contact.archived;
      return (
        matchesSearch && matchesSource && matchesStage && matchesFilter && matchesArchived
      );
    });
  }, [contacts, search, source, stage, initialFilter, today, visibility]);


  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
        <Input
          placeholder="Search contacts..."
          className="w-full max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={source} onValueChange={(value) => setSource(value as ContactSource | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter source" />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={(value) => setStage(value as ContactStage | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter stage" />
          </SelectTrigger>
          <SelectContent>
            {stageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Can permission="contacts:delete">
          <Select value={visibility} onValueChange={(value) => setVisibility(value as "active" | "archived")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Can>
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add a lead or import contacts to start tracking follow-ups."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="font-medium">
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell>{contact.company}</TableCell>
                  <TableCell>
                    <SourceBadge source={contact.source} />
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={contact.stage} />
                  </TableCell>
                  <TableCell>{formatDate(contact.nextFollowUpAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-500 hover:text-rose-500"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            api
                              .deleteContact(contact.id)
                              .then(() => {
                                setContacts((prev) =>
                                  prev.filter((item) => item.id !== contact.id),
                                );
                                toast.success("Contact deleted.");
                              })
                              .catch(() => toast.error("Unable to delete contact."));
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
