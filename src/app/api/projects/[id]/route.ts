import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ProjectModel } from "@/lib/models/project";
import { projectUpdateWithRemovalsSchema } from "@/lib/validation";
import { requireRole, requireSession } from "@/lib/auth";
import { assertCanWriteProjectFinanceFields, sanitizeProjectForRole } from "@/lib/rbac";

function serialize(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, links, attachments, logos, comments, checklist, assigneeIds, ...rest } = obj;
  const normalizedLinks = Array.isArray(links)
    ? links
    : links
      ? Object.values(links).filter(Boolean)
      : [];
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
        .map((item: any) => {
          if (typeof item === "string") {
            const name = item.split("/").filter(Boolean).pop() ?? "Attachment";
            return { id: undefined, name, url: item, type: "", size: 0 };
          }
          return item;
        })
        .filter(Boolean)
    : [];
  const normalizedLogos = Array.isArray(logos)
    ? logos
        .map((item: any) => {
          if (typeof item === "string") {
            const name = item.split("/").filter(Boolean).pop() ?? "Logo";
            return { id: undefined, name, url: item, type: "", size: 0 };
          }
          return item;
        })
        .filter(Boolean)
    : [];
  return {
    id: _id,
    ...rest,
    links: normalizedLinks,
    attachments: normalizedAttachments,
    logos: normalizedLogos,
    comments: Array.isArray(comments) ? comments : [],
    checklist: Array.isArray(checklist) ? checklist : [],
    assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
  };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const project = await ProjectModel.findOne({ _id: params.id, workspaceId: session.workspaceId });
  if (!project) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const serialized = serialize(project);
  return NextResponse.json({
    success: true,
    data: sanitizeProjectForRole(serialized, session.role),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const body = await req.json();
  const parsed = projectUpdateWithRemovalsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    assertCanWriteProjectFinanceFields(parsed.data, session.role);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Forbidden" },
      { status: 400 },
    );
  }

  const { removeAttachmentUrls, ...rest } = parsed.data;
  const basePayload = rest.contactId ? { ...rest, clientName: undefined } : rest;
  let update: Record<string, unknown>;
  if (removeAttachmentUrls && removeAttachmentUrls.length > 0) {
    update = {
      ...(Object.keys(basePayload).length > 0 ? { $set: basePayload } : {}),
      $pull: { attachments: { url: { $in: removeAttachmentUrls } } },
    };
  } else {
    update = basePayload;
  }

  const updated = await ProjectModel.findOneAndUpdate(
    { _id: params.id, workspaceId: session.workspaceId },
    update,
    { new: true },
  );
  if (!updated) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const serialized = serialize(updated);
  return NextResponse.json({
    success: true,
    data: sanitizeProjectForRole(serialized, session.role),
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireRole(req, "Owner");
  } catch {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await dbConnect();
  const deleted = await ProjectModel.findOneAndDelete({ _id: params.id, workspaceId: session.workspaceId });
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { id: params.id } });
}
