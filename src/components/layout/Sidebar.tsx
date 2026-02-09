"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Layers,
  Users,
  FolderKanban,
  Receipt,
  CalendarCheck,
  ShieldCheck,
  Settings,
  UsersRound,
  CreditCard,
  Database,
  MessageCircle,
  Upload,
  Download,
  PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useLocalData } from "@/lib/localDataStore";
import { toast } from "sonner";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/crm", label: "Pipeline", icon: Layers },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/invoices", label: "Invoices", icon: Receipt },
];

const ownerItems = [
  { href: "/audit", label: "Audit Log", icon: ShieldCheck },
  { href: "/admin/users", label: "Team", icon: UsersRound },
  { href: "/admin/settings", label: "Admin Settings", icon: Settings },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/backup", label: "Backup", icon: Database },
];

export function Sidebar({ initialRole }: { initialRole?: "owner" | "editor" | null }) {
  const pathname = usePathname();
  const [role, setRole] = useState<"owner" | "editor" | null>(initialRole ?? null);
  const isOwner = role === "owner";
  const { contacts, projects, milestones, invoices } = useLocalData();
  const [chatUnread, setChatUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.success || !data?.data?.role) return;
        setRole(data.data.role);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetch("/api/chat/unread?entityType=global&entityId=workspace")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success) return;
        setChatUnread(data.data?.unread ?? 0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("vaultflow-sidebar-collapsed");
    setCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("vaultflow-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r bg-background py-6 transition-all duration-200",
        collapsed ? "w-16 px-2" : "w-64 px-4",
      )}
    >
      <div className="relative flex items-center justify-center">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-2")}>
          <div
            className={cn(
              "flex items-center rounded-xl bg-background",
              collapsed ? "h-10 w-10 justify-center" : "h-12 w-[200px]",
            )}
          >
            <Image
              src={collapsed ? "/icon a.png" : "/Logo.png"}
              alt="VaultFlow"
              width={collapsed ? 32 : 200}
              height={collapsed ? 32 : 48}
              className={cn("object-contain", collapsed ? "h-8 w-8" : "h-10 w-auto")}
              priority
            />
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute right-3 text-muted-foreground hover:text-foreground",
          collapsed ? "top-16" : "top-6",
        )}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <PanelRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-180")} />
      </Button>

      <nav className={cn("mt-8 flex flex-1 flex-col gap-1", collapsed && "items-center")}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-muted text-foreground",
                collapsed && "w-10 justify-center px-0",
              )}
            >
              <Icon className="h-4 w-4" />
              {!collapsed ? <span className="flex-1">{item.label}</span> : null}
              {item.href === "/chat" && chatUnread > 0 ? (
                <Badge variant="secondary">{chatUnread}</Badge>
              ) : null}
            </Link>
          );
        })}
        {isOwner &&
          ownerItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground",
                  collapsed && "w-10 justify-center px-0",
                )}
              >
                <Icon className="h-4 w-4" />
                {!collapsed ? item.label : null}
              </Link>
            );
          })}
      </nav>


      {isOwner && !collapsed && (
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-xs"
            onClick={() => {
              const data = { contacts, projects, milestones, invoices };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "vaultflow-data.json";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            Export data
          </Button>
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 cursor-pointer">
            <Upload className="h-4 w-4" />
            Import data
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const parsed = JSON.parse(reader.result as string);
                    toast.message("Import is not available in live mode.");
                  } catch {
                    toast.error("Invalid data file.");
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
      )}
    </aside>
  );
}
