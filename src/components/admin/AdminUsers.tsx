"use client";

import Image from "next/image";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type AdminInvite, type AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function formatInviteStatus(status: AdminInvite["status"]) {
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "revoked") return "Revoked";
  return "Expired";
}

export function AdminUsers({
  initialUsers,
  initialInvites,
  canManage,
  activeWorkspaceId,
  initialWorkspaceName,
  initialWorkspaceLogo,
  activeWorkspaceIsPersonal,
}: {
  initialUsers: AdminUser[];
  initialInvites: AdminInvite[];
  canManage: boolean;
  activeWorkspaceId: string;
  initialWorkspaceName: string;
  initialWorkspaceLogo?: string;
  activeWorkspaceIsPersonal: boolean;
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [invites, setInvites] = useState<AdminInvite[]>(initialInvites);

  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Owner" | "Editor">("Editor");
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [workspaceLogo, setWorkspaceLogo] = useState(initialWorkspaceLogo ?? "");
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [removingUserId, setRemovingUserId] = useState("");
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [highlightedUserIds, setHighlightedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setInvites(initialInvites);
  }, [initialInvites]);

  useEffect(() => {
    setWorkspaceName(initialWorkspaceName);
  }, [initialWorkspaceName]);

  useEffect(() => {
    setWorkspaceLogo(initialWorkspaceLogo ?? "");
  }, [initialWorkspaceLogo]);

  const canInvite = useMemo(() => inviteEmail.trim().length > 3, [inviteEmail]);

  const canSaveTeamProfile = useMemo(() => {
    const nameChanged = workspaceName.trim().length >= 2 && workspaceName.trim() !== initialWorkspaceName.trim();
    const logoChanged = (workspaceLogo ?? "") !== (initialWorkspaceLogo ?? "");
    return nameChanged || logoChanged;
  }, [workspaceName, initialWorkspaceName, workspaceLogo, initialWorkspaceLogo]);

  const canDeleteWorkspace = useMemo(() => {
    if (!canManage) return false;
    if (activeWorkspaceIsPersonal) return false;
    return deleteConfirmName.trim() === initialWorkspaceName.trim();
  }, [canManage, activeWorkspaceIsPersonal, deleteConfirmName, initialWorkspaceName]);

  async function refreshAndDetectAccepted(previousInvites: AdminInvite[] = invites) {
    try {
      const [userList, inviteList] = await Promise.all([api.getUsers(), api.getInvites()]);
      setUsers(userList);
      setInvites(inviteList);

      const prevMap = new Map(previousInvites.map((item) => [item.id, item]));
      const newlyAcceptedUserIds = inviteList
        .filter((item) => {
          const prev = prevMap.get(item.id);
          return prev && prev.status !== "accepted" && item.status === "accepted";
        })
        .map((item) => item.acceptedUserId)
        .filter((id): id is string => Boolean(id));

      if (newlyAcceptedUserIds.length > 0) {
        setHighlightedUserIds((prev) => new Set([...prev, ...newlyAcceptedUserIds]));
        toast.success("Invite accepted. User added to team.");

        window.setTimeout(() => {
          setHighlightedUserIds((prev) => {
            const next = new Set(prev);
            newlyAcceptedUserIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 15000);
      }
    } catch {
      toast.error("Unable to load team data.");
    }
  }

  async function refresh() {
    await refreshAndDetectAccepted();
  }

  useEffect(() => {
    const poll = window.setInterval(() => {
      void refreshAndDetectAccepted();
    }, 8000);
    return () => window.clearInterval(poll);
  }, [invites]);

  async function handleSaveTeamProfile() {
    if (!canManage) {
      toast.error("Only owner can update team profile.");
      return;
    }
    if (!activeWorkspaceId) {
      toast.error("Active workspace not found.");
      return;
    }

    setRenaming(true);
    try {
      const updated = await api.updateWorkspace(activeWorkspaceId, {
        name: workspaceName.trim(),
        logoUrl: workspaceLogo,
      });
      setWorkspaceName(updated.name);
      setWorkspaceLogo(updated.logoUrl ?? "");
      toast.success("Team profile updated.");
      window.dispatchEvent(
        new CustomEvent("vaultflow-workspace-updated", {
          detail: { workspaceId: updated.id, name: updated.name },
        }),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to update team profile.";
      toast.error(message);
    } finally {
      setRenaming(false);
    }
  }

  async function handleTeamLogoUpload(file?: File) {
    if (!canManage) return;
    if (!file) return;

    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const json = await response.json();
      if (!json?.success || !Array.isArray(json.data) || !json.data[0]?.url) {
        throw new Error(json?.error ?? "Upload failed.");
      }
      setWorkspaceLogo(String(json.data[0].url));
      toast.success("Team logo uploaded. Save to apply.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload team logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleInvite() {
    if (!canManage) {
      toast.error("Only owner can invite users.");
      return;
    }
    if (!canInvite) return;

    setLoading(true);
    try {
      const created = await api.createInvite({
        name: inviteName.trim() || undefined,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      });
      setInvites((prev) => [created, ...prev]);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Editor");
      toast.success("Invite created and stored.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to create invite.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(id: string, payload: Partial<AdminUser> & { password?: string }) {
    if (!canManage) {
      toast.error("Only owner can update team users.");
      return;
    }
    try {
      const updated = await api.updateUser(id, payload);
      setUsers((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      toast.success("User updated.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to update user.";
      toast.error(message);
    }
  }

  async function removeUserFromTeam(user: AdminUser) {
    if (!canManage) {
      toast.error("Only owner can remove team members.");
      return;
    }

    if (user.isDirect) {
      toast.error("Primary workspace users cannot be removed from team membership.");
      return;
    }

    setRemovingUserId(user.id);
    try {
      await api.removeUserFromWorkspace(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast.success("Member removed from this team.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to remove member.";
      toast.error(message);
    } finally {
      setRemovingUserId("");
    }
  }

  async function revokeInvite(id: string) {
    if (!canManage) {
      toast.error("Only owner can revoke invites.");
      return;
    }
    try {
      await api.revokeInvite(id);
      setInvites((prev) => prev.map((item) => (item.id === id ? { ...item, status: "revoked" } : item)));
      toast.success("Invite revoked.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to revoke invite.";
      toast.error(message);
    }
  }

  async function deleteCurrentTeam() {
    if (!canDeleteWorkspace || !activeWorkspaceId) return;

    setDeletingTeam(true);
    try {
      const result = await api.deleteWorkspace(activeWorkspaceId);
      toast.success("Team deleted.");
      window.dispatchEvent(
        new CustomEvent("vaultflow-workspace-updated", {
          detail: { workspaceId: result.switchedWorkspaceId },
        }),
      );
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to delete team.";
      toast.error(message);
    } finally {
      setDeletingTeam(false);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Unable to copy link.");
    }
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <Card className="glass space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Team profile</h2>
            <p className="text-xs text-muted-foreground">
              Owner can update active team name and logo.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-muted/50">
                {workspaceLogo ? (
                  <Image src={workspaceLogo} alt={workspaceName} width={48} height={48} className="h-12 w-12 object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {(workspaceName || "W").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(event) => void handleTeamLogoUpload(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? "Uploading..." : "Upload logo"}
                </Button>
                {workspaceLogo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWorkspaceLogo("")}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                disabled={renaming}
                placeholder="Team name"
                className="md:max-w-sm"
              />
              <Button onClick={handleSaveTeamProfile} disabled={!canSaveTeamProfile || renaming}>
                {renaming ? "Saving..." : "Save team profile"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {canManage ? (
        <Card className="glass space-y-4 p-5">
          <div>
            <h2 className="text-sm font-semibold">Invite team member</h2>
            <p className="text-xs text-muted-foreground">
              Send invite by email. Invite is stored in DB and member is added after signup.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Full name (optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />
            <Input
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "Owner" | "Editor")}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Owner">Owner</SelectItem>
                <SelectItem value="Editor">Editor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Invite expires in 7 days.</p>
            <Button onClick={handleInvite} disabled={!canInvite || loading}>
              {loading ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="glass space-y-2 p-5">
          <h2 className="text-sm font-semibold">Team access</h2>
          <p className="text-xs text-muted-foreground">
            You are viewing your team in read-only mode. Ask an owner to manage invites and roles.
          </p>
        </Card>
      )}

      {canManage && !activeWorkspaceIsPersonal ? (
        <Card className="space-y-3 border-destructive/40 p-5">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground">
            Delete this team permanently. Type the current team name to confirm.
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              placeholder={`Type "${initialWorkspaceName}" to confirm`}
              className="md:max-w-sm"
            />
            <Button
              variant="destructive"
              onClick={deleteCurrentTeam}
              disabled={!canDeleteWorkspace || deletingTeam}
            >
              {deletingTeam ? "Deleting..." : "Delete team"}
            </Button>
          </div>
        </Card>
      ) : null}

      {invites.length === 0 ? (
        <EmptyState title="No invites yet" description="Invite your first teammate by email." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invite</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id} className="hover:bg-muted/40">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{invite.name || "Unnamed"}</span>
                      <span className="text-xs text-muted-foreground">{invite.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{invite.role}</TableCell>
                  <TableCell>
                    <Badge variant={invite.status === "pending" ? "secondary" : "outline"}>
                      {formatInviteStatus(invite.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyInviteLink(invite.inviteUrl)}>
                        Copy link
                      </Button>
                      {canManage && invite.status === "pending" ? (
                        <Button variant="outline" size="sm" onClick={() => revokeInvite(invite.id)}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState title="No active users yet" description="Accepted invites will appear here." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={cn(
                    "hover:bg-muted/40",
                    highlightedUserIds.has(user.id) && "bg-emerald-100/40 dark:bg-emerald-900/20",
                  )}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUser(user.id, { role: value as "Owner" | "Editor" })}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Owner">Owner</SelectItem>
                          <SelectItem value="Editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span>{user.role}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "outline"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canManage ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {!user.isDirect && !user.isSelf ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={removingUserId === user.id}
                              onClick={() => removeUserFromTeam(user)}
                            >
                              {removingUserId === user.id ? "Removing..." : "Remove"}
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>
    </div>
  );
}












