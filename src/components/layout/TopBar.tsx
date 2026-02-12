"use client";

import { LogOut, Plus, Search, Settings, UserCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { QuickAddSheet } from "@/components/layout/QuickAddSheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectCreatePanel } from "@/components/projects/ProjectCreatePanel";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,

  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SearchResult = {
  contacts: { id: string; name: string; company?: string }[];
  projects: { id: string; title: string }[];
  invoices: { id: string; invoiceNo: string }[];
};

type HeaderUser = {
  role: "owner" | "editor";
  name?: string;
  avatarUrl?: string;
};

type WorkspaceItem = {
  id: string;
  name: string;
  logoUrl?: string;
  role: "owner" | "editor";
  isPersonal: boolean;
  isActive: boolean;
};

export function TopBar({
  initialRole,
  initialUser,
  initialWorkspaces = [],
  initialActiveWorkspaceId = "",
}: {
  initialRole?: "owner" | "editor" | null;
  initialUser?: HeaderUser | null;
  initialWorkspaces?: WorkspaceItem[];
  initialActiveWorkspaceId?: string;
}) {
  const [user, setUser] = useState<HeaderUser | null>(
    initialUser ?? (initialRole ? { role: initialRole } : null),
  );
  const [query, setQuery] = useState("");
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(initialWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialActiveWorkspaceId);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamName, setCreateTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [results, setResults] = useState<SearchResult>({
    contacts: [],
    projects: [],
    invoices: [],
  });
  const searchRef = useRef<HTMLDivElement | null>(null);
  const hasInitialHeaderData = Boolean(initialUser) && initialWorkspaces.length > 0 && Boolean(initialActiveWorkspaceId);

  const handleQuickAddChange = (next: boolean) => {
    if (next) {
      setProjectOpen(false);
    }
    setQuickAddOpen(next);
  };

  const handleProjectOpenChange = (next: boolean) => {
    if (next) {
      setQuickAddOpen(false);
    }
    setProjectOpen(next);
  };


  useEffect(() => {
    const routes = [
      "/today",
      "/dashboard",      "/contacts",
      "/projects",
      "/profile",
      "/settings/account",
      "/settings/workspace",
    ];
    routes.forEach((route) => router.prefetch(route));
  }, [router]);

  useEffect(() => {
    if (!searchOpen) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (searchRef.current && target && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [searchOpen]);

  useEffect(() => {
    let mounted = true;

    async function loadHeaderData() {
      const meRes = await fetch("/api/auth/me").then((res) => (res.ok ? res.json() : null));
      if (mounted && meRes?.success && meRes?.data?.role) {
        setUser({
          role: meRes.data.role,
          name: meRes.data.name,
          avatarUrl: meRes.data.avatarUrl,
        });
      }

      const wsRes = await fetch("/api/workspaces", { cache: "no-store" }).then((res) =>
        res.ok ? res.json() : null,
      );
      if (mounted && wsRes?.success && Array.isArray(wsRes?.data)) {
        setWorkspaces(wsRes.data);
        const active = wsRes.data.find((item: WorkspaceItem) => item.isActive);
        setActiveWorkspaceId(active?.id ?? wsRes.data[0]?.id ?? "");
      }
    }

    if (!hasInitialHeaderData) {
      loadHeaderData().catch(() => undefined);
    }

    function handleHeaderRefresh() {
      loadHeaderData().catch(() => undefined);
    }

    window.addEventListener("scopeboard-profile-updated", handleHeaderRefresh);
    window.addEventListener("scopeboard-workspace-updated", handleHeaderRefresh as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener("scopeboard-profile-updated", handleHeaderRefresh);
      window.removeEventListener("scopeboard-workspace-updated", handleHeaderRefresh as EventListener);
    };
  }, [hasInitialHeaderData]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults({ contacts: [], projects: [], invoices: [] });
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    const handle = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.success) return;
          setResults(data.data);
          setSearchOpen(true);
        })
        .catch(() => undefined)
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  const totalResults = useMemo(
    () => results.contacts.length + results.projects.length + results.invoices.length,
    [results],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId],
  );

  async function handleWorkspaceChange(workspaceId: string) {
    if (!workspaceId) return;

    if (workspaceId === "__create__") {
      setCreateTeamOpen(true);
      return;
    }

    if (workspaceId === activeWorkspaceId) return;
    setSwitchingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "Unable to switch workspace.");
      }
      setActiveWorkspaceId(workspaceId);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  async function handleCreateTeam() {
    const name = createTeamName.trim();
    if (name.length < 2) return;

    setCreatingTeam(true);
    try {
      const createRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson?.success) {
        throw new Error(createJson?.error ?? "Unable to create workspace.");
      }

      const createdId = createJson?.data?.id as string;
      const createdName = createJson?.data?.name as string;
      if (createdId) {
        setCreateTeamOpen(false);
        setCreateTeamName("");
        if (createdName) {
          window.dispatchEvent(
            new CustomEvent("scopeboard-workspace-updated", {
              detail: { workspaceId: createdId, name: createdName },
            }),
          );
        }
        await handleWorkspaceChange(createdId);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingTeam(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/";
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b px-8 py-4 glass">
        <div ref={searchRef} className="relative flex items-center gap-3 text-sm text-muted-foreground">
          <Search className="h-4 w-4" />
          <Input
            className="h-9 w-[260px] border-none bg-muted/60"
            placeholder="Search contacts, projects, invoices..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (query.trim().length >= 2) setSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                setSearchOpen(false);
              }
            }}
          />
          {searchOpen && (
            <div className="absolute left-0 top-12 z-50 w-[420px] rounded-xl border bg-background shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
                <span>Search results</span>
                {searchLoading ? <span>Searching...</span> : <span>{totalResults} results</span>}
              </div>
              <div className="space-y-3 px-4 py-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Contacts</p>
                  <div className="mt-2 space-y-1">
                    {results.contacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matches</p>
                    ) : (
                      results.contacts.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/contacts/${item.id}`}
                          className="block rounded-md px-2 py-1 text-foreground hover:bg-muted/60"
                          onClick={() => setSearchOpen(false)}
                        >
                          {item.name}
                          {item.company ? (
                            <span className="text-xs text-muted-foreground"> - {item.company}</span>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Projects</p>
                  <div className="mt-2 space-y-1">
                    {results.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matches</p>
                    ) : (
                      results.projects.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/projects/${item.id}`}
                          className="block rounded-md px-2 py-1 text-foreground hover:bg-muted/60"
                          onClick={() => setSearchOpen(false)}
                        >
                          {item.title}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Invoices</p>
                  <div className="mt-2 space-y-1">
                    {results.invoices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No matches</p>
                    ) : (
                      results.invoices.slice(0, 3).map((item) => (
                        <Link
                          key={item.id}
                          href={`/invoices/${item.id}`}
                          className="block rounded-md px-2 py-1 text-foreground hover:bg-muted/60"
                          onClick={() => setSearchOpen(false)}
                        >
                          {item.invoiceNo}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t px-4 py-2 text-xs">
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  className="text-foreground hover:underline"
                  onClick={() => setSearchOpen(false)}
                >
                  View all results {"->"}
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {workspaces.length > 0 ? (
            <Select value={activeWorkspaceId} onValueChange={handleWorkspaceChange} disabled={switchingWorkspace}>
              <SelectTrigger className="h-9 w-[240px]">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted/60">
                    {activeWorkspace?.logoUrl ? (
                      <Image
                        src={activeWorkspace.logoUrl}
                        alt={activeWorkspace.name}
                        width={24}
                        height={24}
                        className="h-6 w-6 object-cover"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {(activeWorkspace?.name ?? "W").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {activeWorkspace?.name ?? "Workspace"}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
                <SelectItem value="__create__">+ Create team</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <NotificationBell />
                </div>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggle />
              </TooltipTrigger>
              <TooltipContent>Theme</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleProjectOpenChange(true)}
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
          <QuickAddSheet open={quickAddOpen} onOpenChange={handleQuickAddChange}>
            <Button>Quick Add</Button>
          </QuickAddSheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 overflow-hidden rounded-full border bg-muted/60 p-0"
              >
                {user?.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name ?? "Profile"}
                    width={36}
                    height={36}
                    className="h-9 w-9 object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold" suppressHydrationWarning>
                    {user?.name?.charAt(0)?.toUpperCase() ??
                      user?.role?.charAt(0)?.toUpperCase() ??
                      "U"}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name ?? "User"}</span>
                  <span className="text-xs text-muted-foreground">{user?.role ?? "member"}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserCircle2 className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/account")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {createTeamOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24">
          <div className="w-[420px] rounded-xl border bg-background p-5 shadow-xl">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Create team</p>
              <p className="text-xs text-muted-foreground">Enter a name for your new team workspace.</p>
            </div>
            <div className="mt-4 space-y-2">
              <Input
                value={createTeamName}
                onChange={(event) => setCreateTeamName(event.target.value)}
                placeholder="Team name"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateTeamOpen(false);
                  setCreateTeamName("");
                }}
                disabled={creatingTeam}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={creatingTeam || createTeamName.trim().length < 2}
              >
                {creatingTeam ? "Creating..." : "Create team"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <ProjectCreatePanel open={projectOpen} onOpenChange={handleProjectOpenChange} />
    </>
  );
}




















