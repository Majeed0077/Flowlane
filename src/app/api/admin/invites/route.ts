import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbConnect } from "@/lib/db";
import { TeamInviteModel } from "@/lib/models/teamInvite";
import { UserModel } from "@/lib/models/user";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { AuditModel } from "@/lib/models/audit";
import { requireSession } from "@/lib/auth";
import { teamInviteCreateSchema } from "@/lib/validation";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { sendInviteEmail } from "@/lib/email";
import { normalizeRole, toDisplayRole } from "@/lib/rbac";

function resolveAppBaseUrl(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

function serializeInvite(invite: any, baseUrl: string) {
  const now = new Date();
  const isExpired = invite.status === "pending" && new Date(invite.expiresAt) < now;
  const status = isExpired ? "expired" : invite.status;
  return {
    id: String(invite._id),
    email: invite.email,
    name: invite.name ?? "",
    role: toDisplayRole(normalizeRole(invite.role)),
    status,
    invitedByEmail: invite.invitedByEmail,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt ?? null,
    acceptedUserId: invite.acceptedUserId ?? null,
    inviteUrl: `${baseUrl}/signup?invite=${encodeURIComponent(invite.token)}&email=${encodeURIComponent(invite.email)}`,
  };
}

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    await dbConnect();
    const baseUrl = resolveAppBaseUrl(req);
    const invites = await TeamInviteModel.find({ workspaceId: session.workspaceId })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({
      success: true,
      data: invites.map((invite) => serializeInvite(invite, baseUrl)),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
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

  const ip = getClientIp(req);
  const rl = rateLimit({
    key: `invite:${session.workspaceId}:${session.userId}:${ip}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many invite requests. Try again later." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = teamInviteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }

  await dbConnect();
  const email = parsed.data.email.toLowerCase();

  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser) {
    const alreadyDirect = existingUser.workspaceId === session.workspaceId;
    const activeMembership = await WorkspaceMembershipModel.findOne({
      userId: String(existingUser._id),
      workspaceId: session.workspaceId,
      isActive: true,
    }).lean();

    if (alreadyDirect || activeMembership) {
      return NextResponse.json(
        { success: false, error: "User is already part of this team." },
        { status: 409 },
      );
    }
  }

  await TeamInviteModel.updateMany(
    { email, workspaceId: session.workspaceId, status: "pending" },
    { $set: { status: "revoked" } },
  );

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  const created = await TeamInviteModel.create({
    email,
    name: parsed.data.name?.trim() ?? "",
    role: parsed.data.role,
    token,
    status: "pending",
    invitedById: session.userId,
    invitedByEmail: session.email,
    workspaceId: session.workspaceId,
    expiresAt,
  });

  const baseUrl = resolveAppBaseUrl(req);
  const serialized = serializeInvite(created.toObject(), baseUrl);

  const emailResult = await sendInviteEmail({
    to: serialized.email,
    name: serialized.name,
    role: serialized.role,
    inviteUrl: serialized.inviteUrl,
    invitedByEmail: session.email,
  });

  await AuditModel.create({
    _id: `aud-${randomUUID().slice(0, 8)}`,
    workspaceId: session.workspaceId,
    createdAt: new Date().toISOString(),
    actorId: session.userId,
    actorRole: session.role,
    actorEmail: session.email,
    action: "Team invite created",
    entityType: "invite",
    entityId: String(created._id),
    meta: `${email} | mail:${emailResult.sent ? "sent" : "not-sent"}`,
  });

  return NextResponse.json({
    success: true,
    data: {
      ...serialized,
      emailDelivery: emailResult,
    },
  });
}
