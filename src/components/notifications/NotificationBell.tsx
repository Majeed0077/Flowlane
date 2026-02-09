"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { api } from "@/lib/api";
import type { Notification } from "@/types";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const res = await api.getNotifications();
      setItems(res.items ?? []);
      setUnread(res.unread ?? 0);
    } catch {
      setItems([]);
      setUnread(0);
    }
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => refresh(), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh().then(() => api.markNotificationsRead().catch(() => undefined));
  }, [open]);

  return (
    <DropdownMenu onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rose-500 px-1 text-[10px] text-white">
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <div className="px-3 py-2 text-xs text-muted-foreground">Notifications</div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">No notifications yet.</div>
        ) : (
          items.slice(0, 8).map((item) => (
            <DropdownMenuItem key={item.id} className="flex flex-col items-start gap-1">
              <span className="text-xs font-medium text-foreground">{item.title}</span>
              <span className="text-[11px] text-muted-foreground">{item.body}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDate(item.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        {items.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 text-[11px] text-muted-foreground">
              Showing latest {Math.min(items.length, 8)}
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
