import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlayerClient from "./PlayerClient";

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

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center">
      <PlayerClient path={path} whepUrl={whepUrl} />
    </main>
  );
}
