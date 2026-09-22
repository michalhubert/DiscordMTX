"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Monitor, Radio, RefreshCw, Save, Square } from "lucide-react";
import DockClient from "../dock/DockClient";

type SourceType = "monitor" | "window" | "browser";
type VideoCodec = "auto" | "vp9" | "vp8" | "h264" | "av1";
type ContentHint = "none" | "motion" | "detail" | "text";
type DegradationPreference = "balanced" | "maintain-framerate" | "maintain-resolution";

type StreamSettings = {
  path: string;
  sourceType: SourceType;
  fixedResolution: boolean;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  videoCodec: VideoCodec;
  contentHint: ContentHint;
  degradationPreference: DegradationPreference;
  includeAudio: boolean;
  audioBitrateKbps: number;
};

const DEFAULT_SETTINGS: StreamSettings = {
  path: "browser",
  sourceType: "monitor",
  fixedResolution: false,
  width: 1920,
  height: 1080,
  fps: 30,
  videoBitrateKbps: 6000,
  videoCodec: "h264",
  contentHint: "motion",
  degradationPreference: "maintain-framerate",
  includeAudio: true,
  audioBitrateKbps: 128,
};

type Status = "idle" | "starting" | "live" | "error";

// Sets the Opus target bitrate via SDP munging (no setParameters() equivalent
// for audio), and disables DTX / enables in-band FEC to avoid audio choppiness.
function applyAudioSdpOptions(sdp: string, kbps: number): string {
  const lines = sdp.split("\r\n");
  const audioIndex = lines.findIndex((l) => l.startsWith("m=audio"));
  if (audioIndex === -1) return sdp;

  let opusPayload: string | null = null;
  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+) opus\/\d+/i);
    if (match) {
      opusPayload = match[1];
      break;
    }
  }
  if (!opusPayload) return sdp;

  const extraParams = [`maxaveragebitrate=${kbps * 1000}`, "usedtx=0", "useinbandfec=1"];

  const fmtpIndex = lines.findIndex((l) => l.startsWith(`a=fmtp:${opusPayload} `));
  if (fmtpIndex !== -1) {
    for (const param of extraParams) {
      const [key] = param.split("=");
      if (!new RegExp(`${key}=`).test(lines[fmtpIndex])) {
        lines[fmtpIndex] += `;${param}`;
      }
    }
  } else {
    lines.splice(audioIndex + 1, 0, `a=fmtp:${opusPayload} ${extraParams.join(";")}`);
  }
  return lines.join("\r\n");
}

function codecMimeType(codec: VideoCodec): string | null {
  switch (codec) {
    case "vp9":
      return "video/VP9";
    case "vp8":
      return "video/VP8";
    case "h264":
      return "video/H264";
    case "av1":
      return "video/AV1";
    default:
      return null;
  }
}

// Sorts Baseline-profile H.264 (no B-frames) ahead of Main/High to reduce latency.
type RTCCodecCapability = NonNullable<ReturnType<typeof RTCRtpSender.getCapabilities>>["codecs"][number];

function preferBaselineH264(codecs: RTCCodecCapability[]): RTCCodecCapability[] {
  const isBaseline = (c: RTCCodecCapability) =>
    c.mimeType.toLowerCase() === "video/h264" && /profile-level-id=42/i.test(c.sdpFmtpLine ?? "");
  const isOtherH264 = (c: RTCCodecCapability) =>
    c.mimeType.toLowerCase() === "video/h264" && !isBaseline(c);

  const baseline = codecs.filter(isBaseline);
  const otherH264 = codecs.filter(isOtherH264);
  const rest = codecs.filter((c) => c.mimeType.toLowerCase() !== "video/h264");

  return [...baseline, ...rest, ...otherH264];
}

// Rounds a value to the nearest hundred and clamps it within [min, max].
function roundToHundred(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const rounded = Math.round(value / 100) * 100;
  return Math.min(max, Math.max(min, rounded));
}

export default function StreamClient() {
  const [settings, setSettings] = useState<StreamSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [changingSource, setChangingSource] = useState(false);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const whipResourceIdRef = useRef<string | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const whipPathRef = useRef<string>(DEFAULT_SETTINGS.path);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/stream/settings");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setSettings((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error("Failed to load stream settings:", err);
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Populates the path selector from MediaMTX's configured paths (paths.yml) - no custom/arbitrary paths allowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopStream = useCallback(async () => {
    const pc = pcRef.current;
    pcRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    videoSenderRef.current = null;
    audioSenderRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    pc?.close();

    const resourceId = whipResourceIdRef.current;
    whipResourceIdRef.current = null;
    if (resourceId) {
      try {
        await fetch(`/api/whip/${whipPathRef.current}?id=${encodeURIComponent(resourceId)}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to tear down WHIP session:", err);
      }
    }

    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  function buildVideoConstraints(): MediaTrackConstraints {
    const videoConstraints: MediaTrackConstraints & { displaySurface?: string } = {
      frameRate: { ideal: settings.fps },
    };
    if (settings.sourceType !== "browser") {
      videoConstraints.displaySurface = settings.sourceType;
    }
    if (settings.fixedResolution) {
      videoConstraints.width = { ideal: settings.width };
      videoConstraints.height = { ideal: settings.height };
    }
    return videoConstraints as MediaTrackConstraints;
  }

  // Falls back to video-only if the browser can't provide the requested audio track.
  async function captureDisplayMedia(): Promise<MediaStream> {
    const videoConstraints = buildVideoConstraints();
    if (!settings.includeAudio) {
      return navigator.mediaDevices.getDisplayMedia({ video: videoConstraints, audio: false });
    }
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    // Chrome-only hints: for a window    // only (not full system audio); for a screen, only offer system audio there.
    const displayMediaOptions: DisplayMediaStreamOptions & {
      systemAudio?: "include" | "exclude";
      windowAudio?: "exclude" | "window" | "system";
    } = {
      video: videoConstraints,
      audio: audioConstraints,
      systemAudio: settings.sourceType === "monitor" ? "include" : "exclude",
      windowAudio: settings.sourceType === "window" ? "window" : undefined,
    };
    try {
      return await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err) {
      const name = err instanceof Error ? err.name : "UnknownError";
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to capture with audio (${name}: ${message}), retrying video-only:`, err);
      setErrorMessage(
        `Couldn't capture audio (${name}: ${message}). Audio support for a single window depends on your browser/OS (Chrome hints at window-only audio, but may ignore it); "Entire desktop" or a "Browser tab" are more reliable, and you must tick "Share audio" in the picker. If you have a virtual surround sound effect enabled on your headphones/audio device, try disabling it — it's a known cause of this error. Continuing with video only.`
      );
      return navigator.mediaDevices.getDisplayMedia({ video: videoConstraints, audio: false });
    }
  }

  async function startStream() {
    setErrorMessage(null);

    if (!availablePaths.includes(settings.path)) {
      setErrorMessage("Invalid path: pick one of the paths configured in paths.yml.");
      return;
    }

    setStatus("starting");

    try {
      const displayStream = await captureDisplayMedia();
      mediaStreamRef.current = displayStream;

      if (videoRef.current) {
        videoRef.current.srcObject = displayStream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        bundlePolicy: "max-bundle",
        iceCandidatePoolSize: 4,
      });
      pcRef.current = pc;

      const videoTrack = displayStream.getVideoTracks()[0];
      const audioTrack = displayStream.getAudioTracks()[0];

      if (settings.contentHint !== "none") {
        videoTrack.contentHint = settings.contentHint;
      }

      videoTrack.addEventListener("ended", () => {
        stopStream();
      });

      const videoTransceiver = pc.addTransceiver(videoTrack, { direction: "sendonly" });
      videoSenderRef.current = videoTransceiver.sender;
      const mimeType = codecMimeType(settings.videoCodec);
      if ("setCodecPreferences" in videoTransceiver) {
        try {
          const capabilities = RTCRtpSender.getCapabilities("video");
          let codecs = preferBaselineH264(capabilities?.codecs ?? []);
          if (mimeType) {
            const preferred = codecs.filter((c) => c.mimeType === mimeType);
            const rest = codecs.filter((c) => c.mimeType !== mimeType);
            if (preferred.length > 0) codecs = [...preferred, ...rest];
          }
          if (codecs.length > 0) {
            videoTransceiver.setCodecPreferences(codecs);
          }
        } catch (err) {
          console.error("Failed to set codec preferences:", err);
        }
      }

      try {
        const params = videoTransceiver.sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = settings.videoBitrateKbps * 1000;
        params.encodings[0].maxFramerate = settings.fps;
        (params.encodings[0] as RTCRtpEncodingParameters & { priority?: string; networkPriority?: string }).priority = "high";
        (params.encodings[0] as RTCRtpEncodingParameters & { priority?: string; networkPriority?: string }).networkPriority = "high";
        params.degradationPreference = settings.degradationPreference;
        await videoTransceiver.sender.setParameters(params);
      } catch (err) {
        console.error("Failed to apply video encoding parameters:", err);
      }

      if (settings.includeAudio && audioTrack) {
        const audioTransceiver = pc.addTransceiver(audioTrack, { direction: "sendonly" });
        audioSenderRef.current = audioTransceiver.sender;
      }

      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const state = pc.connectionState;
        if (state === "connected") {
          setStatus("live");
        } else if (state === "failed" || state === "closed") {
          setStatus((prev) => (prev === "idle" ? prev : "error"));
        }
      };

      const offer = await pc.createOffer();
      let sdp = offer.sdp ?? "";
      if (settings.includeAudio && audioTrack) {
        sdp = applyAudioSdpOptions(sdp, settings.audioBitrateKbps);
      }
      await pc.setLocalDescription({ type: "offer", sdp });

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

      whipPathRef.current = settings.path || DEFAULT_SETTINGS.path;
      const res = await fetch(`/api/whip/${encodeURIComponent(whipPathRef.current)}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp ?? sdp,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`WHIP publish failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
      }

      const resourceId = res.headers.get("id") || res.headers.get("location")?.split("/").filter(Boolean).pop();
      whipResourceIdRef.current = resourceId ?? null;

      const answerSdp = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("Failed to start stream:", err);
      const message = err instanceof Error ? err.message : "Failed to start stream";
      setErrorMessage(message);
      await stopStream();
      setStatus("error");
    }
  }

  // Lets the user swap the shared desktop/window/tab mid-stream, like Discord's "Change source".
  async function changeSource() {
    if (!pcRef.current || !videoSenderRef.current) return;

    setChangingSource(true);
    setErrorMessage(null);
    try {
      const newDisplayStream = await captureDisplayMedia();

      const newVideoTrack = newDisplayStream.getVideoTracks()[0];
      const newAudioTrack = newDisplayStream.getAudioTracks()[0];
      if (settings.contentHint !== "none") {
        newVideoTrack.contentHint = settings.contentHint;
      }

      const oldStream = mediaStreamRef.current;
      const oldVideoTrack = oldStream?.getVideoTracks()[0];
      const oldAudioTrack = oldStream?.getAudioTracks()[0];

      await videoSenderRef.current.replaceTrack(newVideoTrack);

      let previewAudioTrack = oldAudioTrack ?? null;
      if (newAudioTrack && audioSenderRef.current) {
        await audioSenderRef.current.replaceTrack(newAudioTrack);
        previewAudioTrack = newAudioTrack;
        oldAudioTrack?.stop();
      } else if (newAudioTrack) {
        // No pre-existing audio sender, so the new source's audio can't be added without renegotiation.
        newAudioTrack.stop();
      }

      oldVideoTrack?.stop();

      newVideoTrack.addEventListener("ended", () => {
        stopStream();
      });

      const previewStream = new MediaStream(
        [newVideoTrack, previewAudioTrack].filter((t): t is MediaStreamTrack => Boolean(t))
      );
      mediaStreamRef.current = previewStream;
      if (videoRef.current) {
        videoRef.current.srcObject = previewStream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error("Failed to change source:", err);
    } finally {
      setChangingSource(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/stream/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => ({ ...prev, ...data }));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch (err) {
      console.error("Failed to save stream settings:", err);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof StreamSettings>(key: K, value: StreamSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const isLive = status === "live" || status === "starting";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-start">
      <div className="max-w-3xl w-full mx-auto lg:mx-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <h1 className="text-xl font-semibold text-white">Browser Stream</h1>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
              status === "live" ? "bg-green-500/15 text-green-500" : "bg-gray-800 text-gray-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === "live" ? "bg-green-500 shadow-[0_0_6px_#22c55e]" : "bg-gray-500"
              }`}
            />
            {status === "starting" ? "Starting…" : status === "live" ? "Live" : status === "error" ? "Error" : "Idle"}
          </div>
        </div>

        <div className="bg-black rounded-xl overflow-hidden border border-gray-800 aspect-video mb-6 flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
          {status === "idle" && (
            <div className="absolute flex flex-col items-center gap-2 text-gray-500">
              <Monitor className="w-8 h-8" />
              <span className="text-sm">No source selected</span>
            </div>
          )}
        </div>

        {errorMessage && (
          <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
        )}

        <div className="flex gap-3 mb-8">
          {!isLive ? (
            <button
              onClick={startStream}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors inline-flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              Start Streaming
            </button>
          ) : (
            <>
              <button
                onClick={changeSource}
                disabled={status === "starting" || changingSource}
                title="Pick a different desktop, window, or tab to share, without interrupting the stream"
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {changingSource ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Change Source
              </button>
              <button
                onClick={() => stopStream()}
                disabled={status === "starting"}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === "starting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                Stop Streaming
              </button>
            </>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide mb-4">Settings</h2>

          {loadingSettings ? (
            <p className="text-sm text-gray-500">Loading settings…</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Path</label>
                <select
                  value={settings.path}
                  onChange={(e) => update("path", e.target.value)}
                  disabled={isLive || availablePaths.length === 0}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50 font-mono"
                >
                  {!availablePaths.includes(settings.path) && (
                    <option value={settings.path}>{settings.path}</option>
                  )}
                  {availablePaths.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  {availablePaths.length === 0
                    ? "Loading paths from MediaMTX…"
                    : availablePaths.includes(settings.path)
                    ? `Publishes to MediaMTX at "${settings.path}" — viewers watch it at /${settings.path}. Only paths declared in paths.yml can be used.`
                    : `"${settings.path}" isn't declared in paths.yml — pick one of the paths listed above.`}
                </p>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Preferred source</label>
                <select
                  value={settings.sourceType}
                  onChange={(e) => update("sourceType", e.target.value as SourceType)}
                  disabled={isLive}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="monitor">Entire desktop</option>
                  <option value="window">Application window</option>
                  <option value="browser">Browser tab</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  This only pre-selects the tab in the browser&apos;s share picker — you can still pick a different
                  source there.
                </p>
                {settings.sourceType === "window" && settings.includeAudio && (
                  <p className="text-[11px] text-yellow-500 mt-1">
                    Heads up: window audio is scoped to that window only (not the whole desktop) via a Chrome-only
                    hint, but support varies — some browsers/OSes still can&apos;t provide it. Pick &quot;Entire
                    desktop&quot; or &quot;Browser tab&quot; instead if it doesn&apos;t work.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="fixedResolution"
                  type="checkbox"
                  checked={settings.fixedResolution}
                  onChange={(e) => update("fixedResolution", e.target.checked)}
                  disabled={isLive}
                  className="accent-red-500"
                />
                <label htmlFor="fixedResolution" className="text-gray-300 text-sm">
                  Fix output resolution
                </label>
              </div>

              {settings.fixedResolution && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Width</label>
                    <input
                      type="number"
                      value={settings.width}
                      onChange={(e) => update("width", Number(e.target.value))}
                      disabled={isLive}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-400 text-xs mb-1">Height</label>
                    <input
                      type="number"
                      value={settings.height}
                      onChange={(e) => update("height", Number(e.target.value))}
                      disabled={isLive}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Framerate (fps)</label>
                  <input
                    type="number"
                    value={settings.fps}
                    onChange={(e) => update("fps", Number(e.target.value))}
                    disabled={isLive}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Video codec</label>
                  <select
                    value={settings.videoCodec}
                    onChange={(e) => update("videoCodec", e.target.value as VideoCodec)}
                    disabled={isLive}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="h264">H.264 (hardware/NVENC, recommended)</option>
                    <option value="auto">Auto</option>
                    <option value="vp9">VP9</option>
                    <option value="vp8">VP8</option>
                    <option value="av1">AV1</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    H.264 always negotiates a B-frame-free Baseline profile for lower latency. There is no API for a
                    web page to pick a specific encoder (e.g. NVENC) - the browser decides - but Chrome only
                    hardware-accelerates H.264 broadly (VP8 has no hardware encoder at all, VP9/AV1 support is
                    limited), so H.264 is the closest equivalent to what OBS does with NVENC at high bitrates.
                    Make sure hardware acceleration is enabled in your browser's settings.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Content hint</label>
                  <select
                    value={settings.contentHint}
                    onChange={(e) => update("contentHint", e.target.value as ContentHint)}
                    disabled={isLive}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="motion">Motion (games, video)</option>
                    <option value="detail">Detail (static content)</option>
                    <option value="text">Text (reading/slides)</option>
                    <option value="none">Browser default</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Degradation preference</label>
                  <select
                    value={settings.degradationPreference}
                    onChange={(e) => update("degradationPreference", e.target.value as DegradationPreference)}
                    disabled={isLive}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="maintain-framerate">Maintain framerate (less stutter)</option>
                    <option value="maintain-resolution">Maintain resolution (sharper)</option>
                    <option value="balanced">Balanced</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <label className="block text-gray-400 text-xs">Video bitrate (kbps)</label>
                  <input
                    type="number"
                    min={500}
                    max={20000}
                    step={100}
                    value={settings.videoBitrateKbps}
                    onChange={(e) => update("videoBitrateKbps", Number(e.target.value))}
                    onBlur={(e) =>
                      update("videoBitrateKbps", roundToHundred(Number(e.target.value), 500, 20000))
                    }
                    disabled={isLive}
                    className="w-24 bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-sm text-right disabled:opacity-50"
                  />
                </div>
                <input
                  type="range"
                  min={500}
                  max={20000}
                  step={100}
                  value={settings.videoBitrateKbps}
                  onChange={(e) => update("videoBitrateKbps", Number(e.target.value))}
                  disabled={isLive}
                  className="w-full accent-red-500 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="includeAudio"
                  type="checkbox"
                  checked={settings.includeAudio}
                  onChange={(e) => update("includeAudio", e.target.checked)}
                  disabled={isLive}
                  className="accent-red-500"
                />
                <label htmlFor="includeAudio" className="text-gray-300 text-sm">
                  Include audio (system/tab, if supported by your browser)
                </label>
              </div>

              {settings.includeAudio && (
                <div>
                  <label className="block text-gray-400 text-xs mb-1">
                    Audio bitrate: {settings.audioBitrateKbps} kbps
                  </label>
                  <input
                    type="range"
                    min={32}
                    max={320}
                    step={8}
                    value={settings.audioBitrateKbps}
                    onChange={(e) => update("audioBitrateKbps", Number(e.target.value))}
                    disabled={isLive}
                    className="w-full accent-red-500 disabled:opacity-50"
                  />
                </div>
              )}

              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-[360px] shrink-0 rounded-xl overflow-hidden border border-gray-800">
        <DockClient />
      </div>
      </div>
    </div>
  );
}
