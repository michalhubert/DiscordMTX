"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Clock, Globe, HardDrive, Lock, RefreshCw } from "lucide-react";

type WebrtcSession = {
  id: string;
  state?: string;
  path?: string;
  created?: string;
  bytesSent?: number;
  remoteAddr?: string;
  viewerName?: string | null;
  viewerImage?: string | null;
  viewerRole?: string | null;
  viewerIp?: string | null;
};

type MtxPath = {
  name: string;
  ready: boolean;
  readers?: unknown[];
};

type StreamEvent = {
  type: "join" | "leave";
  text: string;
  viewer: string;
  time: string;
};

type Visibility = "public" | "private";

type PendingRequest = {
  ip: string;
  path: string;
  name: string | null;
  image: string | null;
  requestedAt: number;
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

export default function DockClient() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [status, setStatus] = useState<"checking" | "live" | "offline" | "error">("checking");
  const [viewerCount, setViewerCount] = useState(0);
  const [readers, setReaders] = useState<WebrtcSession[]>([]);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [viewerPassword, setViewerPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [visibilities, setVisibilities] = useState<Record<string, Visibility>>({});
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [busyRequestKey, setBusyRequestKey] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("default");

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const knownSessions = useRef<Map<string, string>>(new Map());
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

  function logEvent(type: "join" | "leave", text: string, viewer: string) {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    setEvents((prev) => [{ type, text, viewer, time: timeStr }, ...prev].slice(0, MAX_EVENTS));
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshData() {
      try {
        const [sessionsRes, pathsRes] = await Promise.allSettled([
          fetch("/api/dock/viewers"),
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

        const currentSessions = new Map(
          currentReaders.map((r) => [r.id, r.viewerName || "Guest"])
        );

        if (!initialLoad.current && !hasAuthError) {
          for (const reader of currentReaders) {
            if (!knownSessions.current.has(reader.id)) {
              const viewer = reader.viewerName || "Guest";
              logEvent("join", `joined /${reader.path || "stream"}`, viewer);
              playChime(true);
            }
          }
          for (const [oldId, oldViewer] of knownSessions.current) {
            if (!currentSessions.has(oldId)) {
              logEvent("leave", "disconnected", oldViewer);
              playChime(false);
            }
          }
        }
        knownSessions.current = currentSessions;
        initialLoad.current = false;

        setReaders(currentReaders);
      } catch (err) {
        console.error("Error updating streamer HUD:", err);
        setStatus("error");
      }
    }

    refreshData();
    const interval = setInterval(refreshData, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshPassword() {
      try {
        const res = await fetch(`/api/dock/password?path=${encodeURIComponent(currentPath)}`);
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

  // Populates the path list (for visibility toggles) from MediaMTX's configured + runtime paths.
  useEffect(() => {
    let cancelled = false;

    async function refreshPaths() {
      try {
        const [configRes, runtimeRes] = await Promise.allSettled([
          fetch("/api/mediamtx/config/paths/list"),
          fetch("/api/mediamtx/paths/list"),
        ]);

        const names = new Set<string>();
        for (const res of [configRes, runtimeRes]) {
          if (res.status === "fulfilled" && res.value.ok) {
            const data = await res.value.json();
            for (const item of data.items ?? []) {
              if (item?.name) names.add(item.name as string);
            }
          }
        }

        if (!cancelled) setAvailablePaths(Array.from(names).sort());
      } catch (err) {
        console.error("Failed to load MediaMTX path list:", err);
      }
    }

    refreshPaths();
    const interval = setInterval(refreshPaths, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshVisibilities() {
      try {
        const res = await fetch("/api/streams/visibility");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setVisibilities(data ?? {});
      } catch (err) {
        console.error("Failed to load stream visibility settings:", err);
      }
    }

    refreshVisibilities();
    const interval = setInterval(refreshVisibilities, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshPending() {
      try {
        const res = await fetch("/api/streams/pending");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPendingRequests(data.items ?? []);
      } catch (err) {
        console.error("Failed to load pending join requests:", err);
      }
    }

    refreshPending();
    const interval = setInterval(refreshPending, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function toggleVisibility(path: string) {
    const next: Visibility = visibilities[path] === "private" ? "public" : "private";
    setBusyPath(path);
    try {
      const res = await fetch("/api/streams/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, visibility: next }),
      });
      if (res.ok) {
        setVisibilities((prev) => ({ ...prev, [path]: next }));
      }
    } catch (err) {
      console.error("Failed to update stream visibility:", err);
    } finally {
      setBusyPath(null);
    }
  }

  async function approveRequest(req: PendingRequest) {
    const requestKey = `${req.path}:${req.ip}`;
    setBusyRequestKey(requestKey);
    try {
      const res = await fetch("/api/streams/pending/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: req.path, ip: req.ip }),
      });
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => `${r.path}:${r.ip}` !== requestKey));
      }
    } catch (err) {
      console.error("Failed to approve join request:", err);
    } finally {
      setBusyRequestKey(null);
    }
  }

  async function denyRequest(req: PendingRequest) {
    const requestKey = `${req.path}:${req.ip}`;
    setBusyRequestKey(requestKey);
    try {
      const res = await fetch("/api/streams/pending/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: req.path, ip: req.ip }),
      });
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => `${r.path}:${r.ip}` !== requestKey));
      }
    } catch (err) {
      console.error("Failed to deny join request:", err);
    } finally {
      setBusyRequestKey(null);
    }
  }

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

  async function rotatePassword() {
    try {
      const res = await fetch(`/api/dock/password?path=${encodeURIComponent(currentPath)}`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setViewerPassword(data.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to rotate password:", err);
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
            {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
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
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={rotatePassword}
            title="Rotate viewer password"
            className="bg-[#2c2c38] border border-[#3a3a48] text-gray-200 px-2 py-1 rounded-md text-[11px] hover:bg-amber-500/30 hover:text-white transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={copyPassword}
            disabled={!viewerPassword}
            title="Copy viewer password"
            className="bg-[#2c2c38] border border-[#3a3a48] text-gray-200 px-2 py-1 rounded-md text-[11px] hover:bg-indigo-500/30 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="bg-[#1b1b22] border border-[#2c2c38] rounded-lg px-3 py-2">
          <div className="text-[11px] text-gray-400 uppercase mb-0.5">Active Viewers</div>
          <div className="text-xl font-bold text-green-500">{viewerCount}</div>
        </div>
      </div>

      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide my-3">
        <span>Stream Access</span>
      </div>
      <ul className="flex flex-col gap-1.5 mb-3 list-none">
        {availablePaths.length === 0 ? (
          <li className="p-4 text-center text-gray-400 italic bg-[#1b1b22]/50 rounded-md border border-dashed border-[#2c2c38]">
            No paths configured
          </li>
        ) : (
          availablePaths.map((p) => {
            const visibility = visibilities[p] ?? "private";
            const isPrivate = visibility === "private";
            return (
              <li
                key={p}
                className="bg-[#1b1b22] border border-[#2c2c38] rounded-md px-2.5 py-2 flex justify-between items-center text-xs"
              >
                <span className="font-mono text-sky-400">/{p}</span>
                <button
                  onClick={() => toggleVisibility(p)}
                  disabled={busyPath === p}
                  title="Toggle between public (anyone can join) and private (streamer approves each viewer)"
                  className={`text-[11px] font-semibold px-2 py-1 rounded-full uppercase transition-colors disabled:opacity-40 ${
                    isPrivate ? "bg-amber-500/15 text-amber-400" : "bg-green-500/15 text-green-500"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {isPrivate ? "Private" : "Public"}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex justify-between items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide my-3">
        <span>Pending Requests</span>
        {pendingRequests.length > 0 && (
          <span className="text-[10px] font-bold text-amber-400">{pendingRequests.length}</span>
        )}
      </div>
      <ul className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto list-none mb-3">
        {pendingRequests.length === 0 ? (
          <li className="p-4 text-center text-gray-400 italic bg-[#1b1b22]/50 rounded-md border border-dashed border-[#2c2c38]">
            No pending requests
          </li>
        ) : (
          pendingRequests.map((req) => (
            <li
              key={`${req.path}:${req.ip}`}
              className="bg-[#1b1b22] border border-[#2c2c38] rounded-md px-2.5 py-2 flex justify-between items-center text-xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {req.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={req.image} alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#2c2c38] shrink-0 flex items-center justify-center text-[10px] font-semibold text-gray-400">
                    {(req.name || req.ip).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-semibold text-sky-400 truncate">{req.name ?? req.ip}</span>
                  <span className="text-[10px] text-gray-400">
                    wants to join <strong>/{req.path}</strong>
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => approveRequest(req)}
                  disabled={busyRequestKey === `${req.path}:${req.ip}`}
                  className="bg-green-500/20 text-green-500 px-2 py-1 rounded-md text-[11px] font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => denyRequest(req)}
                  disabled={busyRequestKey === `${req.path}:${req.ip}`}
                  className="bg-red-500/20 text-red-500 px-2 py-1 rounded-md text-[11px] font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-40"
                >
                  Deny
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

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
              <div className="flex items-center gap-2">
                {r.viewerImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.viewerImage} alt="" className="w-6 h-6 rounded-full shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#2c2c38] shrink-0 flex items-center justify-center text-[10px] font-semibold text-gray-400">
                    {(r.viewerName || "G").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-sky-400">
                    {r.viewerRole === "discord" ? r.viewerName || "Guest" : r.viewerIp || r.viewerName || "Guest"}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Path: <strong>{r.path || "default"}</strong>
                  </span>
                </div>
              </div>
              <div className="text-right text-[11px] text-gray-400 flex flex-col gap-0.5">
                <span className="inline-flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" /> {formatDuration(r.created)}
                </span>
                <span className="inline-flex items-center justify-end gap-1">
                  <HardDrive className="w-3 h-3" /> {formatBytes(r.bytesSent)}
                </span>
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
                <span className="font-semibold">{e.viewer}</span>
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
