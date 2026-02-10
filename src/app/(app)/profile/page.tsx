import { getCurrentUser } from "@/lib/auth";
import { ProfileClient, type Profile } from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const initialProfile: Profile | null = user
    ? {
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role === "owner" ? "owner" : "editor",
        avatarUrl: user.avatarUrl ?? "",
      }
    : null;
  return <ProfileClient initialProfile={initialProfile} />;
}
