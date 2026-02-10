import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { UserModel } from "@/lib/models/user";
import type { Role } from "@/lib/rbac";
import { dbConnect } from "@/lib/db";

const COOKIE_NAME = "vaultflow_session";

type SessionPayload = {
  userId: string;
  role: Role;
  email: string;
  name: string;
};

export type Session = {
  userId: string;
  role: Role;
  email: string;
  name: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined");
  return new TextEncoder().encode(secret);
}

function normalizeRole(role: string) {
  return role.toLowerCase() === "owner" ? "owner" : "editor";
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${COOKIE_NAME}=`)) {
      return part.slice(`${COOKIE_NAME}=`.length);
    }
  }
  return "";
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
    const token = parseCookieHeader(req.headers.get("cookie"));
    if (!token) return null;
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as SessionPayload;
    return {
      ...session,
      userId: typeof session.userId === "string" ? session.userId : String(session.userId),
      role: session.role === "owner" ? "owner" : "editor",
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
  const expected = role.toLowerCase();
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
    const session = payload as SessionPayload;
    await dbConnect();
    const userId = typeof session.userId === "string" ? session.userId : String(session.userId);
    const user = await UserModel.findById(userId).lean();
    if (!user || !user.isActive) return null;
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: normalizeRole(user.role),
      avatarUrl: user.avatarUrl ?? "",
    };
  } catch {
    return null;
  }
}

export async function getCurrentRole() {
  const user = await getCurrentUser();
  return user?.role ?? null;
}

export async function getSessionCookieName() {
  return COOKIE_NAME;
}
