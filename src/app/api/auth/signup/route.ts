import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { dbConnect } from "@/lib/db";
import { UserModel } from "@/lib/models/user";
import { TeamInviteModel } from "@/lib/models/teamInvite";
import { WorkspaceModel } from "@/lib/models/workspace";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  getActiveWorkspaceCookieName,
  getSessionCookieName,
} from "@/lib/auth";
import { AuditModel } from "@/lib/models/audit";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  inviteToken: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ip = getClientIp(request);
  const rl = rateLimit({
    key: `signup:${ip}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: "Too many signup attempts. Try again later." },
      { status: 429 },
    );
  }

  await dbConnect();
  const email = parsed.data.email.toLowerCase();
  const existing = await UserModel.findOne({ email }).lean();

  let invite: any = null;
  if (parsed.data.inviteToken) {
    invite = await TeamInviteModel.findOne({ token: parsed.data.inviteToken }).lean();
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
  }

  if (existing && !invite) {
    return NextResponse.json({ success: false, error: "Email already in use." }, { status: 409 });
  }

  if (existing && invite) {
    const ok = await verifyPassword(parsed.data.password, existing.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Use your existing account password to join this team." },
        { status: 401 },
      );
    }

    const targetRole = invite.role === "Owner" ? "owner" : "editor";
    await WorkspaceMembershipModel.updateOne(
      { userId: String(existing._id), workspaceId: invite.workspaceId },
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
      acceptedUserId: String(existing._id),
    });

    const defaultLandingPage = existing.defaultLandingPage === "dashboard" ? "dashboard" : "today";

    const sessionToken = await createSessionToken({
      userId: String(existing._id),
      workspaceId: String(existing.workspaceId),
      role: existing.role.toLowerCase() === "owner" ? "owner" : "editor",
      email: existing.email,
      name: existing.name,
      tokenVersion: typeof existing.tokenVersion === "number" ? existing.tokenVersion : 0,
      defaultLandingPage,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: String(existing._id),
        name: existing.name,
        email: existing.email,
        role: existing.role.toLowerCase() === "owner" ? "owner" : "editor",
        defaultLandingPage,
      },
    });

    response.cookies.set(await getSessionCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set(await getActiveWorkspaceCookieName(), String(existing.workspaceId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  }

  const personalWorkspaceId = `ws-${randomUUID().slice(0, 8)}`;
  const passwordHash = await hashPassword(parsed.data.password);
  const created = await UserModel.create({
    email,
    name: parsed.data.name,
    role: "Owner",
    workspaceId: personalWorkspaceId,
    passwordHash,
    isActive: true,
  });

  await WorkspaceModel.create({
    _id: personalWorkspaceId,
    name: `${parsed.data.name}'s Workspace`,
    ownerUserId: String(created._id),
    isActive: true,
  });

  if (invite) {
    const targetRole = invite.role === "Owner" ? "owner" : "editor";
    await WorkspaceMembershipModel.updateOne(
      { userId: String(created._id), workspaceId: invite.workspaceId },
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
      acceptedUserId: String(created._id),
    });
  }

  await AuditModel.create({
    _id: `aud-${randomUUID().slice(0, 8)}`,
    workspaceId: personalWorkspaceId,
    createdAt: new Date().toISOString(),
    actorId: String(created._id),
    actorRole: "owner",
    actorEmail: created.email,
    action: invite ? "User signed up and joined invited workspace" : "Workspace owner signed up",
    entityType: "user",
    entityId: String(created._id),
    meta: created.email,
  });

  const defaultLandingPage: "today" | "dashboard" = "today";
  const sessionToken = await createSessionToken({
    userId: String(created._id),
    workspaceId: personalWorkspaceId,
    role: "owner",
    email: created.email,
    name: created.name,
    tokenVersion: 0,
    defaultLandingPage,
  });

  const response = NextResponse.json({
    success: true,
    data: {
      id: created._id,
      name: created.name,
      email: created.email,
      role: "owner",
      defaultLandingPage,
    },
  });

  response.cookies.set(await getSessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });

  response.cookies.set(await getActiveWorkspaceCookieName(), personalWorkspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
