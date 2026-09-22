import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

export type StreamSourceType = "monitor" | "window" | "browser";
export type StreamVideoCodec = "auto" | "vp9" | "vp8" | "h264" | "av1";
export type StreamContentHint = "none" | "motion" | "detail" | "text";
export type StreamDegradationPreference = "balanced" | "maintain-framerate" | "maintain-resolution";
export type PathVisibility = "public" | "private";

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

const DB_PATH = "/data/sqlite/discordmtx.db";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  } catch {
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS stream_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS path_visibility (
      path TEXT PRIMARY KEY,
      visibility TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS viewer_passwords (
      path TEXT PRIMARY KEY,
      password TEXT NOT NULL
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS stream_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      started_at INTEGER NOT NULL,
      resource_id TEXT
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS denial_records (
      stream_session_id INTEGER NOT NULL,
      ip TEXT NOT NULL,
      denial_count INTEGER NOT NULL DEFAULT 1,
      denied_until INTEGER NOT NULL,
      PRIMARY KEY (stream_session_id, ip),
      FOREIGN KEY (stream_session_id) REFERENCES stream_sessions(id) ON DELETE CASCADE
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

export function getPathVisibility(path: string): PathVisibility {
  try {
    const row = getDb()
      .prepare("SELECT visibility FROM path_visibility WHERE path = ?")
      .get(path) as { visibility: string } | undefined;
    return row?.visibility === "public" ? "public" : "private";
  } catch (err) {
    console.error("Failed to read path visibility:", err);
    return "private";
  }
}

export function getAllPathVisibilities(): Record<string, PathVisibility> {
  try {
    const rows = getDb()
      .prepare("SELECT path, visibility FROM path_visibility")
      .all() as { path: string; visibility: string }[];
    const result: Record<string, PathVisibility> = {};
    for (const row of rows) {
      result[row.path] = row.visibility === "public" ? "public" : "private";
    }
    return result;
  } catch (err) {
    console.error("Failed to read path visibilities:", err);
    return {};
  }
}

export function setPathVisibility(path: string, visibility: PathVisibility): void {
  getDb()
    .prepare(
      `INSERT INTO path_visibility (path, visibility) VALUES (?, ?)
       ON CONFLICT(path) DO UPDATE SET visibility = excluded.visibility`
    )
    .run(path, visibility);
}

export function getViewerPassword(path: string): string | null {
  try {
    const row = getDb()
      .prepare("SELECT password FROM viewer_passwords WHERE path = ?")
      .get(path) as { password: string } | undefined;
    return row?.password ?? null;
  } catch (err) {
    console.error("Failed to read viewer password:", err);
    return null;
  }
}

export function setViewerPassword(path: string, password: string): void {
  getDb()
    .prepare(
      `INSERT INTO viewer_passwords (path, password) VALUES (?, ?)
       ON CONFLICT(path) DO UPDATE SET password = excluded.password`
    )
    .run(path, password);
}

export function rotateViewerPassword(path: string): string {
  const crypto = require("crypto");
  const newPassword = crypto.randomBytes(16).toString("hex");
  setViewerPassword(path, newPassword);
  return newPassword;
}

export type DenialRecord = {
  stream_session_id: number;
  ip: string;
  denial_count: number;
  denied_until: number;
};

export type StreamSession = {
  id: number;
  path: string;
  started_at: number;
  resource_id: string | null;
};

export function getStreamSessionByPath(path: string): StreamSession | null {
  try {
    const row = getDb()
      .prepare("SELECT id, path, started_at, resource_id FROM stream_sessions WHERE path = ?")
      .get(path) as StreamSession | undefined;
    return row ?? null;
  } catch (err) {
    console.error("Failed to read stream session:", err);
    return null;
  }
}

export function createStreamSession(path: string, resourceId: string | null = null): StreamSession {
  const now = Date.now();
  const result = getDb()
    .prepare("INSERT INTO stream_sessions (path, started_at, resource_id) VALUES (?, ?, ?)")
    .run(path, now, resourceId);
  
  return getStreamSessionByPath(path)!;
}

export function deleteStreamSession(path: string): void {
  getDb()
    .prepare("DELETE FROM stream_sessions WHERE path = ?")
    .run(path);
}

export function getDenialRecord(streamSessionId: number, ip: string): DenialRecord | null {
  try {
    const row = getDb()
      .prepare("SELECT stream_session_id, ip, denial_count, denied_until FROM denial_records WHERE stream_session_id = ? AND ip = ?")
      .get(streamSessionId, ip) as DenialRecord | undefined;
    return row ?? null;
  } catch (err) {
    console.error("Failed to read denial record:", err);
    return null;
  }
}

export function setDenialRecord(streamSessionId: number, ip: string, denialCount: number, deniedUntil: number): void {
  getDb()
    .prepare(
      `INSERT INTO denial_records (stream_session_id, ip, denial_count, denied_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(stream_session_id, ip) DO UPDATE SET denial_count = excluded.denial_count, denied_until = excluded.denied_until`
    )
    .run(streamSessionId, ip, denialCount, deniedUntil);
}

export function deleteDenialRecord(streamSessionId: number, ip: string): void {
  getDb()
    .prepare("DELETE FROM denial_records WHERE stream_session_id = ? AND ip = ?")
    .run(streamSessionId, ip);
}

export function pruneExpiredDenialRecords(): void {
  const now = Date.now();
  getDb()
    .prepare("DELETE FROM denial_records WHERE denied_until < ?")
    .run(now);
}
