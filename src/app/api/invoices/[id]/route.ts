import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { InvoiceModel } from "@/lib/models/invoice";
import { invoiceUpdateSchema } from "@/lib/validation";
import { assertCanWriteInvoiceFields, sanitizeInvoiceForRole, type Role } from "@/lib/rbac";
import { requireRole, requireSession } from "@/lib/auth";

function serialize(doc: any) {
  const obj = doc.toObject();
  const { _id, __v, ...rest } = obj;
  return { id: _id, ...rest };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const invoice = await InvoiceModel.findById(params.id);
  if (!invoice) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const serialized = serialize(invoice);
  return NextResponse.json({
    success: true,
    data: sanitizeInvoiceForRole(serialized, session.role as Role),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const body = await req.json();
  const parsed = invoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    assertCanWriteInvoiceFields(
      parsed.data as Record<string, unknown>,
      session.role as Role,
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
  const updated = await InvoiceModel.findByIdAndUpdate(params.id, parsed.data, { new: true });
  if (!updated) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const serialized = serialize(updated);
  return NextResponse.json({
    success: true,
    data: sanitizeInvoiceForRole(serialized, session.role as Role),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole(req, "Owner");
  } catch {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  await dbConnect();
  const deleted = await InvoiceModel.findByIdAndDelete(params.id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { id: params.id } });
}
