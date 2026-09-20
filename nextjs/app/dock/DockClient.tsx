"use client";

import { useEffect, useRef, useState } from "react";

type WebrtcSession = {
  id: string;
  state?: string;
  path?: string;
  created?: string;
  bytesSent?: number;
  remoteAddr?: string;
};

type MtxPath = {
  name: string;
  ready: boolean;
  readers?: unknown[];
};

type StreamEvent = {
  type: "join" | "leave";
  text: string;
  ip: string;
  time: string;
};

const MAX_EVENTS = 20;

function formatBytes(bytes?: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(startTime?: string) {
  if (!startTime) return "0s";
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function cleanRemoteAddr(addr?: string) {
  if (!addr) return "unknown";
  if (addr.startsWith("[")) {
    const end = addr.indexOf("]");
    return end !== -1 ? addr.slice(1, end) : addr;
  }
  const lastColon = addr.lastIndexOf(":");
  return lastColon !== -1 ? addr.slice(0, lastColon) : addr;
}

export default function DockClient() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [status, setStatus] = useState<"checking" | "live" | "offline" | "error">("checking");
  const [viewerCount, setViewerCount] = useState(0);
  const [pathCount, setPathCount] = useState(0);
  const [readers, setReaders] = useState<WebrtcSession[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [viewerPassword, setViewerPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const knownSessionIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  function playChime(isJoin = true) {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === "suspended") audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      if (isJoin) {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
      } else {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(587.33, now + 0.1);
      }

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.error("Audio chime error:", e);
    }
  }

  function logEvent(type: "join" | "leave", text: string, ip: string) {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    setEvents((prev) => [{ type, text, ip, time: timeStr }, ...prev].slice(0, MAX_EVENTS));
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshData() {
      try {
        const [sessionsRes, pathsRes] = await Promise.allSettled([
          fetch("/api/mediamtx/webrtcsessions/list"),
          fetch("/api/mediamtx/paths/list"),
        ]);

        let sessions: WebrtcSession[] = [];
        let paths: MtxPath[] = [];
        let hasAuthError = false;
        let hasApiError = false;

        if (sessionsRes.status === "fulfilled") {
          if (sessionsRes.value.ok) {
            const sData = await sessionsRes.value.json();
            sessions = sData.items || [];
          } else if (sessionsRes.value.status === 401 || sessionsRes.value.status === 403) {
            hasAuthError = true;
          } else {
            hasApiError = true;
          }
        } else {
          hasApiError = true;
        }

        if (pathsRes.status === "fulfilled") {
          if (pathsRes.value.ok) {
            const pData = await pathsRes.value.json();
            paths = pData.items || [];
          } else if (pathsRes.value.status === 401 || pathsRes.value.status === 403) {
            hasAuthError = true;
          } else {
            hasApiError = true;
          }
        } else {
          hasApiError = true;
        }

        if (cancelled) return;

        const currentReaders = sessions.filter(
          (s) => s.state === "read" || (s.state !== "publish" && s.state !== undefined)
        );
        const activePublishers = paths.filter((p) => p.ready);

        if (hasAuthError) {
          setStatus("error");
        } else if (hasApiError && paths.length === 0 && sessions.length === 0) {
          setStatus("error");
        } else if (activePublishers.length > 0) {
          setStatus("live");
        } else {
          setStatus("offline");
        }

        const totalPathReaders = paths.reduce((acc, p) => acc + (p.readers ? p.readers.length : 0), 0);
        setViewerCount(Math.max(currentReaders.length, totalPathReaders));
        setPathCount(activePublishers.length > 0 ? activePublishers.length : paths.length);

        const currentSessionIds = new Set(currentReaders.map((r) => r.id));

        if (!initialLoad.current && !hasAuthError) {
          for (const reader of currentReaders) {
            if (!knownSessionIds.current.has(reader.id)) {
              const ip = cleanRemoteAddr(reader.remoteAddr);
              logEvent("join", `joined /${reader.path || "stream"}`, ip);
              playChime(true);
            }
          }
          for (const oldId of knownSessionIds.current) {
            if (!currentSessionIds.has(oldId)) {
              logEvent("leave", "disconnected", "viewer");
              playChime(false);
            }
          }
        }
        knownSessionIds.current = currentSessionIds;
        initialLoad.current = false;

        setReaders(currentReaders);
      } catch (err) {
        console.error("Error updating streamer HUD:", err);
        setStatus("error");
      }
    }

    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshPassword() {
      try {
        const res = await fetch("/api/dock/password");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setViewerPassword(data.password ?? null);
      } catch (err) {
        console.error("Error fetching viewer password:", err);
      }
    }

    refreshPassword();
    const interval = setInterval(refreshPassword, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function copyPassword() {
    if (!viewerPassword) return;
    try {
      await navigator.clipboard.writeText(viewerPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy password:", err);
    }
  }

  const statusLabel =
    status === "live" ? "LIVE" : status === "error" ? "API ERROR" : status === "offline" ? "OFFLINE" : "Checking";

  return (
    <div className="min-h-screen bg-[#121216] text-[#e2e8f0] text-[13px] leading-[1.4] p-3 select-none font-sans">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#2c2c38] mb-3">
        <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
          <span>DiscordMTX</span>
          <div
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase ${
              status === "live" ? "bg-green-500/15 text-green-500" : "bg-gray-800 text-gray-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === "live" ? "bg-green-500 shadow-[0_0_6px_#22c55e]" : "bg-gray-400"
              }`}
            />
            <span>{statusLabel}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            title="Toggle audio chime on viewer join"
            className={`bg-[#1b1b22] border border-[#2c2c38] text-gray-400 px-2 py-1 rounded-md text-[11px] hover:bg-[#2c2c38] hover:text-white transition-colors inline-flex items-center gap-1 ${
              !soundEnabled ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : ""
            }`}
          >
            <span>{soundEnabled ? "🔔" : "🔕"}</span>
            <span>{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide my-3">
        <span>Current Viewer Password</span>
      </div>
      <div className="bg-[#1b1b22] border border-[#2c2c38] rounded-lg px-3 py-2 flex items-center justify-between gap-2 mb-3">
        <span className="font-mono text-sm text-amber-400 truncate">
          {viewerPassword ?? (status === "live" ? "unavailable" : "no active stream")}
        </span>
        <button
          onClick={copyPassword}
          disabled={!viewerPassword}
          title="Copy viewer password"
          className="bg-[#2c2c38] border border-[#3a3a48] text-gray-200 px-2 py-1 rounded-md text-[11px] hover:bg-indigo-500/30 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#1b1b22] border border-[#2c2c38] rounded-lg px-3 py-2">
          <div className="text-[11px] text-gray-400 uppercase mb-0.5">Active Viewers</div>
          <div className="text-xl font-bold text-green-500">{viewerCount}</div>
        </div>
        <div className="bg-[#1b1b22] border border-[#2c2c38] rounded-lg px-3 py-2">
          <div className="text-[11px] text-gray-400 uppercase mb-0.5">Active Streams</div>
          <div className="text-xl font-bold">{pathCount}</div>
        </div>
      </div>

      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide my-3">
        <span>Current Viewers</span>
        <span className="text-[10px] opacity-70">polling</span>
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto list-none">
        {readers.length === 0 ? (
          <li className="p-4 text-center text-gray-400 italic bg-[#1b1b22]/50 rounded-md border border-dashed border-[#2c2c38]">
            No viewers connected
          </li>
        ) : (
          readers.map((r) => (
            <li
              key={r.id}
              className="bg-[#1b1b22] border border-[#2c2c38] rounded-md px-2.5 py-2 flex justify-between items-center text-xs"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-mono font-semibold text-sky-400">{cleanRemoteAddr(r.remoteAddr)}</span>
                <span className="text-[10px] text-gray-400">
                  Path: <strong>{r.path || "default"}</strong>
                </span>
              </div>
              <div className="text-right text-[11px] text-gray-400 flex flex-col gap-0.5">
                <span>⏱ {formatDuration(r.created)}</span>
                <span>📦 {formatBytes(r.bytesSent)}</span>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide my-3">
        <span>Recent Activity</span>
        <span
          className="text-[10px] cursor-pointer underline"
          onClick={() => setEvents([])}
        >
          Clear
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto list-none">
        {events.length === 0 ? (
          <li className="p-4 text-center text-gray-400 italic bg-[#1b1b22]/50 rounded-md border border-dashed border-[#2c2c38]">
            No recent activity
          </li>
        ) : (
          events.map((e, i) => (
            <li
              key={i}
              className="bg-[#1b1b22] border border-[#2c2c38] rounded-md px-2.5 py-1.5 flex justify-between items-center text-[11px]"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold px-1.5 rounded ${
                    e.type === "join" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {e.type === "join" ? "JOIN" : "LEAVE"}
                </span>
                <span className="font-mono">{e.ip}</span>
                <span className="text-gray-400 text-[10px]">{e.text}</span>
              </div>
              <span className="font-mono text-gray-400 text-[10px]">{e.time}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
