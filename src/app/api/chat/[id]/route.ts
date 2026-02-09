import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";
import { AuditModel } from "@/lib/models/audit";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession(req);
    if (session.role !== "owner") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const deleted = await ChatMessageModel.findByIdAndDelete(params.id).lean();
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Chat message deleted",
    entityType: deleted.entityType,
    entityId: deleted.entityId,
  });
  return NextResponse.json({ success: true, data: { id: params.id } });
}
