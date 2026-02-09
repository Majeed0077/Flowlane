import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const entityType = body?.entityType;
  const ids = body?.ids;
  if (!entityType || !Array.isArray(ids)) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();
  const messages = await ChatMessageModel.find({ entityType, entityId: { $in: ids } })
    .sort({ createdAt: -1 })
    .lean();

  const summary: Record<
    string,
    { lastMessage?: string; lastAt?: string; unread?: number }
  > = {};

  for (const msg of messages) {
    const id = msg.entityId;
    if (!summary[id]) {
      summary[id] = {
        lastMessage: msg.body,
        lastAt: msg.createdAt,
        unread: 0,
      };
    }
    const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
    if (!readBy.includes(session.userId)) {
      summary[id].unread = (summary[id].unread ?? 0) + 1;
    }
  }

  return NextResponse.json({ success: true, data: summary });
}
