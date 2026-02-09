"use client";

import { LogOut, Plus, Search } from "lucide-react";
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

export function TopBar({
  initialRole,
  initialUser,
}: {
  initialRole?: "owner" | "editor" | null;
  initialUser?: HeaderUser | null;
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
  const [results, setResults] = useState<SearchResult>({
    contacts: [],
    projects: [],
    invoices: [],
  });
  const searchRef = useRef<HTMLDivElement | null>(null);

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
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.success || !data?.data?.role) return;
        setUser({
          role: data.data.role,
          name: data.data.name,
          avatarUrl: data.data.avatarUrl,
        });
      })
      .catch(() => undefined);
    function handleProfileUpdate() {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.success || !data?.data?.role) return;
          setUser({
            role: data.data.role,
            name: data.data.name,
            avatarUrl: data.data.avatarUrl,
          });
        })
        .catch(() => undefined);
    }
    window.addEventListener("vaultflow-profile-updated", handleProfileUpdate);
    return () => {
      mounted = false;
      window.removeEventListener("vaultflow-profile-updated", handleProfileUpdate);
    };
  }, []);

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
                {searchLoading ? <span>Searching…</span> : <span>{totalResults} results</span>}
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
                            <span className="text-xs text-muted-foreground"> · {item.company}</span>
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
                  View all results →
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/profile"
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border bg-muted/60 text-xs font-semibold text-foreground"
                >
                  {user?.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.name ?? "Profile"}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    <span suppressHydrationWarning>
                      {user?.name?.charAt(0)?.toUpperCase() ??
                        user?.role?.charAt(0)?.toUpperCase() ??
                        "U"}
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                {user?.name ?? "Profile"} - {user?.role ?? "User"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
          <ThemeToggle />
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                    window.location.href = "/";
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Logout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
      <ProjectCreatePanel open={projectOpen} onOpenChange={handleProjectOpenChange} />
    </>
  );
}
