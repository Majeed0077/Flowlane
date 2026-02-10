import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SettingsModel } from "@/lib/models/settings";
import { AuditModel } from "@/lib/models/audit";
import { requireSession } from "@/lib/auth";
import { adminSettingsSchema } from "@/lib/validation";

const SETTINGS_ID = "settings";

export async function GET(req: Request) {
  try {
    await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const existing = await SettingsModel.findById(SETTINGS_ID).lean();
  if (!existing) {
    const created = await SettingsModel.create({
      _id: SETTINGS_ID,
      orgName: "Flowlane",
      timezone: "UTC",
      logoUrl: "",
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({
      success: true,
      data: {
        orgName: created.orgName,
        timezone: created.timezone,
        logoUrl: created.logoUrl,
        updatedAt: created.updatedAt,
      },
    });
  }
  return NextResponse.json({
    success: true,
    data: {
      orgName: existing.orgName,
      timezone: existing.timezone,
      logoUrl: existing.logoUrl,
      updatedAt: existing.updatedAt,
    },
  });
}

export async function PUT(req: Request) {
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
  const parsed = adminSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await dbConnect();
  const updated = await SettingsModel.findByIdAndUpdate(
    SETTINGS_ID,
    { ...parsed.data, updatedAt: new Date().toISOString() },
    { upsert: true, new: true },
  ).lean();
  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Settings updated",
    entityType: "settings",
    entityId: SETTINGS_ID,
  });
  return NextResponse.json({
    success: true,
    data: {
      orgName: updated.orgName,
      timezone: updated.timezone,
      logoUrl: updated.logoUrl,
      updatedAt: updated.updatedAt,
    },
  });
}
