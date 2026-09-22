import { isStreamerAuthorized } from "@/lib/authz";
import { redirect } from "next/navigation";
import DockClient from "./DockClient";

export default async function DockPage() {
  if (!(await isStreamerAuthorized())) {
    redirect("/login?mode=streamer&callbackUrl=/dock");
  }

  return <DockClient />;
}
