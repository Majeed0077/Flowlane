import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AppProviders } from "@/components/layout/AppProviders";
import { getCurrentRole, getCurrentUser, getCurrentWorkspaces } from "@/lib/auth";
import type { Role } from "@/lib/rbac";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();
  const initialRole: Role | null =
    role === "owner" || role === "editor" ? role : null;

  const [currentUser, initialWorkspaces] = await Promise.all([
    getCurrentUser(),
    getCurrentWorkspaces(),
  ]);

  const safeUserRole: Role | null =
    currentUser?.role === "owner" || currentUser?.role === "editor"
      ? currentUser.role
      : null;

  const initialUser =
    currentUser && safeUserRole
      ? {
          role: safeUserRole,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl ?? "",
        }
      : null;

  const activeWorkspace = initialWorkspaces.find((workspace) => workspace.isActive) ?? null;

  return (
    <AppProviders>
      <div className="flex h-screen w-full overflow-hidden" data-vf-role={initialRole ?? undefined}>
        <Sidebar initialRole={initialRole} />
        <div className="flex flex-1 flex-col">
          <TopBar
            initialRole={initialRole}
            initialUser={initialUser}
            initialWorkspaces={initialWorkspaces}
            initialActiveWorkspaceId={activeWorkspace?.id ?? ""}
          />
          <main className="flex-1 overflow-y-auto bg-muted/30 px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </AppProviders>
  );
}

