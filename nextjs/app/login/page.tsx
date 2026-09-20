import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

function getDiscordEnabled() {
  return (
    process.env.NEXT_PUBLIC_DISCORD_ENABLED === "true" ||
    !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
  );
}

export default function LoginPage() {
  const discordEnabled = getDiscordEnabled();

  return (
    <Suspense>
      <LoginForm discordEnabled={discordEnabled} />
    </Suspense>
  );
}
