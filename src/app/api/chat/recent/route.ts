import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatMessageModel } from "@/lib/models/chatMessage";

export async function GET(req: Request) {
  try {
    await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "5");
  await dbConnect();
  const messages = await ChatMessageModel.find()
    .sort({ createdAt: -1 })
    .limit(Number.isFinite(limit) ? limit : 5)
    .lean();
  const data = messages.map((msg) => ({ id: msg._id, ...msg }));
  return NextResponse.json({ success: true, data });
}
