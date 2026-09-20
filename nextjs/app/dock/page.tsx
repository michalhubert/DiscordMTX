import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import DockClient from "./DockClient";

export default async function DockPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    const headersList = await headers();
    const origin = headersList.get("origin") || headersList.get("host") || "";
    redirect(`/login?mode=streamer&callbackUrl=/dock&originUrl=${encodeURIComponent(origin)}`);
  }

  return <DockClient />;
}
