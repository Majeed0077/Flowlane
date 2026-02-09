import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ContactModel } from "@/lib/models/contact";
import { ProjectModel } from "@/lib/models/project";
import { InvoiceModel } from "@/lib/models/invoice";
import { MilestoneModel } from "@/lib/models/milestone";
import { ActivityModel } from "@/lib/models/activity";
import { UserModel } from "@/lib/models/user";
import { SettingsModel } from "@/lib/models/settings";
import { AuditModel } from "@/lib/models/audit";
import { ChatMessageModel } from "@/lib/models/chatMessage";
import { NotificationModel } from "@/lib/models/notification";

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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }
  await dbConnect();

  const bulkUpsert = async (Model: any, docs: any[]) => {
    if (!Array.isArray(docs) || docs.length === 0) return;
    const operations = docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: doc,
        upsert: true,
      },
    }));
    await Model.bulkWrite(operations);
  };

  await bulkUpsert(ContactModel, body.contacts ?? []);
  await bulkUpsert(ProjectModel, body.projects ?? []);
  await bulkUpsert(InvoiceModel, body.invoices ?? []);
  await bulkUpsert(MilestoneModel, body.milestones ?? []);
  await bulkUpsert(ActivityModel, body.activities ?? []);
  await bulkUpsert(ChatMessageModel, body.chat ?? []);
  await bulkUpsert(NotificationModel, body.notifications ?? []);
  await bulkUpsert(UserModel, body.users ?? []);
  await bulkUpsert(SettingsModel, body.settings ?? []);

  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Backup import",
    entityType: "backup",
  });

  return NextResponse.json({ success: true, data: { importedAt: new Date().toISOString() } });
}
