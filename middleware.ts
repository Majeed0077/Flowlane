import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "vaultflow_session";
const publicPaths = ["/", "/signin", "/signup", "/login"];

type MiddlewareSession = {
  role?: string;
  defaultLandingPage?: "today" | "dashboard";
};

async function verifySession(token: string | undefined): Promise<MiddlewareSession | null> {
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as MiddlewareSession;
  } catch {
    return null;
  }
}

function redirectToLanding(request: NextRequest, defaultLandingPage?: "today" | "dashboard") {
  const target = defaultLandingPage === "dashboard" ? "/dashboard" : "/today";
  return NextResponse.redirect(new URL(target, request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (publicPaths.includes(pathname)) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    const session = await verifySession(token);
    if (session && (pathname === "/signin" || pathname === "/signup" || pathname === "/login")) {
      return redirectToLanding(request, session.defaultLandingPage);
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) {
    const response = NextResponse.redirect(new URL("/signin", request.url));
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
    });
    return response;
  }

  if ((pathname.startsWith("/admin") || pathname.startsWith("/audit")) && session.role !== "owner") {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
