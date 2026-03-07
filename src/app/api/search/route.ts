import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ContactModel } from "@/lib/models/contact";
import { ProjectModel } from "@/lib/models/project";
import { InvoiceModel } from "@/lib/models/invoice";
import { MilestoneModel } from "@/lib/models/milestone";
import { requireSession } from "@/lib/auth";
import { sanitizeInvoiceForRole } from "@/lib/rbac";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({
      success: true,
      data: { contacts: [], projects: [], invoices: [], milestones: [] },
    });
  }

  await dbConnect();
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const scope = { workspaceId: session.workspaceId };
  const [contacts, projects, invoices, milestones] = await Promise.all([
    ContactModel.find({ ...scope, $or: [{ name: regex }, { company: regex }] }).limit(20).lean(),
    ProjectModel.find({
      ...scope,
      $or: [{ title: regex }, { clientName: regex }, { notes: regex }, { "comments.body": regex }],
    }).limit(20).lean(),
    InvoiceModel.find({ ...scope, invoiceNo: regex }).limit(20).lean(),
    MilestoneModel.find({ ...scope, title: regex }).limit(20).lean(),
  ]);

  const sanitizedInvoices = invoices.map((item) =>
    sanitizeInvoiceForRole({ id: item._id, ...item }, session.role),
  );

  return NextResponse.json({
    success: true,
    data: {
      contacts: contacts.map((item) => ({ id: item._id, ...item })),
      projects: projects.map((item) => ({ id: item._id, ...item })),
      invoices: sanitizedInvoices,
      milestones: milestones.map((item) => ({ id: item._id, ...item })),
    },
  });
}
