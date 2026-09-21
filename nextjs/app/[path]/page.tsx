import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPathVisibility } from "@/lib/db";
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

  const { path } = await params;
  const whepUrl = `/api/whep/${path}`;
  const isPrivate = getPathVisibility(path) === "private";
  const role = (session.user as { role?: string }).role;

  return (
    <main className="h-screen w-screen bg-black overflow-hidden">
      <JoinGate path={path} whepUrl={whepUrl} isPrivate={isPrivate} bypass={role === "streamer"} />
    </main>
  );
}
