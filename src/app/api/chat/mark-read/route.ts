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
  if (!body?.entityType || !body?.entityId) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();
  await ChatMessageModel.updateMany(
    { entityType: body.entityType, entityId: body.entityId, readBy: { $ne: session.userId } },
    { $addToSet: { readBy: session.userId } },
  );
  return NextResponse.json({ success: true, data: { ok: true } });
}
