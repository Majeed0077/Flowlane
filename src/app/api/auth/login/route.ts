import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/lib/models/user";
import { TeamInviteModel } from "@/lib/models/teamInvite";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionToken, getActiveWorkspaceCookieName, getSessionCookieName } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { normalizeRole } from "@/lib/rbac";

export async function POST(request: Request) {
  const body = await request.json();
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    inviteToken: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const ip = getClientIp(request);
  const rl = rateLimit({
    key: `login:${ip}:${email}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  await dbConnect();
  let user = await UserModel.findOne({ email, isActive: true }).lean();
  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 });
  }

  if (!user.workspaceId) {
    await UserModel.updateOne({ _id: user._id }, { $set: { workspaceId: "default" } });
    user = await UserModel.findById(user._id).lean();
    if (!user || !user.workspaceId) {
      return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 });
    }
  }

  await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  const match = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!match) {
    if (user.passwordHash !== parsed.data.password) {
      return NextResponse.json({ success: false, error: "Invalid credentials." }, { status: 401 });
    }
    const migratedHash = await hashPassword(parsed.data.password);
    await UserModel.updateOne({ _id: user._id }, { $set: { passwordHash: migratedHash } });
  }

  let activeWorkspaceId = String(user.workspaceId);
  if (parsed.data.inviteToken) {
    const invite = await TeamInviteModel.findOne({ token: parsed.data.inviteToken }).lean();
    if (!invite) {
      return NextResponse.json({ success: false, error: "Invalid invite link." }, { status: 400 });
    }
    if (invite.email !== email) {
      return NextResponse.json({ success: false, error: "Invite email does not match." }, { status: 400 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json({ success: false, error: "Invite is no longer active." }, { status: 400 });
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      await TeamInviteModel.findByIdAndUpdate(invite._id, { status: "expired" });
      return NextResponse.json({ success: false, error: "Invite has expired." }, { status: 400 });
    }

    const targetRole = normalizeRole(invite.role);
    await WorkspaceMembershipModel.updateOne(
      { userId: String(user._id), workspaceId: invite.workspaceId },
      {
        $set: {
          role: targetRole,
          isActive: true,
          invitedById: invite.invitedById,
        },
      },
      { upsert: true },
    );

    await TeamInviteModel.findByIdAndUpdate(invite._id, {
      status: "accepted",
      acceptedAt: new Date(),
      acceptedUserId: String(user._id),
    });

    activeWorkspaceId = String(invite.workspaceId);
  }

  const normalizedRole = normalizeRole(user.role);
  const defaultLandingPage = user.defaultLandingPage === "dashboard" ? "dashboard" : "today";

  const sessionToken = await createSessionToken({
    userId: String(user._id),
    workspaceId: String(user.workspaceId),
    role: normalizedRole,
    email: user.email,
    name: user.name,
    tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
    defaultLandingPage,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizedRole,
      defaultLandingPage,
      activeWorkspaceId,
    },
  });

  await logAuditEvent({
    actorId: String(user._id),
    actorRole: user.role,
    actorEmail: user.email,
    action: parsed.data.inviteToken ? "auth.login.invite-accepted" : "auth.login",
    entityType: "auth",
    entityId: String(user._id),
    workspaceId: activeWorkspaceId,
    meta: `Login for ${user.email}`,
  });

  response.cookies.set(await getSessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.set(await getActiveWorkspaceCookieName(), activeWorkspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
