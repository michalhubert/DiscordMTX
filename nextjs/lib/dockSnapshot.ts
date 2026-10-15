import { listPendingRequests, type PendingRequest } from "./accessRequests";
import { getAllPathVisibilities, getViewerPassword, type PathVisibility } from "./db";
import { cachedGuestIdentity, ponyKeyForSession } from "./guestIdentity";
import {
  fetchWebrtcSessions,
  listConfiguredPaths,
  pathNames,
  type WebrtcSessionItem,
} from "./mediamtx";
import { refreshStreamStates } from "./streamState";
import { getViewerIdentity, pruneViewerIdentities } from "./viewerIdentities";

export type DockViewer = {
  id: string;
  path: string | null;
  created: string | null;
  bytesSent: number;
  name: string | null;
  image: string | null;
  role: string | null;
  ip: string | null;
  hasPony: boolean;
  // The real Discord account behind a pony.
  discordName: string | null;
  discordImage: string | null;
};

export type DockSnapshot = {
  mediamtxReachable: boolean;
  paths: string[];
  livePaths: string[];
  viewers: DockViewer[];
  pending: PendingRequest[];
  visibility: Record<string, PathVisibility>;
  currentPath: string | null;
  viewerPassword: string | null;
};

function toDockViewer(item: WebrtcSessionItem): DockViewer {
  const identity = getViewerIdentity(item.id);
  const guest = ponyKeyForSession(identity);
  // Looked up each time: a pony can change while connected (avatar picked later, reroll).
  const pony = guest ? cachedGuestIdentity(guest.path, guest.ponyKey) : null;
  const ponyOfDiscordViewer = !!pony && identity?.role === "discord";
  return {
    id: item.id,
    path: item.path ?? identity?.path ?? null,
    created: typeof item.created === "string" ? item.created : null,
    bytesSent: typeof item.bytesSent === "number" ? item.bytesSent : 0,
    name: pony?.name ?? identity?.name ?? null,
    image: pony ? pony.image : (identity?.image ?? null),
    role: identity?.role ?? null,
    ip: identity?.ip ?? null,
    hasPony: !!pony,
    discordName: ponyOfDiscordViewer ? identity.name : null,
    discordImage: ponyOfDiscordViewer ? identity.image : null,
  };
}

export async function dockSnapshot(): Promise<DockSnapshot> {
  const [livePathItems, sessions, configured] = await Promise.all([
    refreshStreamStates(),
    fetchWebrtcSessions(),
    listConfiguredPaths(),
  ]);

  if (sessions) pruneViewerIdentities(sessions.map((s) => s.id));
  // Attempts that never connect would otherwise show up as a join and a leave.
  const readers = (sessions ?? []).filter((s) => s.peerConnectionEstablished && s.state === "read");
  const livePaths = (livePathItems ?? []).filter((p) => p.ready).map((p) => p.name);

  const currentPath = livePaths[0] ?? null;
  return {
    mediamtxReachable: !!(livePathItems && sessions),
    paths: pathNames(configured, livePathItems),
    livePaths,
    viewers: readers.map(toDockViewer),
    pending: listPendingRequests(),
    visibility: getAllPathVisibilities(),
    currentPath,
    viewerPassword: currentPath ? getViewerPassword(currentPath) : null,
  };
}
