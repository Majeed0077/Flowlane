"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalData } from "@/lib/localDataStore";
import { useRole } from "@/lib/useRole";
import { api } from "@/lib/api";
import type { ProjectStatus, ContactSource } from "@/types";

function getDefaultFollowupDate() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10);
}

export function ProjectCreatePanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const role = useRole();
  const isOwner = role === "owner";
  const { contacts, setProjects, setContacts } = useLocalData();

  const [title, setTitle] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [showCreateContact, setShowCreateContact] = React.useState(false);
  const [newContactName, setNewContactName] = React.useState("");
  const [newContactSource, setNewContactSource] =
    React.useState<ContactSource>("referral");
  const [newContactFollowUp, setNewContactFollowUp] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("planning");
  const [dueDate, setDueDate] = React.useState("");
  const [budgetAmount, setBudgetAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [notes, setNotes] = React.useState("");
  const [linksText, setLinksText] = React.useState("");
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [attachments, setAttachments] = React.useState<
    { id?: string; name: string; url: string; type: string; size: number }[]
  >([]);
  const [logos, setLogos] = React.useState<
    { id?: string; name: string; url: string; type: string; size: number }[]
  >([]);
  const [users, setUsers] = React.useState<{ id: string; name: string; role: string }[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadingLogos, setUploadingLogos] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const canSave = title.trim().length > 0;

  React.useEffect(() => {
    if (!newContactFollowUp) setNewContactFollowUp(getDefaultFollowupDate());
  }, [newContactFollowUp]);

  React.useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        setUsers(
          data.data.map((item: { id: string; name: string; role: string }) => ({
            id: item.id,
            name: item.name,
            role: item.role,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      const selectOpen =
        target instanceof Element &&
        target.closest("[data-vf-select-content]");
      if (selectOpen) return;
      if (panelRef.current && target && !panelRef.current.contains(target)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onOpenChange]);

  function parseLines(value: string) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        try {
          new URL(line);
          return true;
        } catch {
          return false;
        }
      });
  }

  async function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!canSave) {
      toast.error("Project name is required.");
      return;
    }

    const links = parseLines(linksText);
    const payload = {
      title: title.trim(),
      ...(contactId ? { contactId } : {}),
      ...(!contactId && clientName.trim() ? { clientName: clientName.trim() } : {}),
      status,
      dueDate: dueDate || new Date().toISOString(),
      startDate: new Date().toISOString(),
      notes: notes.trim() || undefined,
      links: links.length ? links : undefined,
      assigneeIds: assigneeIds.length ? assigneeIds : undefined,
      attachments: attachments.length ? attachments : undefined,
      logos: logos.length ? logos : undefined,
      archived: false,
      ...(isOwner
        ? {
            budgetAmount: budgetAmount ? Number(budgetAmount) : 0,
            currency,
          }
        : {}),
    };

    setLoading(true);
    try {
      const created = await api.createProject(payload);
      setProjects((prev) => [created, ...prev]);
      api
        .createNotification({
          title: "New project created",
          body: created.title,
          type: "project_created",
          entityType: "project",
          entityId: created.id,
        })
        .catch(() => undefined);
      toast.success("Project created.");
      onOpenChange(false);
      setTitle("");
      setClientName("");
      setContactId("");
      setShowCreateContact(false);
      setNewContactName("");
      setNewContactSource("referral");
      setNewContactFollowUp(getDefaultFollowupDate());
      setStatus("planning");
      setDueDate("");
      setBudgetAmount("");
      setCurrency("USD");
      setNotes("");
      setLinksText("");
      setAssigneeIds([]);
      setAttachments([]);
      setLogos([]);
    } catch {
      toast.error("Unable to create project.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(
    files: File[],
    setter: React.Dispatch<
      React.SetStateAction<
        { id?: string; name: string; url: string; type: string; size: number }[]
      >
    >,
    setBusy: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error ?? "Upload failed");
      }
      const uploaded = Array.isArray(json.data) ? json.data : [];
      setter((prev) => [...prev, ...uploaded]);
      toast.success("Files uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    void uploadFiles(files, setAttachments, setUploading);
    event.target.value = "";
  }

  function handleLogoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    void uploadFiles(files, setLogos, setUploadingLogos);
    event.target.value = "";
  }

  async function handleCreateContact() {
    if (!newContactName.trim()) {
      toast.error("Client name is required.");
      return;
    }
    if (!newContactFollowUp) {
      toast.error("Follow-up date is required.");
      return;
    }
    const newContact = {
      id: `c-${Math.random().toString(36).slice(2, 8)}`,
      name: newContactName.trim(),
      company: "New client",
      email: "",
      phone: "",
      whatsapp: "",
      source: newContactSource,
      stage: "new" as const,
      nextFollowUpAt: new Date(newContactFollowUp).toISOString(),
      tags: [],
      notes: [],
      archived: false,
    };
    try {
      const created = await api.createContact(newContact);
      setContacts((prev) => [created, ...prev]);
      setContactId(created.id);
      setClientName("");
      toast.success("Client created.");
    } catch {
      toast.error("Unable to create client.");
      return;
    }
    setShowCreateContact(false);
    setNewContactName("");
    setNewContactSource("referral");
    setNewContactFollowUp(getDefaultFollowupDate());
  }

  async function handleRemoveFile(
    file: { id?: string; name: string; url: string; type: string; size: number },
    index: number,
    source: "attachments" | "logos",
  ) {
    const current = source === "attachments" ? attachments : logos;
    const previous = current;
    const setter = source === "attachments" ? setAttachments : setLogos;
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: file.url }),
      });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error ?? "Unable to delete file");
      }
      toast.success(source === "attachments" ? "Attachment removed." : "Logo removed.");
    } catch (error) {
      setter(previous);
      toast.error(error instanceof Error ? error.message : "Unable to remove file.");
    }
  }

  return (
    <div
      className={[
        "fixed inset-y-0 right-0 z-50 h-screen w-[420px] border-l border-border bg-background shadow-xl",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none",
      ].join(" ")}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="New project"
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">New Project</p>
              <p className="text-xs text-muted-foreground">
                Create a project with client context.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              X
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Project name</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Client name (optional)</Label>
                <Input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="e.g. Majeed, Flux Design Co."
                  disabled={Boolean(contactId)}
                />
              </div>
              <div className="space-y-2">
                <Label>Select client (optional)</Label>
                <Select
                  value={contactId || ""}
                  onValueChange={(value) => {
                    if (value === "__clear__") {
                      setContactId("");
                      return;
                    }
                    if (value === "__create__") {
                      setShowCreateContact(true);
                      return;
                    }
                    setContactId(value);
                    setClientName("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contactId ? (
                      <SelectItem value="__clear__">Clear selection</SelectItem>
                    ) : null}
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__create__">+ Create new contact</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link this project to a client to track history, invoices, and follow-ups.
                </p>
                {showCreateContact ? (
                  <div className="mt-3 rounded-xl border bg-background p-4 space-y-3">
                    <div className="space-y-2">
                      <Label>Client name</Label>
                      <Input
                        value={newContactName}
                        onChange={(event) => setNewContactName(event.target.value)}
                        placeholder="Client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select
                        value={newContactSource}
                        onValueChange={(value) =>
                          setNewContactSource(value as ContactSource)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Source" />
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
                    <div className="space-y-2">
                      <Label>Next follow-up</Label>
                      <Input
                        type="date"
                        value={newContactFollowUp}
                        onChange={(event) => setNewContactFollowUp(event.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateContact(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateContact}>
                        Create contact
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assignees</Label>
                <div className="flex flex-wrap gap-2 rounded-xl border bg-background p-3">
                  {users.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No team members loaded.</p>
                  ) : (
                    users.map((user) => {
                      const active = assigneeIds.includes(user.id);
                      return (
                        <Button
                          key={user.id}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setAssigneeIds((prev) =>
                              prev.includes(user.id)
                                ? prev.filter((id) => id !== user.id)
                                : [...prev, user.id],
                            )
                          }
                        >
                          {user.name}
                        </Button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {isOwner ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Budget amount</Label>
                  <Input
                    type="number"
                    value={budgetAmount}
                    onChange={(event) => setBudgetAmount(event.target.value)}
                    placeholder="Amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="PKR">PKR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </div>

            <details className="rounded-xl border bg-background p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Links & attachments
              </summary>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Links</Label>
                  <p className="text-xs text-muted-foreground">Paste one URL per line.</p>
                  <Textarea
                    value={linksText}
                    onChange={(event) => setLinksText(event.target.value)}
                    placeholder={"https://figma.com/...\nhttps://github.com/...\nhttps://yourapp.com"}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project logos</Label>
                  <p className="text-xs text-muted-foreground">
                    Add multiple brand marks or covers for this project.
                  </p>
                  <div
                    className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void uploadFiles(
                        Array.from(event.dataTransfer.files ?? []),
                        setLogos,
                        setUploadingLogos,
                      );
                    }}
                    onClick={() => logoInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        logoInputRef.current?.click();
                      }
                    }}
                  >
                    <p className="font-medium text-foreground">
                      {uploadingLogos ? "Uploading logos..." : "Drag & drop logos here or click to upload"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG, WEBP supported. Multiple files supported.
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={handleLogoSelected}
                  />
                  {logos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No logos yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {logos.map((file, index) => (
                        <div
                          key={`${file.url}-${index}`}
                          className="rounded-lg border bg-background p-2 text-xs"
                        >
                          <img
                            src={file.url}
                            alt={file.name}
                            className="h-24 w-full rounded-md object-cover"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-foreground">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(file, index, "logos")}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload files (PDF, DOCX, XLSX, images).
                  </p>
                  <div
                    className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void uploadFiles(
                        Array.from(event.dataTransfer.files ?? []),
                        setAttachments,
                        setUploading,
                      );
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <p className="font-medium text-foreground">
                      {uploading ? "Uploading..." : "Drag & drop files here or click to upload"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Multiple files supported.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFilesSelected}
                  />
                  {attachments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No attachments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={`${file.url}-${index}`}
                          className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">{file.name}</p>
                            <p className="text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(file, index, "attachments")}
                            >
                              Remove
                            </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </form>
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || loading} onClick={handleSubmit}>
              {loading ? "Saving..." : "Save project"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
