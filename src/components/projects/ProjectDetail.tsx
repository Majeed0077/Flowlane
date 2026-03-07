"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Milestone, MilestoneStatus, Project, ProjectStatus } from "@/types";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MilestoneStatusBadge } from "@/components/common/StatusBadge";
import { hasPermission } from "@/lib/rbac";
import { useRole } from "@/lib/useRole";
import { DisableIfNoPermission, Can } from "@/components/common/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/common/ActivityTimeline";
import { useActivity } from "@/lib/activityStore";
import { useLocalData } from "@/lib/localDataStore";
import { CheckSquare, FileImage, FileSpreadsheet, FileText, MessageSquare, UserCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const milestoneStatusOptions: { value: MilestoneStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "waiting_client", label: "Waiting on Client" },
  { value: "done", label: "Done" },
];

const projectStatusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

function parseLinks(value: string) {
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

type UploadFile = { id?: string; name: string; url: string; type: string; size: number };

export function ProjectDetail({
  project,
  milestones,
  budgetTier,
  isOwner,
}: {
  project: Project;
  milestones: Milestone[];
  budgetTier?: "Low" | "Medium" | "High";
  isOwner: boolean;
}) {
  const [currentProject, setCurrentProject] = useState(project);
  const [items, setItems] = useState<Milestone[]>(milestones);
  const [drafts, setDrafts] = useState<
    { id: string; title: string; amount: number; currency: string }[]
  >([]);
  const [archived, setArchived] = useState(project.archived);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [milestoneCurrency, setMilestoneCurrency] = useState("USD");
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus>("pending");
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editStatus, setEditStatus] = useState<ProjectStatus>(project.status);
  const [editStartDate, setEditStartDate] = useState(project.startDate.slice(0, 10));
  const [editDueDate, setEditDueDate] = useState(project.dueDate.slice(0, 10));
  const [editBudgetAmount, setEditBudgetAmount] = useState(String(project.budgetAmount ?? 0));
  const [editCurrency, setEditCurrency] = useState(project.currency ?? "USD");
  const [editNotes, setEditNotes] = useState(project.notes ?? "");
  const [editLinksText, setEditLinksText] = useState((project.links ?? []).join("\n"));
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(project.assigneeIds ?? []);
  const [editAttachments, setEditAttachments] = useState<UploadFile[]>(project.attachments ?? []);
  const [editLogos, setEditLogos] = useState<UploadFile[]>(project.logos ?? []);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [assetUploading, setAssetUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [checklistSaving, setChecklistSaving] = useState(false);

  const role = useRole();
  const { addActivity } = useActivity();
  const { setProjects, setMilestones, setInvoices } = useLocalData();
  const canEditProject = hasPermission(role, "projects:edit");
  const projectLinks = currentProject.links ?? [];
  const visibleLinks = projectLinks.slice(0, 3);
  const remainingLinks = projectLinks.length - visibleLinks.length;

  useEffect(() => {
    setItems(milestones);
  }, [milestones]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        setUsers(data.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCurrentProject(project);
    setArchived(project.archived);
    setEditTitle(project.title);
    setEditStatus(project.status);
    setEditStartDate(project.startDate.slice(0, 10));
    setEditDueDate(project.dueDate.slice(0, 10));
    setEditBudgetAmount(String(project.budgetAmount ?? 0));
    setEditCurrency(project.currency ?? "USD");
    setEditNotes(project.notes ?? "");
    setEditLinksText((project.links ?? []).join("\n"));
    setEditAssigneeIds(project.assigneeIds ?? []);
    setEditAttachments(project.attachments ?? []);
    setEditLogos(project.logos ?? []);
    setIsEditing(false);
  }, [project]);

  const sorted = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);

  const formatLinkLabel = (value: string, index: number) => {
    try {
      const url = new URL(value);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return `Link ${index + 1}`;
    }
  };

  const formatAttachmentLabel = (value: string, index: number) => {
    if (!value) return `Attachment ${index + 1}`;
    try {
      const url = new URL(value);
      const last = url.pathname.split("/").filter(Boolean).pop();
      return last ? decodeURIComponent(last) : `Attachment ${index + 1}`;
    } catch {
      return `Attachment ${index + 1}`;
    }
  };

  const attachmentIcon = (type: string) => {
    if (type.startsWith("image/")) return <FileImage className="h-3.5 w-3.5" />;
    if (type.includes("sheet") || type.includes("excel")) return <FileSpreadsheet className="h-3.5 w-3.5" />;
    return <FileText className="h-3.5 w-3.5" />;
  };

  async function syncProject(payload: Partial<Project>, successMessage: string, action: string, meta?: string) {
    const updated = await api.updateProject(currentProject.id, payload);
    setCurrentProject(updated);
    setArchived(updated.archived);
    setProjects((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    addActivity({ entityType: "project", entityId: currentProject.id, action, meta });
    toast.success(successMessage);
    return updated;
  }

  async function saveProjectEdits() {
    if (!editTitle.trim()) {
      toast.error("Project title is required.");
      return;
    }

    const payload: Partial<Project> = {
      title: editTitle.trim(),
      status: editStatus,
      startDate: new Date(editStartDate || currentProject.startDate).toISOString(),
      dueDate: new Date(editDueDate || currentProject.dueDate).toISOString(),
      notes: editNotes.trim() || undefined,
      links: parseLinks(editLinksText),
      assigneeIds: editAssigneeIds,
      attachments: editAttachments,
      logos: editLogos,
    };

    if (isOwner) {
      payload.budgetAmount = Number(editBudgetAmount || 0);
      payload.currency = editCurrency;
    }

    setEditLoading(true);
    try {
      await syncProject(payload, "Project updated.", "Project updated");
      setIsEditing(false);
    } catch {
      toast.error("Unable to update project.");
    } finally {
      setEditLoading(false);
    }
  }

  async function uploadFiles(files: File[], kind: "attachments" | "logos") {
    if (files.length === 0) return;
    kind === "attachments" ? setAssetUploading(true) : setLogoUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const json = await response.json();
      if (!json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error ?? "Upload failed.");
      }
      if (kind === "attachments") {
        setEditAttachments((prev) => [...prev, ...json.data]);
      } else {
        setEditLogos((prev) => [...prev, ...json.data]);
      }
      toast.success(kind === "attachments" ? "Attachments uploaded." : "Logos uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      kind === "attachments" ? setAssetUploading(false) : setLogoUploading(false);
    }
  }

  async function removeUploadedFile(file: UploadFile, index: number, kind: "attachments" | "logos") {
    const current = kind === "attachments" ? editAttachments : editLogos;
    const setter = kind === "attachments" ? setEditAttachments : setEditLogos;
    const previous = current;
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    try {
      const response = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: file.url }),
      });
      const json = await response.json();
      if (!json?.success) {
        throw new Error(json?.error ?? "Unable to delete file.");
      }
      toast.success(kind === "attachments" ? "Attachment removed." : "Logo removed.");
    } catch (error) {
      setter(previous);
      toast.error(error instanceof Error ? error.message : "Unable to delete file.");
    }
  }

  async function addComment() {
    if (!commentBody.trim()) {
      toast.error("Comment is required.");
      return;
    }
    setCommentSaving(true);
    try {
      await syncProject(
        {
          comments: [
            ...(currentProject.comments ?? []),
            {
              id: `pc-${crypto.randomUUID().slice(0, 8)}`,
              body: commentBody.trim(),
              authorId: "current-user",
              authorName: "Team member",
              createdAt: new Date().toISOString(),
            },
          ],
        },
        "Comment added.",
        "Project comment added",
        commentBody.trim().slice(0, 80),
      );
      setCommentBody("");
    } catch {
      toast.error("Unable to add comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function addChecklistItem() {
    if (!checklistTitle.trim()) {
      toast.error("Checklist item is required.");
      return;
    }
    setChecklistSaving(true);
    try {
      await syncProject(
        {
          checklist: [
            ...(currentProject.checklist ?? []),
            { id: `chk-${crypto.randomUUID().slice(0, 8)}`, title: checklistTitle.trim(), done: false },
          ],
        },
        "Checklist item added.",
        "Checklist item added",
        checklistTitle.trim(),
      );
      setChecklistTitle("");
    } catch {
      toast.error("Unable to add checklist item.");
    } finally {
      setChecklistSaving(false);
    }
  }

  async function toggleChecklistItem(itemId: string, done: boolean) {
    try {
      await syncProject(
        {
          checklist: (currentProject.checklist ?? []).map((item) =>
            item.id === itemId ? { ...item, done } : item,
          ),
        },
        done ? "Checklist updated." : "Checklist reopened.",
        done ? "Checklist item completed" : "Checklist item reopened",
      );
    } catch {
      toast.error("Unable to update checklist.");
    }
  }

  async function updateStatus(id: string, status: MilestoneStatus) {
    if (!hasPermission(role, "milestones:update")) {
      toast.error("You do not have permission to update milestones.");
      return;
    }
    try {
      await api.updateMilestone(id, { status });
      setItems((prev) => prev.map((milestone) => (milestone.id === id ? { ...milestone, status } : milestone)));
      setMilestones((prev) => prev.map((milestone) => (milestone.id === id ? { ...milestone, status } : milestone)));
      toast.success("Milestone updated.");
      addActivity({
        entityType: "project",
        entityId: currentProject.id,
        action: "Milestone status updated",
        meta: `Milestone ${id} set to ${status.replace("_", " ")}`,
      });
    } catch {
      toast.error("Unable to update milestone.");
    }
  }

  async function createDraft(milestone: Milestone) {
    if (!hasPermission(role, "invoices:create")) {
      toast.error("You do not have permission to create invoice drafts.");
      return;
    }
    if (!currentProject.contactId) {
      toast.error("Add a client to this project before creating invoices.");
      return;
    }
    const invoiceNo = `VF-${new Date().getFullYear()}-${Math.random().toString(10).slice(2, 6)}`;
    try {
      const created = await api.createInvoice({
        invoiceNo,
        contactId: currentProject.contactId,
        projectId: currentProject.id,
        status: "unpaid",
        issueDate: new Date().toISOString(),
        dueDate: milestone.dueDate,
        lineItems: [],
        payments: [],
        archived: false,
      });
      setDrafts((prev) => [...prev, { id: created.id, title: milestone.title, amount: milestone.amount, currency: milestone.currency }]);
      setInvoices((prev) => [created, ...prev]);
      toast.success("Invoice draft created.");
      addActivity({ entityType: "project", entityId: currentProject.id, action: "Invoice draft created", meta: milestone.title });
    } catch {
      toast.error("Unable to create invoice draft.");
    }
  }

  async function handleCreateMilestone() {
    if (!milestoneTitle.trim()) {
      toast.error("Milestone title is required.");
      return;
    }
    const nextOrder = items.length ? Math.max(...items.map((item) => item.order)) + 1 : 1;
    try {
      const created = await api.createMilestone({
        projectId: currentProject.id,
        title: milestoneTitle.trim(),
        status: milestoneStatus,
        dueDate: milestoneDue ? new Date(milestoneDue).toISOString() : undefined,
        amount: milestoneAmount ? Number(milestoneAmount) : 0,
        currency: milestoneCurrency,
        order: nextOrder,
      });
      setItems((prev) => [...prev, created]);
      setMilestones((prev) => [...prev, created]);
      toast.success("Milestone added.");
      addActivity({ entityType: "project", entityId: currentProject.id, action: "Milestone created", meta: created.title });
      setShowMilestoneForm(false);
      setMilestoneTitle("");
      setMilestoneDue("");
      setMilestoneAmount("");
      setMilestoneCurrency("USD");
      setMilestoneStatus("pending");
    } catch {
      toast.error("Unable to create milestone.");
    }
  }

  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Project</p><h1 className="text-2xl font-semibold">{currentProject.title}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Start {formatDate(currentProject.startDate)}</span><span>-</span><span>Due {formatDate(currentProject.dueDate)}</span><span>-</span><span>{isOwner ? formatMoney(currentProject.budgetAmount ?? 0, currentProject.currency ?? "USD") : budgetTier ? `${budgetTier} budget` : "Budget hidden"}</span>{archived ? <><span>-</span><Badge variant="secondary">Archived</Badge></> : null}</div></div><div className="flex flex-wrap items-center gap-3"><DisableIfNoPermission permission="projects:edit" tooltip="Edit access required"><Button variant="outline" onClick={() => setIsEditing((prev) => !prev)}>{isEditing ? "Cancel edit" : "Edit project"}</Button></DisableIfNoPermission><DisableIfNoPermission permission="projects:archive" tooltip="Archive access required"><Button variant="outline" onClick={() => { const next = !archived; api.updateProject(currentProject.id, { archived: next }).then((updated) => { setArchived(next); setCurrentProject(updated); setProjects((prev) => prev.map((item) => (item.id === currentProject.id ? { ...item, archived: next } : item))); toast.success(next ? "Archived." : "Restored."); addActivity({ entityType: "project", entityId: currentProject.id, action: next ? "Project archived" : "Project restored" }); }).catch(() => toast.error("Unable to update project.")); }}>{archived ? "Restore" : "Archive"}</Button></DisableIfNoPermission><Can permission="projects:delete"><Button variant="destructive" onClick={() => { api.deleteProject(currentProject.id).then(() => { setProjects((prev) => prev.filter((item) => item.id !== currentProject.id)); toast.success("Deleted."); }).catch(() => toast.error("Unable to delete project.")); }}>Delete</Button></Can></div></div>{isEditing ? <Card className="space-y-4 p-6"><h2 className="text-sm font-semibold">Edit project</h2><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Title</label><Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={editStatus} onValueChange={(value) => setEditStatus(value as ProjectStatus)}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{projectStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Start date</label><Input type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Due date</label><Input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} /></div>{isOwner ? <><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Budget amount</label><Input type="number" min={0} value={editBudgetAmount} onChange={(event) => setEditBudgetAmount(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Currency</label><Input value={editCurrency} onChange={(event) => setEditCurrency(event.target.value.toUpperCase())} /></div></> : null}<div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Assignees</label><div className="flex flex-wrap gap-2 rounded-xl border bg-background p-3">{users.length === 0 ? <span className="text-xs text-muted-foreground">No team members available.</span> : users.map((user) => { const active = editAssigneeIds.includes(user.id); return <Button key={user.id} type="button" variant={active ? "default" : "outline"} size="sm" onClick={() => setEditAssigneeIds((prev) => prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id])}>{user.name}</Button>; })}</div></div><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Description</label><Textarea rows={5} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} /></div><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Links (one URL per line)</label><Textarea rows={4} value={editLinksText} onChange={(event) => setEditLinksText(event.target.value)} /></div><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Project logos</label><input type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []), "logos")} /><p className="text-xs text-muted-foreground">{logoUploading ? "Uploading logos..." : "Add multiple logos or project covers."}</p>{editLogos.length > 0 ? <div className="grid gap-3 md:grid-cols-3">{editLogos.map((file, index) => <div key={`${file.url}-${index}`} className="rounded-xl border bg-background p-2"><img src={file.url} alt={file.name} className="h-24 w-full rounded-md object-cover" /><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{file.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => void removeUploadedFile(file, index, "logos")}>Remove</Button></div></div>)}</div> : null}</div><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Attachments</label><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []), "attachments")} /><p className="text-xs text-muted-foreground">{assetUploading ? "Uploading attachments..." : "Add project docs and supporting files."}</p>{editAttachments.length > 0 ? <div className="space-y-2">{editAttachments.map((file, index) => <div key={`${file.url}-${index}`} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs"><span className="truncate font-medium text-foreground">{file.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => void removeUploadedFile(file, index, "attachments")}>Remove</Button></div>)}</div> : null}</div></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button><Button onClick={saveProjectEdits} disabled={editLoading || !canEditProject}>{editLoading ? "Saving..." : "Save changes"}</Button></div></Card> : null}<Card className="space-y-4 p-6"><h2 className="text-sm font-semibold">Project details</h2>{currentProject.logos && currentProject.logos.length > 0 ? <div className="grid gap-3 md:grid-cols-3">{currentProject.logos.map((logo, index) => <div key={`${logo.url}-${index}`} className="overflow-hidden rounded-xl border bg-background"><img src={logo.url} alt={logo.name} className="h-32 w-full object-cover" /><div className="px-3 py-2 text-xs font-medium text-foreground">{logo.name}</div></div>)}</div> : null}<div className="space-y-2 text-sm text-muted-foreground"><p>{currentProject.notes || "No description yet."}</p><div className="flex flex-wrap items-center gap-2"><UserCircle2 className="h-4 w-4" />{currentProject.assigneeIds && currentProject.assigneeIds.length > 0 ? currentProject.assigneeIds.map((assigneeId) => { const assignee = users.find((user) => user.id === assigneeId); return <Badge key={assigneeId} variant="outline">{assignee?.name ?? "Assigned"}</Badge>; }) : <span>No assignees yet.</span>}</div><div className="flex flex-wrap gap-2 text-xs">{visibleLinks.length === 0 ? <span>No links yet.</span> : <>{visibleLinks.map((link, index) => <a key={`${link}-${index}`} className="rounded-full border px-3 py-1 hover:bg-muted/40" href={link} target="_blank" rel="noreferrer">{formatLinkLabel(link, index)}</a>)}{remainingLinks > 0 ? <span>+{remainingLinks} more</span> : null}</>}</div><div className="space-y-1"><p className="text-xs font-medium text-foreground">Attachments</p>{currentProject.attachments && currentProject.attachments.length > 0 ? <div className="flex flex-wrap gap-2">{currentProject.attachments.map((item, index) => <a key={`${item.url}-${index}`} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-muted/40" href={item.url} target="_blank" rel="noreferrer">{attachmentIcon(item.type ?? "")}{item.name || formatAttachmentLabel(item.url, index)}</a>)}</div> : <p className="text-xs text-muted-foreground">-</p>}</div></div></Card><Card className="space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Checklist</h2><CheckSquare className="h-4 w-4 text-muted-foreground" /></div><div className="flex gap-2"><Input value={checklistTitle} onChange={(event) => setChecklistTitle(event.target.value)} placeholder="Add checklist item" /><Button onClick={addChecklistItem} disabled={checklistSaving || !checklistTitle.trim()}>Add</Button></div>{currentProject.checklist && currentProject.checklist.length > 0 ? <div className="space-y-2">{currentProject.checklist.map((item) => <button key={item.id} type="button" className="flex w-full items-center justify-between rounded-lg border bg-background px-4 py-3 text-left" onClick={() => void toggleChecklistItem(item.id, !item.done)}><span className={item.done ? "text-sm text-muted-foreground line-through" : "text-sm text-foreground"}>{item.title}</span><Badge variant={item.done ? "secondary" : "outline"}>{item.done ? "Done" : "Open"}</Badge></button>)}</div> : <p className="text-sm text-muted-foreground">No checklist items yet.</p>}</Card><Card className="space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Comments</h2><MessageSquare className="h-4 w-4 text-muted-foreground" /></div><Textarea rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave project notes, handoff details, or decisions." /><div className="flex justify-end"><Button onClick={addComment} disabled={commentSaving || !commentBody.trim()}>Add comment</Button></div>{currentProject.comments && currentProject.comments.length > 0 ? <div className="space-y-3">{currentProject.comments.slice().reverse().map((comment) => <div key={comment.id} className="rounded-lg border bg-background p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{comment.authorName}</span><span>{formatDate(comment.createdAt)}</span></div><p className="mt-2 text-sm text-foreground">{comment.body}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No comments yet.</p>}</Card><Card className="space-y-4 p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Milestones</h2><DisableIfNoPermission permission="milestones:update" tooltip="Milestone edit access required"><Button variant="outline" size="sm" onClick={() => setShowMilestoneForm((prev) => !prev)}>{showMilestoneForm ? "Cancel" : "Add milestone"}</Button></DisableIfNoPermission></div>{showMilestoneForm ? <div className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><label className="text-xs font-medium text-muted-foreground">Milestone title</label><Input placeholder="e.g. First draft delivery" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Due date</label><Input type="date" value={milestoneDue} onChange={(event) => setMilestoneDue(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={milestoneStatus} onValueChange={(value) => setMilestoneStatus(value as MilestoneStatus)}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{milestoneStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Amount</label><Input type="number" min={0} placeholder="0" value={milestoneAmount} onChange={(event) => setMilestoneAmount(event.target.value)} /></div><div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Currency</label><Input placeholder="USD" value={milestoneCurrency} onChange={(event) => setMilestoneCurrency(event.target.value.toUpperCase())} /></div><div className="flex justify-end md:col-span-2"><Button onClick={handleCreateMilestone}>Save milestone</Button></div></div> : null}<div className="space-y-3">{sorted.length === 0 ? <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No milestones defined.</div> : sorted.map((milestone) => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4"><div><p className="text-sm font-semibold">{milestone.title}</p><p className="text-xs text-muted-foreground">Due {formatDate(milestone.dueDate)}</p></div><div className="flex flex-wrap items-center gap-3"><MilestoneStatusBadge status={milestone.status} /><Select value={milestone.status} onValueChange={(value) => updateStatus(milestone.id, value as MilestoneStatus)} disabled={!hasPermission(role, "milestones:update")}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{milestoneStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><DisableIfNoPermission permission="invoices:create" tooltip="Invoice access required"><Button variant="outline" onClick={() => createDraft(milestone)}>Create invoice draft</Button></DisableIfNoPermission></div></div>)}</div></Card><Card className="space-y-3 p-6"><h2 className="text-sm font-semibold">Invoice Drafts</h2>{drafts.length === 0 ? <p className="text-sm text-muted-foreground">No drafts yet. Create one from a milestone.</p> : drafts.map((draft) => <div key={draft.id} className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm"><span>{draft.title}</span><span className="text-muted-foreground">{formatMoney(draft.amount, draft.currency)}</span></div>)}</Card><div className="space-y-3"><h2 className="text-sm font-semibold">Activity</h2><ActivityTimeline entityType="project" entityId={currentProject.id} /></div></div>;
}
