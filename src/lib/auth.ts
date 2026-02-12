import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { UserModel } from "@/lib/models/user";
import { WorkspaceModel } from "@/lib/models/workspace";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import type { Role } from "@/lib/rbac";
import { dbConnect } from "@/lib/db";

const COOKIE_NAME = "vaultflow_session";
const ACTIVE_WORKSPACE_COOKIE = "vaultflow_workspace";

type SessionPayload = {
  userId: string;
  workspaceId: string;
  role: Role;
  email: string;
  name: string;
  tokenVersion: number;
  defaultLandingPage?: "today" | "dashboard";
};

export type Session = {
  userId: string;
  workspaceId: string;
  role: Role;
  email: string;
  name: string;
};

type ResolvedWorkspaceRole = {
  workspaceId: string;
  role: Role;
  email: string;
  name: string;
  tokenVersion: number;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  logoUrl: string;
  role: "owner" | "editor";
  isPersonal: boolean;
  isActive: boolean;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined");
  return new TextEncoder().encode(secret);
}

function normalizeRole(role: string): Role {
  return role.toLowerCase() === "owner" ? "owner" : "editor";
}

function parseCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(`${name}=`.length));
    }
  }
  return "";
}

async function resolveWorkspaceRole(
  userId: string,
  defaultWorkspaceId: string,
  requestedWorkspaceId?: string,
): Promise<ResolvedWorkspaceRole | null> {
  await dbConnect();
  const user = await UserModel.findById(userId).lean();
  if (!user || !user.isActive) return null;

  const activeWorkspaceId = requestedWorkspaceId || defaultWorkspaceId || user.workspaceId;

  if (activeWorkspaceId === user.workspaceId) {
    return {
      workspaceId: activeWorkspaceId,
      role: normalizeRole(user.role),
      email: user.email,
      name: user.name,
      tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
    };
  }

  const membership = await WorkspaceMembershipModel.findOne({
    userId,
    workspaceId: activeWorkspaceId,
    isActive: true,
  }).lean();

  if (!membership) {
    return {
      workspaceId: user.workspaceId,
      role: normalizeRole(user.role),
      email: user.email,
      name: user.name,
      tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
    };
  }

  return {
    workspaceId: activeWorkspaceId,
    role: membership.role === "owner" ? "owner" : "editor",
    email: user.email,
    name: user.name,
    tokenVersion: typeof user.tokenVersion === "number" ? user.tokenVersion : 0,
  };
}

export async function createSessionToken(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 24 * 7;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(getJwtSecret());
}

export async function getSessionFromRequest(req: Request): Promise<Session | null> {
  try {
    const cookieHeader = req.headers.get("cookie");
    const token = parseCookieValue(cookieHeader, COOKIE_NAME);
    if (!token) return null;
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as Partial<SessionPayload>;

    const userId = typeof session.userId === "string" ? session.userId : "";
    const defaultWorkspaceId = typeof session.workspaceId === "string" ? session.workspaceId : "";
    const tokenVersion = typeof session.tokenVersion === "number" ? session.tokenVersion : 0;
    const requestedWorkspaceId = parseCookieValue(cookieHeader, ACTIVE_WORKSPACE_COOKIE);

    if (!userId) return null;

    const resolved = await resolveWorkspaceRole(userId, defaultWorkspaceId, requestedWorkspaceId);
    if (!resolved) return null;
    if (resolved.tokenVersion !== tokenVersion) return null;

    return {
      userId,
      workspaceId: resolved.workspaceId,
      role: resolved.role,
      email: resolved.email,
      name: resolved.name,
    };
  } catch {
    return null;
  }
}

export async function requireSession(req: Request): Promise<Session> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(req: Request, role: "Owner" | "Editor") {
  const session = await requireSession(req);
  const expected: Role = role.toLowerCase() === "owner" ? "owner" : "editor";
  if (session.role !== expected) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as Partial<SessionPayload>;
    const userId = typeof session.userId === "string" ? session.userId : "";
    const defaultWorkspaceId = typeof session.workspaceId === "string" ? session.workspaceId : "";
    const tokenVersion = typeof session.tokenVersion === "number" ? session.tokenVersion : 0;
    const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? "";

    if (!userId) return null;

    const resolved = await resolveWorkspaceRole(userId, defaultWorkspaceId, requestedWorkspaceId);
    if (!resolved) return null;
    if (resolved.tokenVersion !== tokenVersion) return null;

    const user = await UserModel.findById(userId).lean();
    if (!user || !user.isActive) return null;

    return {
      id: String(user._id),
      workspaceId: resolved.workspaceId,
      name: user.name,
      email: user.email,
      role: resolved.role,
      avatarUrl: user.avatarUrl ?? "",
      timezone: user.timezone ?? "UTC",
      language: user.language ?? "en",
      defaultLandingPage: user.defaultLandingPage ?? "today",
      compactMode: Boolean(user.compactMode),
      keyboardShortcuts: user.keyboardShortcuts !== false,
      signature: user.signature ?? "",
      notificationPrefs: {
        inviteEmail: user.notificationPrefs?.inviteEmail !== false,
        inviteInApp: user.notificationPrefs?.inviteInApp !== false,
        taskDueEmail: user.notificationPrefs?.taskDueEmail !== false,
        taskDueInApp: user.notificationPrefs?.taskDueInApp !== false,
        mentionEmail: user.notificationPrefs?.mentionEmail !== false,
        mentionInApp: user.notificationPrefs?.mentionInApp !== false,
        invoiceEmail: user.notificationPrefs?.invoiceEmail !== false,
        invoiceInApp: user.notificationPrefs?.invoiceInApp !== false,
      },
      lastLoginAt: user.lastLoginAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentWorkspaces(): Promise<WorkspaceSummary[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  await dbConnect();

  const user = await UserModel.findById(currentUser.id).lean();
  if (!user) return [];

  const memberships = await WorkspaceMembershipModel.find({
    userId: currentUser.id,
    isActive: true,
  }).lean();

  const workspaceIds = Array.from(
    new Set([String(user.workspaceId), ...memberships.map((membership) => String(membership.workspaceId))]),
  );

  const workspaces = await WorkspaceModel.find({
    _id: { $in: workspaceIds },
    isActive: true,
  }).lean();

  const hasPersonalWorkspace = workspaces.some(
    (workspace) => String(workspace._id) === String(user.workspaceId),
  );

  if (!hasPersonalWorkspace) {
    const created = await WorkspaceModel.findOneAndUpdate(
      { _id: String(user.workspaceId) },
      {
        _id: String(user.workspaceId),
        name: `${user.name}'s Workspace`,
        ownerUserId: String(user._id),
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (created) {
      workspaces.push(created);
    }
  }

  return workspaceIds.map((id) => {
    const workspace = workspaces.find((item) => String(item._id) === id);
    const membership = memberships.find((item) => String(item.workspaceId) === id);
    const role = id === String(user.workspaceId) ? "owner" : membership?.role === "owner" ? "owner" : "editor";

    return {
      id,
      name: workspace?.name ?? (id === String(user.workspaceId) ? "My Workspace" : `Workspace ${id.slice(0, 6)}`),
      logoUrl: workspace?.logoUrl ?? "",
      role,
      isPersonal: id === String(user.workspaceId),
      isActive: id === currentUser.workspaceId,
    };
  });
}

export async function getCurrentRole() {
  const user = await getCurrentUser();
  return user?.role ?? null;
}

export async function getSessionCookieName() {
  return COOKIE_NAME;
}

export async function getActiveWorkspaceCookieName() {
  return ACTIVE_WORKSPACE_COOKIE;
}
