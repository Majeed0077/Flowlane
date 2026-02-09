import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json({ success: false, error: "Missing params" }, { status: 400 });
  }
  await dbConnect();
  const unread = await ChatMessageModel.countDocuments({
    entityType,
    entityId,
    readBy: { $ne: session.userId },
  });
  return NextResponse.json({ success: true, data: { unread } });
}
