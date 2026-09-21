import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Satellite } from "lucide-react";

export const dynamic = "force-dynamic";

interface MediaMtxPathItem {
  name?: string;
  ready?: boolean;
}

async function getActiveStreamPath(): Promise<string | null> {
  const host = process.env.MEDIAMTX_HOST ?? "discordmtx";
  const apiPort = process.env.MEDIAMTX_API_PORT ?? "9997";

  try {
    const res = await fetch(`http://${host}:${apiPort}/v3/paths/list`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { items?: MediaMtxPathItem[] };
    const activePath = data.items?.find((item) => item.ready);
    return activePath?.name ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const activePath = await getActiveStreamPath();
  if (activePath) {
    redirect(`/${activePath}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Satellite className="w-7 h-7 text-gray-600" />
          <h1 className="text-white text-2xl font-semibold">DiscordMTX</h1>
        </div>
        <p className="text-gray-400 text-sm">No stream is currently running.</p>
      </div>
    </div>
  );
}
