import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/lib/models/user";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { AuditModel } from "@/lib/models/audit";
import { requireSession } from "@/lib/auth";
import { adminUserUpdateSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { normalizeRole, toDisplayRole } from "@/lib/rbac";

async function requireOwnerSession(req: Request) {
  const session = await requireSession(req);
  if (session.role !== "owner") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireOwnerSession(req);
  } catch (error) {
    const status = String(error).includes("Forbidden") ? 403 : 401;
    return NextResponse.json({ success: false, error: status === 403 ? "Forbidden" : "Unauthorized" }, { status });
  }

  const body = await req.json();
  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await dbConnect();

  const targetUser = await UserModel.findById(params.id).lean();
  if (!targetUser) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const isDirectUser = targetUser.workspaceId === session.workspaceId;

  if (isDirectUser) {
    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password) {
      updates.passwordHash = await hashPassword(parsed.data.password);
      delete updates.password;
    }

    const updated = await UserModel.findOneAndUpdate(
      { _id: params.id, workspaceId: session.workspaceId },
      updates,
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await AuditModel.create({
      _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      workspaceId: session.workspaceId,
      createdAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      actorEmail: session.email,
      action: "User updated",
      entityType: "user",
      entityId: String(updated._id),
      meta: updated.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name,
        email: updated.email,
        role: toDisplayRole(normalizeRole(updated.role)),
        isActive: updated.isActive,
        isDirect: true,
        isSelf: String(updated._id) === session.userId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  }

  const membership = await WorkspaceMembershipModel.findOne({
    userId: String(targetUser._id),
    workspaceId: session.workspaceId,
  }).lean();

  if (!membership) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const membershipUpdates: Record<string, unknown> = {};
  if (parsed.data.role) {
    membershipUpdates.role = normalizeRole(parsed.data.role);
  }
  if (typeof parsed.data.isActive === "boolean") {
    membershipUpdates.isActive = parsed.data.isActive;
  }

  if (Object.keys(membershipUpdates).length === 0) {
    return NextResponse.json(
      { success: false, error: "Only role/status can be changed for cross-workspace members." },
      { status: 400 },
    );
  }

  const updatedMembership = await WorkspaceMembershipModel.findOneAndUpdate(
    { userId: String(targetUser._id), workspaceId: session.workspaceId },
    { $set: membershipUpdates },
    { new: true },
  ).lean();

  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    workspaceId: session.workspaceId,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Workspace member updated",
    entityType: "user",
    entityId: String(targetUser._id),
    meta: targetUser.email,
  });

  return NextResponse.json({
    success: true,
    data: {
      id: String(targetUser._id),
      name: targetUser.name,
      email: targetUser.email,
      role: toDisplayRole(normalizeRole(String(updatedMembership?.role ?? "member"))),
      isActive: Boolean(updatedMembership?.isActive && targetUser.isActive),
      isDirect: false,
      isSelf: String(targetUser._id) === session.userId,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt,
    },
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let session;
  try {
    session = await requireOwnerSession(req);
  } catch (error) {
    const status = String(error).includes("Forbidden") ? 403 : 401;
    return NextResponse.json({ success: false, error: status === 403 ? "Forbidden" : "Unauthorized" }, { status });
  }

  await dbConnect();

  const targetUser = await UserModel.findById(params.id).lean();
  if (!targetUser) {
    return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
  }

  if (String(targetUser._id) === session.userId) {
    return NextResponse.json({ success: false, error: "You cannot remove yourself from this team." }, { status: 400 });
  }

  if (targetUser.workspaceId === session.workspaceId) {
    return NextResponse.json(
      { success: false, error: "This user belongs to this workspace directly and cannot be removed from membership." },
      { status: 400 },
    );
  }

  const membership = await WorkspaceMembershipModel.findOne({
    userId: String(targetUser._id),
    workspaceId: session.workspaceId,
    isActive: true,
  }).lean();

  if (!membership) {
    return NextResponse.json({ success: false, error: "Member not found in this team." }, { status: 404 });
  }

  if (membership.role === "owner") {
    const ownerCount = await WorkspaceMembershipModel.countDocuments({
      workspaceId: session.workspaceId,
      isActive: true,
      role: "owner",
    });

    if (ownerCount <= 1) {
      return NextResponse.json(
        { success: false, error: "At least one owner must remain in this team." },
        { status: 400 },
      );
    }
  }

  await WorkspaceMembershipModel.deleteOne({
    userId: String(targetUser._id),
    workspaceId: session.workspaceId,
  });

  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    workspaceId: session.workspaceId,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Workspace member removed",
    entityType: "user",
    entityId: String(targetUser._id),
    meta: targetUser.email,
  });

  return NextResponse.json({ success: true, data: { id: String(targetUser._id) } });
}
