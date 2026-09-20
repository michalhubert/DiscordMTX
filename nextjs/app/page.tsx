import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-red-500 text-3xl">🔴</span>
          <h1 className="text-white text-2xl font-semibold">DiscordMTX</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Navigate to <code className="text-gray-200">/{"<stream-path>"}</code> to watch a stream.
        </p>
      </div>
    </div>
  );
}
