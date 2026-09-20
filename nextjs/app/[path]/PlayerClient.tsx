"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";

type Status = "connecting" | "connected" | "offline" | "error";

interface Props {
  whepUrl: string;
}

export default function PlayerClient({ whepUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const RECONNECT_DELAY_MS = 3000;

  useEffect(() => {
    let cancelled = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function scheduleReconnect() {
      if (cancelled) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        if (!cancelled) connect();
      }, RECONNECT_DELAY_MS);
    }

    async function connect() {
      if (cancelled) return;
      setStatus((prev) => (prev === "connected" ? prev : "connecting"));

      pcRef.current?.close();
      pcRef.current = null;

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (cancelled) return;
          const video = videoRef.current;
          if (video && event.streams[0]) {
            video.srcObject = event.streams[0];
            video.play().catch(() => {
              if (cancelled) return;
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => {});
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled || pcRef.current !== pc) return;
          const state = pc.connectionState;
          if (state === "connected") {
            setStatus("connected");
          } else if (state === "failed" || state === "closed" || state === "disconnected") {
            setStatus(state === "disconnected" ? "offline" : "error");
            scheduleReconnect();
          }
        };

        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (pc.iceGatheringState !== "complete") {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 2000);
            function checkState() {
              if (pc.iceGatheringState === "complete") {
                clearTimeout(timeout);
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
              }
            }
            pc.addEventListener("icegatheringstatechange", checkState);
          });
        }

        const res = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp ?? offer.sdp,
        });

        if (!res.ok) {
          if (res.status === 404 || res.status === 503) {
            setStatus("offline");
          } else {
            setStatus("error");
          }
          pc.close();
          scheduleReconnect();
          return;
        }

        const sdpAnswer = await res.text();
        await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

        if (!cancelled && pc.connectionState === "connected") {
          setStatus("connected");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          scheduleReconnect();
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [whepUrl]);

  function toggleMute() {
    setIsMuted((prev) => !prev);
    videoRef.current?.play().catch(() => {});
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(e.target.value);
    setVolume(next);
    setIsMuted(next === 0);
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

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

  const statusLabels: Record<Status, string> = {
    connecting: "Connecting…",
    connected: "Live",
    offline: "Stream offline",
    error: "Connection error",
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-contain"
      />

      {status !== "connected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
          <StatusIcon status={status} className="w-10 h-10 text-gray-300" />
          <p className="text-white text-lg font-medium">{statusLabels[status]}</p>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-3 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleMute}
          className="text-white hover:text-gray-300 transition-colors"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-20 h-1 accent-white cursor-pointer"
          title="Volume"
        />
        <button
          onClick={toggleFullscreen}
          className="text-white hover:text-gray-300 transition-colors"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

function StatusIcon({ status, className }: { status: Status; className?: string }) {
  if (status === "connecting") {
    return <Loader2 className={`${className ?? ""} animate-spin`} />;
  }
  if (status === "offline") {
    return <WifiOff className={className} />;
  }
  return <AlertTriangle className={className} />;
}
