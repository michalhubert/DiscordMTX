// No DB imports, so the /stream page can use this too.

export const SOURCE_TYPES = ["monitor", "window", "browser"] as const;
export const VIDEO_CODECS = ["auto", "vp9", "vp8", "h264", "av1"] as const;
export const CONTENT_HINTS = ["none", "motion", "detail", "text"] as const;
export const DEGRADATION_PREFERENCES = ["balanced", "maintain-framerate", "maintain-resolution"] as const;

export type StreamSourceType = (typeof SOURCE_TYPES)[number];
export type StreamVideoCodec = (typeof VIDEO_CODECS)[number];
export type StreamContentHint = (typeof CONTENT_HINTS)[number];
export type StreamDegradationPreference = (typeof DEGRADATION_PREFERENCES)[number];

// MediaMTX path names must be safe for MTX_PATHS_<NAME>_* env vars and URLs:
// letters, digits, and forward slashes only (matches MediaMTX's own path
// naming rules), 1-64 chars.
export const PATH_NAME_RE = /^[A-Za-z0-9/]{1,64}$/;

export type StreamSettings = {
  path: string;
  sourceType: StreamSourceType;
  fixedResolution: boolean;
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  videoCodec: StreamVideoCodec;
  contentHint: StreamContentHint;
  degradationPreference: StreamDegradationPreference;
  includeAudio: boolean;
  audioBitrateKbps: number;
};

export const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  path: "",
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
