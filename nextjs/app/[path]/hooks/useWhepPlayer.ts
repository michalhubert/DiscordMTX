import { useEffect, useRef, useState, type RefObject } from "react";

export type PlayerStatus = "connecting" | "connected" | "offline" | "error" | "kicked";

interface UseWhepPlayerOptions {
  whepUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onAutoMuteRequired?: () => void;
}

const RECONNECT_DELAY_MS = 3000;

export function useWhepPlayer({ whepUrl, videoRef, onAutoMuteRequired }: UseWhepPlayerOptions) {
  const [status, setStatus] = useState<PlayerStatus>("connecting");
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    function scheduleReconnect(delayMs = RECONNECT_DELAY_MS) {
      if (cancelled) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        if (!cancelled) connect();
      }, delayMs);
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
              onAutoMuteRequired?.();
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
          } else if (res.status === 401) {
            // Password changed or session invalid -> bounce to login page immediately
            window.location.href = "/login";
            return;
          } else if (res.status === 403) {
            const text = await res.text().catch(() => "");
            let kickedUntil: number | null = null;
            try {
              const data = JSON.parse(text);
              if (data?.error === "kicked" && typeof data.kickedUntil === "number") {
                kickedUntil = data.kickedUntil;
              }
            } catch {
              // Not JSON - fall through to the other 403 cases below.
            }

            if (kickedUntil !== null) {
              // Kicked - wait out the real cooldown instead of retrying every RECONNECT_DELAY_MS
              setStatus("kicked");
              pc.close();
              scheduleReconnect(Math.max(kickedUntil - Date.now(), 1000));
              return;
            }

            if (text.includes("Access not approved")) {
              // Access revoked or waiting room needed -> reload so JoinGate handles it
              window.location.reload();
              return;
            }
            setStatus("error");
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
  }, [whepUrl, videoRef, onAutoMuteRequired]);

  return { status };
}
