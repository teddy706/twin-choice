import { LogoutButton } from "@/components/LogoutButton";
import type { Profile } from "@/lib/types";

export function Topbar({ profile }: { profile: Profile }) {
  const dotColor = profile.role === "parent" ? "#FFB84D" : "#2EC4B6";
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="who-badge">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dotColor }} />
        {profile.avatar} {profile.name}
      </div>
      <LogoutButton />
    </div>
  );
}
