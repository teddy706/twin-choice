import { LogoutButton } from "@/components/LogoutButton";
import { Avatar } from "@/components/Avatar";
import type { ProfileWithAvatar } from "@/lib/currentProfile";

export function Topbar({ profile }: { profile: ProfileWithAvatar }) {
  const dotColor = profile.role === "parent" ? "#FFB84D" : "#2EC4B6";
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="who-badge">
        <span className="h-2.5 w-2.5 rounded-full border border-ink/30" style={{ background: dotColor }} />
        <Avatar url={profile.avatarUrl} emoji={profile.avatar} size={20} />
        {profile.name}
      </div>
      <LogoutButton />
    </div>
  );
}
