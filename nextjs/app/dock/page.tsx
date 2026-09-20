import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DockClient from "./DockClient";

export default async function DockPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "streamer") {
    redirect("/login?mode=streamer&callbackUrl=/dock");
  }

  return <DockClient />;
}
