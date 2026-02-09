"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { ChatMessage } from "@/types";
import { useLocalData } from "@/lib/localDataStore";
import { useRole } from "@/lib/useRole";

function highlightMentions(text: string) {
  const parts = text.split(/(@[a-zA-Z0-9_.-]+|#[a-zA-Z0-9_.-]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={index} className="rounded bg-amber-200/30 px-1 text-amber-600">
          {part}
        </span>
      );
    }
    if (part.startsWith("#")) {
      return (
        <span key={index} className="rounded bg-sky-200/30 px-1 text-sky-600">
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function SidebarChat({ fullHeight = false }: { fullHeight?: boolean }) {
  const role = useRole();
  const { projects } = useLocalData();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<string[]>(["owner", "editor"]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trigger, setTrigger] = useState<"@" | "#" | null>(null);
  const [query, setQuery] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const me = await fetch("/api/auth/me").then((res) => (res.ok ? res.json() : null));
        if (me?.success?.toString?.() || me?.success === true) {
          setCurrentUserId(me.data?.id ?? null);
        }
        const res = await fetch("/api/chat?entityType=global&entityId=workspace");
        const data = await res.json();
        if (!active) return;
        setMessages(data.data ?? []);
        await fetch("/api/chat/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "global", entityId: "workspace" }),
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
  }, []);

  useEffect(() => {
    if (!stickToBottom) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, stickToBottom]);

  useEffect(() => {
    if (role !== "owner") return;
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.success || !Array.isArray(data.data)) return;
        const names = data.data.map((user: any) => user.name).filter(Boolean);
        setUsers((prev) => Array.from(new Set([...prev, ...names])));
      })
      .catch(() => undefined);
  }, [role]);

  useEffect(() => {
    const before = input.slice(0, caretIndex);
    const match = before.match(/(^|\s)([@#])([^\s]*)$/);
    if (!match) {
      setShowSuggestions(false);
      setTrigger(null);
      setQuery("");
      return;
    }
    setTrigger(match[2] as "@" | "#");
    setQuery(match[3] ?? "");
    setShowSuggestions(true);
  }, [input, caretIndex]);

  const filteredUsers = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter((name) => name.toLowerCase().includes(q)).slice(0, 6);
  }, [users, query]);

  const filteredProjects = useMemo(() => {
    const q = query.toLowerCase();
    return projects
      .filter((project) => project.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [projects, query]);

  function insertMention(value: string) {
    const before = input.slice(0, caretIndex);
    const after = input.slice(caretIndex);
    const replaced = before.replace(/(^|\s)([@#])([^\s]*)$/, `$1${value} `);
    const next = replaced + after;
    setInput(next);
    setShowSuggestions(false);
    setTrigger(null);
    setQuery("");
  }

  async function sendMessage() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "global",
          entityId: "workspace",
          body: input.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("Unable to send message.");
      setMessages((prev) => [...prev, data.data]);
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New chat message",
          body: input.trim().slice(0, 120),
          type: "chat_message",
          entityType: "global",
          entityId: "workspace",
        }),
      }).catch(() => undefined);
      setInput("");
    } catch {
      toast.error("Unable to send message.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={[
        "rounded-xl border bg-card p-4 text-xs text-muted-foreground",
        fullHeight ? "flex h-full flex-col" : "",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-foreground">Team chat</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use @ to mention users, # to mention projects.
      </p>
      <div
        className={[
          "mt-3 space-y-2 overflow-y-auto",
          fullHeight ? "flex-1 min-h-0" : "max-h-40",
        ].join(" ")}
        ref={listRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
          setStickToBottom(atBottom);
        }}
      >
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          (fullHeight ? messages : messages.slice(-6)).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${currentUserId && msg.senderId === currentUserId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-md border px-2 py-2 ${
                  currentUserId && msg.senderId === currentUserId
                    ? "bg-primary/10 text-foreground"
                    : "bg-background text-foreground"
                }`}
              >
                <div className="text-[11px] text-muted-foreground">
                  {msg.senderName} · {formatDate(msg.createdAt)}
                </div>
                <div className="text-xs text-foreground">
                  {highlightMentions(msg.body)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-3 space-y-2">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onClick={(event) => setCaretIndex((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyUp={(event) => setCaretIndex((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
            placeholder="Type a message..."
            rows={2}
          />
          {showSuggestions && trigger === "@" && (
            <div className="absolute bottom-[110%] left-0 w-full rounded-lg border bg-background shadow-lg">
              {filteredUsers.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No users found</div>
              ) : (
                filteredUsers.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted/60"
                    onClick={() => insertMention(`@${name.replace(/\s+/g, "_")}`)}
                  >
                    @{name}
                  </button>
                ))
              )}
            </div>
          )}
          {showSuggestions && trigger === "#" && (
            <div className="absolute bottom-[110%] left-0 w-full rounded-lg border bg-background shadow-lg">
              {filteredProjects.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">No projects found</div>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted/60"
                    onClick={() =>
                      insertMention(`#${project.title.replace(/\s+/g, "_")}`)
                    }
                  >
                    #{project.title}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
