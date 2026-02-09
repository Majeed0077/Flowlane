"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
    try {
      await api.updateProject(projectId, { status: newStatus });
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId ? { ...project, status: newStatus } : project,
        ),
      );
      toast.success("Project status updated.");
    } catch {
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(project.dueDate)}
                  </p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>
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
                      isOwner={isOwner}
                      budgetTier={budgetTierById?.[project.id]}
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
  isOwner,
  budgetTier,
}: {
  project: Project;
  canMove: boolean;
  isOwner: boolean;
  budgetTier?: "Low" | "Medium" | "High";
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
  });

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
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{project.title}</p>
            <p className="text-xs text-muted-foreground">
              Due {formatDate(project.dueDate)}
            </p>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="text-xs text-muted-foreground">
          Budget{" "}
          {isOwner
            ? formatMoney(project.budgetAmount ?? 0, project.currency ?? "USD")
            : budgetTier ?? "Hidden"}
        </div>
        <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-xs">
          <Link href={`/projects/${project.id}`}>Open</Link>
        </Button>
      </div>
    </Card>
  );
}
