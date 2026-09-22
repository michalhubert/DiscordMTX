import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPathVisibility, getViewerPassword } from "@/lib/db";
import JoinGate from "./JoinGate";

export default async function StreamPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as { role?: string; password?: string };

  // A viewer-password session becomes stale once the streamer rotates the
  // password - bounce back to login instead of rendering the player for a
  // session that the WHEP endpoint will refuse anyway.
  if (user.role === "viewer") {
    const currentPassword = getViewerPassword("default");
    if (!currentPassword || user.password !== currentPassword) {
      redirect("/login");
    }
  }

  const { path } = await params;
  const whepUrl = `/api/whep/${path}`;
  const isPrivate = getPathVisibility(path) === "private";
  const role = user.role;

  return (
    <main className="h-screen w-screen bg-black overflow-hidden">
      <JoinGate path={path} whepUrl={whepUrl} isPrivate={isPrivate} bypass={role === "streamer"} />
    </main>
  );
}
