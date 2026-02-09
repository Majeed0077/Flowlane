import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { NotificationModel } from "@/lib/models/notification";

function serialize(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
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
  await dbConnect();
  const items = await NotificationModel.find().sort({ createdAt: -1 }).limit(20).lean();
  const data = items.map((item) => ({ id: item._id, ...item }));
  const unread = data.filter((item) => !(item.readBy ?? []).includes(session.userId)).length;
  return NextResponse.json({ success: true, data: { items: data, unread } });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  if (!body?.title || !body?.body || !body?.type) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();
  const id = `ntf-${crypto.randomUUID().slice(0, 8)}`;
  const created = await NotificationModel.create({
    _id: id,
    title: String(body.title),
    body: String(body.body),
    type: String(body.type),
    entityType: body.entityType ? String(body.entityType) : undefined,
    entityId: body.entityId ? String(body.entityId) : undefined,
    createdAt: new Date().toISOString(),
    readBy: [],
  });
  return NextResponse.json({ success: true, data: serialize(created) });
}
