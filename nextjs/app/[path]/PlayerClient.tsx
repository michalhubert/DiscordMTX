"use client";

import { useEffect, useRef, useState } from "react";

type Status = "connecting" | "connected" | "offline" | "error";

interface Props {
  path: string;
  whepUrl: string;
}

export default function PlayerClient({ path, whepUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("connecting");

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const res = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        });

        if (!res.ok) {
          if (res.status === 404 || res.status === 503) {
            setStatus("offline");
          } else {
            setStatus("error");
          }
          pc.close();
          return;
        }

        const sdpAnswer = await res.text();
        await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

        pc.ontrack = (event) => {
          if (cancelled) return;
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          const state = pc.connectionState;
          if (state === "connected") setStatus("connected");
          else if (state === "failed" || state === "closed") setStatus("error");
          else if (state === "disconnected") setStatus("offline");
        };
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    connect();

    return () => {
      cancelled = true;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [whepUrl]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const statusColors: Record<Status, string> = {
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    offline: "bg-gray-500",
    error: "bg-red-500",
  };

  const statusLabels: Record<Status, string> = {
    connecting: "Connecting…",
    connected: "Live",
    offline: "Stream offline",
    error: "Connection error",
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain"
      />

      {/* Overlay when not connected */}
      {status !== "connected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
          <span className="text-4xl">
            {status === "offline" ? "📡" : status === "connecting" ? "⏳" : "⚠️"}
          </span>
          <p className="text-white text-lg font-medium">{statusLabels[status]}</p>
          {status === "error" && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* HUD — top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
          <span className="text-white text-sm font-medium">{path}</span>
        </div>
        <span className="text-gray-300 text-xs">{statusLabels[status]}</span>
      </div>

      {/* Controls — bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end px-4 py-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className="text-white hover:text-gray-300 transition-colors text-lg"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? "⛶" : "⛶"}
        </button>
      </div>
    </div>
  );
}
