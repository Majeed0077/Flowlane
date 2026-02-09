import { getCurrentUser } from "@/lib/auth";
import { ProfileClient } from "@/components/profile/ProfileClient";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const initialProfile = user
    ? {
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? "",
      }
    : null;
  return <ProfileClient initialProfile={initialProfile} />;
}
