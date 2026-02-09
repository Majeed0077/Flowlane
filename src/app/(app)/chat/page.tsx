"use client";

import { useEffect, useState } from "react";
import { SidebarChat } from "@/components/chat/SidebarChat";
import { Card } from "@/components/ui/card";

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team Chat</h1>
        <p className="text-sm text-muted-foreground">
          Mention @owner, @editor or #project to keep context.
        </p>
      </div>
      <Card className="flex-1 min-h-0 p-6">
        {mounted ? <SidebarChat fullHeight /> : null}
      </Card>
    </div>
  );
}
