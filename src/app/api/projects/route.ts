import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { ProjectModel } from "@/lib/models/project";
import { projectCreateSchema } from "@/lib/validation";
import { requireSession } from "@/lib/auth";
import { assertCanWriteProjectFinanceFields, sanitizeProjectForRole } from "@/lib/rbac";

function serialize(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, links, attachments, ...rest } = obj;
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
  return { id: _id, ...rest, links: normalizedLinks, attachments: normalizedAttachments };
}

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const projects = await ProjectModel.find().lean();
  const data = projects.map((item) =>
    sanitizeProjectForRole({ id: item._id, ...item }, session.role),
  );
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const body = await req.json();
  const parsed = projectCreateSchema.safeParse(body);
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
  const id = `p-${crypto.randomUUID().slice(0, 8)}`;
  const payload = parsed.data.contactId
    ? { ...parsed.data, clientName: undefined }
    : { ...parsed.data, contactId: undefined };
  const created = await ProjectModel.create({ _id: id, ...payload });
  const serialized = serialize(created);
  return NextResponse.json({
    success: true,
    data: sanitizeProjectForRole(serialized, session.role),
  });
}
