import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/lib/models/user";
import { requireSession } from "@/lib/auth";
import { userProfileUpdateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const user = await UserModel.findById(session.userId).lean();
  if (!user) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role?.toLowerCase?.() === "owner" ? "owner" : "editor",
      avatarUrl: user.avatarUrl ?? "",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = userProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await dbConnect();
  const updated = await UserModel.findByIdAndUpdate(
    session.userId,
    {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {}),
    },
    { new: true },
  ).lean();
  if (!updated) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role?.toLowerCase?.() === "owner" ? "owner" : "editor",
      avatarUrl: updated.avatarUrl ?? "",
      updatedAt: updated.updatedAt,
    },
  });
}
