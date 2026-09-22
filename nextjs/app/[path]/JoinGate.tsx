"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import PlayerClient from "./PlayerClient";

type AccessStatus = "checking" | "pending" | "approved";

interface Props {
  path: string;
  whepUrl: string;
  isPrivate: boolean;
  bypass: boolean;
}

// Gates access to a private stream: polls /api/streams/[path]/access until the
// streamer approves the pending join request, then mounts the actual player.
export default function JoinGate({ path, whepUrl, isPrivate, bypass }: Props) {
  const [status, setStatus] = useState<AccessStatus>(isPrivate && !bypass ? "checking" : "approved");

  useEffect(() => {
    if (!isPrivate || bypass) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(path)}/access`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data.status === "approved" ? "approved" : "pending");
      } catch (err) {
        console.error("Failed to check join request status:", err);
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [path, isPrivate, bypass]);

  if (status !== "approved") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Lock className="w-10 h-10 text-gray-500" />
        <p className="text-lg font-medium">Waiting for the streamer to let you in…</p>
        <p className="text-sm text-gray-500">This is a private stream. Hang tight.</p>
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return <PlayerClient whepUrl={whepUrl} />;
}
