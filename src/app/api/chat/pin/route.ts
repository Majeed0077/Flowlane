import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
    if (session.role !== "owner") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body?.messageId || !body?.entityType || !body?.entityId) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();
  await ChatMessageModel.updateMany(
    { entityType: body.entityType, entityId: body.entityId },
    { $unset: { pinnedAt: "" } },
  );
  const updated = await ChatMessageModel.findByIdAndUpdate(
    body.messageId,
    { pinnedAt: new Date().toISOString() },
    { new: true },
  ).lean();
  if (!updated) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { id: updated._id, pinnedAt: updated.pinnedAt } });
}
