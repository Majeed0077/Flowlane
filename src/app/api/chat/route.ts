import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";
import { AuditModel } from "@/lib/models/audit";

function serialize(doc: any) {
  const obj = doc.toObject();
  const { _id, __v, ...rest } = obj;
  return { id: _id, ...rest };
}

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
  const items = await ChatMessageModel.find({ entityType, entityId })
    .sort({ createdAt: 1 })
    .lean();
  const data = items.map((item) => ({ id: item._id, ...item }));
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body?.entityType || !body?.entityId || !body?.body) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();
  const id = `msg-${crypto.randomUUID().slice(0, 8)}`;
  const created = await ChatMessageModel.create({
    _id: id,
    entityType: body.entityType,
    entityId: body.entityId,
    body: String(body.body),
    senderId: session.userId,
    senderName: session.name,
    senderRole: session.role,
    createdAt: new Date().toISOString(),
    readBy: [session.userId],
  });
  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Chat message sent",
    entityType: body.entityType,
    entityId: body.entityId,
    meta: String(body.body).slice(0, 140),
  });
  return NextResponse.json({ success: true, data: serialize(created) });
}
