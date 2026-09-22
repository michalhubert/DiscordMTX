"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import PlayerClient from "./PlayerClient";

type AccessStatus = "checking" | "pending" | "approved" | "offline" | "denied";

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
  const [denialInfo, setDenialInfo] = useState<{ deniedUntil: number; denialCount: number } | null>(null);

  useEffect(() => {
    if (!isPrivate || bypass) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/streams/${encodeURIComponent(path)}/access`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          if (data.status === "approved") {
            setStatus("approved");
            setDenialInfo(null);
          } else if (data.status === "offline") {
            setStatus("offline");
            setDenialInfo(null);
          } else if (data.status === "denied") {
            setStatus("denied");
            setDenialInfo(data.denialInfo || null);
          } else {
            setStatus("pending");
            setDenialInfo(null);
          }
        }
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

  // Update denial countdown every second
  useEffect(() => {
    if (status !== "denied" || !denialInfo) return;
    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= denialInfo.deniedUntil) {
        setStatus("pending");
        setDenialInfo(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status, denialInfo]);

  function formatTimeRemaining(ms: number): string {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  }

  if (status === "offline") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Loader2 className="w-10 h-10 text-gray-500" />
        <p className="text-lg font-medium">Stream is offline</p>
        <p className="text-sm text-gray-500">The streamer is not currently streaming.</p>
      </div>
    );
  }

  if (status === "denied" && denialInfo) {
    const timeRemaining = denialInfo.deniedUntil - Date.now();
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-black text-gray-300">
        <Lock className="w-10 h-10 text-red-500" />
        <p className="text-lg font-medium">Access denied</p>
        <p className="text-sm text-gray-500">
          You can try again in <span className="text-red-400 font-semibold">{formatTimeRemaining(timeRemaining)}</span>
        </p>
      </div>
    );
  }

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
