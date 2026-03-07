"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, MoreHorizontal } from "lucide-react";
import type { Project, ProjectStatus } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectStatusBadge } from "@/components/common/StatusBadge";
import { formatMoney, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";
import { Can } from "@/components/common/PermissionGate";
import { useRole } from "@/lib/useRole";
import { hasPermission } from "@/lib/rbac";
import { useLocalData } from "@/lib/localDataStore";
import { api } from "@/lib/api";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusOptions: { value: ProjectStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const boardStages: { id: ProjectStatus; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "active", label: "Active" },
  { id: "on_hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
];

export function ProjectsList({
  projects,
  budgetTierById,
  isOwner,
}: {
  projects: Project[];
  budgetTierById?: Record<string, "Low" | "Medium" | "High">;
  isOwner: boolean;
}) {
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [visibility, setVisibility] = useState<"active" | "archived">("active");
  const [view, setView] = useState<"board" | "list">("board");
  const role = useRole();
  const { setProjects } = useLocalData();
  const canMove = hasPermission(role, "projects:edit");
  const canDelete = hasPermission(role, "projects:delete");
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        setTeamMembers(
          data.data.map((item: { id: string; name: string }) => ({
            id: item.id,
            name: item.name,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const byStatus = status === "all" ? projects : projects.filter((project) => project.status === status);
    return byStatus.filter((project) =>
      visibility === "archived" ? project.archived : !project.archived,
    );
  }, [projects, status, visibility]);

  const columns = useMemo(() => {
    return boardStages.reduce<Record<ProjectStatus, Project[]>>((acc, stage) => {
      acc[stage.id] = filtered.filter((project) => project.status === stage.id);
      return acc;
    }, {} as Record<ProjectStatus, Project[]>);
  }, [filtered]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (!canMove) {
      toast.error("Only the owner can do this.");
      return;
    }

    const newStatus = over.id as ProjectStatus;
    const projectId = active.id as string;
    const current = projects.find((project) => project.id === projectId);
    if (!current || current.status === newStatus) return;

    const previousStatus = current.status;

    // Optimistic UI update for instant drag-drop feedback.
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: newStatus } : project,
      ),
    );

    try {
      await api.updateProject(projectId, { status: newStatus });
    } catch {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId ? { ...project, status: previousStatus } : project,
        ),
      );
      toast.error("Unable to update project.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-xl px-4 py-3">
        <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus | "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Can permission="projects:delete">
          <Select
            value={visibility}
            onValueChange={(value) => setVisibility(value as "active" | "archived")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </Can>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={view === "board" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("board")}
          >
            Board
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Start a project to track milestones and budgets."
        />
      ) : view === "list" ? (
        <div className="grid gap-4">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-xl border bg-background p-5 shadow-sm transition hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(project.dueDate)}
                  </p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
              <ProjectCardMeta project={project} teamMembers={teamMembers} compact />
              <div className="mt-4 text-xs text-muted-foreground">
                Budget{" "}
                {isOwner
                  ? formatMoney(project.budgetAmount ?? 0, project.currency ?? "USD")
                  : budgetTierById?.[project.id] ?? "Hidden"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid gap-4 xl:grid-cols-4">
            {boardStages.map((stage) => (
              <ProjectColumn
                key={stage.id}
                stage={stage.id}
                label={stage.label}
                count={columns[stage.id]?.length ?? 0}
              >
                {columns[stage.id]?.length ? (
                  columns[stage.id].map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      canMove={canMove}
                      canDelete={canDelete}
                      isOwner={isOwner}
                      budgetTier={budgetTierById?.[project.id]}
                      teamMembers={teamMembers}


                      onDelete={async () => {
                        try {
                          await api.deleteProject(project.id);
                          setProjects((prev) => prev.filter((item) => item.id !== project.id));
                          toast.success("Project deleted.");
                        } catch {
                          toast.error("Unable to delete project.");
                        }
                      }}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                    No projects
                  </div>
                )}
              </ProjectColumn>
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function ProjectColumn({
  stage,
  label,
  count,
  children,
}: {
  stage: ProjectStatus;
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

function ProjectCard({
  project,
  canMove,
  canDelete,
  isOwner,
  budgetTier,
  teamMembers,
  onDelete,
}: {
  project: Project;
  canMove: boolean;
  canDelete: boolean;
  isOwner: boolean;
  budgetTier?: "Low" | "Medium" | "High";
  teamMembers: { id: string; name: string }[];
  onDelete: () => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });
  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (isDragging) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-project-menu]")) return;
    if (target.closest("[data-project-drag-handle]")) return;
    router.push(`/projects/${project.id}`);
  }

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={cn(
        "rounded-lg border bg-background p-4 shadow-sm transition",
        "cursor-pointer",
        isDragging && "opacity-60",
      )}
      onClick={handleCardClick}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{project.title}</p>
            <p className="text-xs text-muted-foreground">
              Due {formatDate(project.dueDate)}
            </p>
          </div>
          <div className="flex items-center gap-1" data-project-menu onPointerDown={(event) => event.stopPropagation()}>
            {canMove ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                data-project-drag-handle
                aria-label="Drag project card"
                {...listeners}
                {...attributes}
                onClick={(event) => event.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            ) : null}
            <ProjectStatusBadge status={project.status} />


            {canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Budget{" "}
          {isOwner
            ? formatMoney(project.budgetAmount ?? 0, project.currency ?? "USD")
            : budgetTier ?? "Hidden"}
        </div>
        <ProjectCardMeta project={project} teamMembers={teamMembers} />
      </div>
    </Card>
  );
}

function ProjectCardMeta({
  project,
  teamMembers,
  compact = false,
}: {
  project: Project;
  teamMembers: { id: string; name: string }[];
  compact?: boolean;
}) {
  const logos = project.logos ?? [];
  const checklist = project.checklist ?? [];
  const completedChecklist = checklist.filter((item) => item.done).length;
  const assignees = (project.assigneeIds ?? [])
    .map((id) => teamMembers.find((member) => member.id === id))
    .filter((member): member is { id: string; name: string } => Boolean(member));

  return (
    <div className={cn("mt-3 space-y-3", compact && "mt-4")}>
      <div className="flex items-center gap-3">
        {logos.length > 0 ? (
          <img
            src={logos[0].url}
            alt={logos[0].name || project.title}
            className={cn(
              "rounded-md border object-cover",
              compact ? "h-10 w-10" : "h-12 w-12",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-md border bg-muted/50 text-[10px] font-semibold text-muted-foreground",
              compact ? "h-10 w-10" : "h-12 w-12",
            )}
          >
            {project.title.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {assignees.length > 0 ? (
              assignees.slice(0, compact ? 2 : 3).map((assignee) => (
                <span
                  key={assignee.id}
                  className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {assignee.name}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">No assignee</span>
            )}
            {assignees.length > (compact ? 2 : 3) ? (
              <span className="text-[11px] text-muted-foreground">
                +{assignees.length - (compact ? 2 : 3)}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Checklist</span>
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-emerald-500"
                style={{
                  width: `${checklist.length === 0 ? 0 : (completedChecklist / checklist.length) * 100}%`,
                }}
              />
            </div>
            <span>
              {completedChecklist}/{checklist.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}











