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

export async function GET(req: Request) {
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
  const [contacts, projects, invoices, milestones, activities, users, settings, chat, notifications] =
    await Promise.all([
      ContactModel.find().lean(),
      ProjectModel.find().lean(),
      InvoiceModel.find().lean(),
      MilestoneModel.find().lean(),
      ActivityModel.find().lean(),
      UserModel.find().lean(),
      SettingsModel.find().lean(),
      ChatMessageModel.find().lean(),
      NotificationModel.find().lean(),
    ]);

  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Backup export",
    entityType: "backup",
  });

  return NextResponse.json({
    success: true,
    data: {
      version: 1,
      exportedAt: new Date().toISOString(),
      contacts,
      projects,
      invoices,
      milestones,
      activities,
      chat,
      notifications,
      users,
      settings,
    },
  });
}
