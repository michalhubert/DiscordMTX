import { listPendingRequests, type PendingRequest } from "./accessRequests";
import { getAllPathVisibilities, getViewerPassword, type PathVisibility } from "./db";
import { cachedGuestIdentity, ponyKeyForSession } from "./guestIdentity";
import { fetchWebrtcSessions, type WebrtcSessionItem } from "./mediamtx";
import { refreshStreamStates } from "./streamState";
import { getViewerIdentity, pruneViewerIdentities } from "./viewerIdentities";

export type DockViewer = {
  id: string;
  path: string | null;
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
  livePaths: string[];
  viewers: DockViewer[];
  pending: PendingRequest[];
  visibility: Record<string, PathVisibility>;
  viewerPasswords: Record<string, string | null>;
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
  const [livePathItems, sessions] = await Promise.all([
    refreshStreamStates(),
    fetchWebrtcSessions(),
  ]);

  if (sessions) pruneViewerIdentities(sessions.map((s) => s.id));
  // Attempts that never connect would otherwise show up as a join and a leave.
  const readers = (sessions ?? []).filter((s) => s.peerConnectionEstablished && s.state === "read");
  const livePaths = (livePathItems ?? []).filter((p) => p.ready).map((p) => p.name);

  return {
    mediamtxReachable: !!(livePathItems && sessions),
    livePaths,
    viewers: readers.map(toDockViewer),
    pending: listPendingRequests(),
    visibility: getAllPathVisibilities(),
    viewerPasswords: Object.fromEntries(livePaths.map((p) => [p, getViewerPassword(p)])),
  };
}
