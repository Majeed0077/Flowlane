import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { AppProviders } from "@/components/layout/AppProviders";
import { getCurrentRole, getCurrentUser } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const initialRole = await getCurrentRole();
  const currentUser = await getCurrentUser();
  const initialUser = currentUser
    ? {
        role: currentUser.role,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl ?? "",
      }
    : null;
  return (
    <AppProviders>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar initialRole={initialRole} />
        <div className="flex flex-1 flex-col">
          <TopBar initialRole={initialRole} initialUser={initialUser} />
          <main className="flex-1 overflow-y-auto bg-muted/30 px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </AppProviders>
  );
}
