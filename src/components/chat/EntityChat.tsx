"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { useRole } from "@/lib/useRole";
import { Can } from "@/components/common/PermissionGate";
import type { ChatMessage } from "@/types";

function highlightMentions(text: string) {
  const parts = text.split(/(@owner|@editor)/g);
  return parts.map((part, index) => {
    if (part === "@owner" || part === "@editor") {
      return (
        <span key={index} className="rounded bg-amber-200/30 px-1 text-amber-600">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function EntityChat({
  entityType,
  entityId,
  title,
  onAction,
}: {
  entityType: "contact" | "project";
  entityId: string;
  title: string;
  onAction?: (action: "followup" | "milestone" | "invoice", message: ChatMessage) => void;
}) {
  const role = useRole();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const pinned = useMemo(
    () => messages.find((msg) => msg.pinnedAt),
    [messages],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/chat?entityType=${entityType}&entityId=${entityId}`);
        const data = await res.json();
        if (!active) return;
        setMessages(data.data ?? []);
        await fetch("/api/chat/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
      } catch {
        if (!active) return;
        setMessages([]);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [entityType, entityId]);

  async function sendMessage() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, body: input.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Unable to send message.");
      setMessages((prev) => [...prev, data.data]);
      setInput("");
    } catch {
      toast.error("Unable to send message.");
    } finally {
      setLoading(false);
    }
  }

  async function pinMessage(message: ChatMessage) {
    try {
      const res = await fetch("/api/chat/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, messageId: message.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Unable to pin.");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id
            ? { ...msg, pinnedAt: data.data.pinnedAt }
            : { ...msg, pinnedAt: undefined },
        ),
      );
      toast.success("Pinned message.");
    } catch {
      toast.error("Unable to pin message.");
    }
  }

  async function deleteMessage(message: ChatMessage) {
    try {
      await fetch(`/api/chat/${message.id}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((msg) => msg.id !== message.id));
      toast.success("Message deleted.");
    } catch {
      toast.error("Unable to delete message.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Chat</h2>
          <p className="text-xs text-muted-foreground">Discuss {title} here.</p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      {pinned ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Pinned</p>
          <p className="mt-1">{pinned.body}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No messages yet.
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {message.senderName} · {message.senderRole}
                </span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <div className="mt-2 text-sm">{highlightMentions(message.body)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onAction?.("followup", message)}>
                  Create Follow-up
                </Button>
                {entityType === "project" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction?.("milestone", message)}
                    >
                      Add Milestone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAction?.("invoice", message)}
                    >
                      Create Invoice
                    </Button>
                  </>
                ) : null}
                <Can permission="users:manage">
                  <Button variant="ghost" size="sm" onClick={() => pinMessage(message)}>
                    Pin
                  </Button>
                </Can>
                <Can permission="users:manage">
                  <Button variant="ghost" size="sm" onClick={() => deleteMessage(message)}>
                    Delete
                  </Button>
                </Can>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message… Use @owner or @editor"
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? "Sending..." : "Send message"}
          </Button>
        </div>
      </div>
    </div>
  );
}
