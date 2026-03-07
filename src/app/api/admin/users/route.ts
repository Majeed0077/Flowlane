import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/lib/models/user";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { AuditModel } from "@/lib/models/audit";
import { requireSession } from "@/lib/auth";
import { adminUserCreateSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { normalizeRole, toDisplayRole } from "@/lib/rbac";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const directUsers = await UserModel.find({ workspaceId: session.workspaceId })
    .sort({ createdAt: -1 })
    .lean();

  const memberships = await WorkspaceMembershipModel.find({
    workspaceId: session.workspaceId,
    isActive: true,
  }).lean();

  const directUserIds = new Set(directUsers.map((user) => String(user._id)));
  const memberIds = memberships
    .map((membership) => String(membership.userId))
    .filter((id) => !directUserIds.has(id));

  const memberUsers =
    memberIds.length > 0
      ? await UserModel.find({ _id: { $in: memberIds }, isActive: true }).lean()
      : [];

  const membershipByUserId = new Map(
    memberships.map((membership) => [String(membership.userId), membership]),
  );

  const data = [...directUsers, ...memberUsers]
    .map((user) => {
      const isDirect = user.workspaceId === session.workspaceId;
      const membership = membershipByUserId.get(String(user._id));

      return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: isDirect
          ? toDisplayRole(normalizeRole(String(user.role)))
          : toDisplayRole(normalizeRole(String(membership?.role ?? "member"))),
        isActive: isDirect ? Boolean(user.isActive) : Boolean(membership?.isActive && user.isActive),
        isDirect,
        isSelf: String(user._id) === session.userId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    })
    .sort(
      (a, b) =>
        new Date(String(b.createdAt ?? 0)).getTime() -
        new Date(String(a.createdAt ?? 0)).getTime(),
    );

  return NextResponse.json({ success: true, data });
}

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
  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await dbConnect();
  const email = parsed.data.email.toLowerCase();

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    if (existing.workspaceId === session.workspaceId) {
      return NextResponse.json({ success: false, error: "Email already exists." }, { status: 409 });
    }

    await WorkspaceMembershipModel.updateOne(
      { userId: String(existing._id), workspaceId: session.workspaceId },
      {
        $set: {
          role: normalizeRole(parsed.data.role),
          isActive: true,
          invitedById: session.userId,
        },
      },
      { upsert: true },
    );

    await AuditModel.create({
      _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      workspaceId: session.workspaceId,
      createdAt: new Date().toISOString(),
      actorId: session.userId,
      actorRole: session.role,
      actorEmail: session.email,
      action: "Existing user added to workspace",
      entityType: "user",
      entityId: String(existing._id),
      meta: existing.email,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(existing._id),
        name: existing.name,
        email: existing.email,
        role: parsed.data.role,
        isActive: true,
        isDirect: false,
        isSelf: String(existing._id) === session.userId,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await UserModel.create({
    email,
    name: parsed.data.name,
    role: toDisplayRole(normalizeRole(parsed.data.role)),
    workspaceId: session.workspaceId,
    passwordHash,
    isActive: true,
  });

  await AuditModel.create({
    _id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    workspaceId: session.workspaceId,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "User created",
    entityType: "user",
    entityId: String(created._id),
    meta: created.email,
  });

  return NextResponse.json({
    success: true,
    data: {
      id: String(created._id),
      name: created.name,
      email: created.email,
    role: toDisplayRole(normalizeRole(created.role)),
      isActive: created.isActive,
      isDirect: true,
      isSelf: String(created._id) === session.userId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    },
  });
}
