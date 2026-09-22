import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

export type StreamSourceType = "monitor" | "window" | "browser";
export type StreamVideoCodec = "auto" | "vp9" | "vp8" | "h264" | "av1";
export type StreamContentHint = "none" | "motion" | "detail" | "text";
export type StreamDegradationPreference = "balanced" | "maintain-framerate" | "maintain-resolution";

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

// Fixed on purpose: the SQLite database always lives at this path inside the
// container, mount /data/sqlite as a volume to persist it (not configurable).
const DB_PATH = "/data/sqlite/discordmtx.db";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  } catch {
    // ignore, directory may already exist or be unwritable in dev
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS stream_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `);
  return db;
}

export function getStreamSettings(): StreamSettings {
  try {
    const row = getDb()
      .prepare("SELECT data FROM stream_settings WHERE id = 1")
      .get() as { data: string } | undefined;
    if (!row) return DEFAULT_STREAM_SETTINGS;
    return { ...DEFAULT_STREAM_SETTINGS, ...JSON.parse(row.data) };
  } catch (err) {
    console.error("Failed to read stream settings:", err);
    return DEFAULT_STREAM_SETTINGS;
  }
}

export function saveStreamSettings(settings: StreamSettings): void {
  const data = JSON.stringify(settings);
  getDb()
    .prepare(
      `INSERT INTO stream_settings (id, data) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    )
    .run(data);
}
