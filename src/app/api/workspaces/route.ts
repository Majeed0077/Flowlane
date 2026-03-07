import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { dbConnect } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { UserModel } from "@/lib/models/user";
import { WorkspaceModel } from "@/lib/models/workspace";
import { WorkspaceMembershipModel } from "@/lib/models/workspaceMembership";
import { normalizeRole } from "@/lib/rbac";

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const user = await UserModel.findById(session.userId).lean();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await WorkspaceMembershipModel.find({
    userId: session.userId,
    isActive: true,
  }).lean();

  const workspaceIds = Array.from(
    new Set([user.workspaceId, ...memberships.map((membership) => membership.workspaceId)]),
  );

  const workspaces = await WorkspaceModel.find({
    _id: { $in: workspaceIds },
    isActive: true,
  }).lean();

  const hasPersonalWorkspace = workspaces.some(
    (workspace) => String(workspace._id) === user.workspaceId,
  );

  if (!hasPersonalWorkspace) {
    const created = await WorkspaceModel.findOneAndUpdate(
      { _id: user.workspaceId },
      {
        _id: user.workspaceId,
        name: `${user.name}'s Workspace`,
        logoUrl: "",
        ownerUserId: String(user._id),
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (created) {
      workspaces.push(created);
    }
  }

  const data = workspaceIds.map((id) => {
    const workspace = workspaces.find((item) => String(item._id) === id);
    const membership = memberships.find((item) => item.workspaceId === id);
    const role = id === user.workspaceId
      ? normalizeRole(String(user.role))
      : normalizeRole(String(membership?.role ?? "member"));

    return {
      id,
      name: workspace?.name ?? (id === user.workspaceId ? "My Workspace" : `Workspace ${id.slice(0, 6)}`),
      logoUrl: workspace?.logoUrl ?? "",
      role,
      isPersonal: id === user.workspaceId,
      isActive: id === session.workspaceId,
    };
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession(req);
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length < 2) {
    return NextResponse.json({ success: false, error: "Workspace name is required." }, { status: 400 });
  }

  await dbConnect();
  const id = `ws-${randomUUID().slice(0, 8)}`;
  const created = await WorkspaceModel.create({
    _id: id,
    name,
    logoUrl: "",
    ownerUserId: session.userId,
    isActive: true,
  });

  await WorkspaceMembershipModel.create({
    userId: session.userId,
    workspaceId: id,
    role: "owner",
    isActive: true,
    invitedById: session.userId,
  }).catch(() => undefined);

  return NextResponse.json({
    success: true,
    data: {
      id: String(created._id),
      name: created.name,
      logoUrl: created.logoUrl ?? "",
      role: "owner",
      isPersonal: false,
    },
  });
}
