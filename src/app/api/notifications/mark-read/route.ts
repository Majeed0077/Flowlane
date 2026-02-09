import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { NotificationModel } from "@/lib/models/notification";

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  await NotificationModel.updateMany(
    { readBy: { $ne: session.userId } },
    { $addToSet: { readBy: session.userId } },
  );
  return NextResponse.json({ success: true, data: { ok: true } });
}
