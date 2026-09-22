import { useEffect, useState, type RefObject } from "react";

export function useFullscreen(
  containerRef: RefObject<HTMLDivElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>
) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  function isCurrentlyFullscreen(): boolean {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    const video = videoRef.current as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | null;
    return !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      video?.webkitDisplayingFullscreen
    );
  }

  async function toggleFullscreen() {
    const container = containerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      mozRequestFullScreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    }) | null;

    const video = videoRef.current as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      requestFullscreen?: () => Promise<void>;
    }) | null;

    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    if (isCurrentlyFullscreen()) {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        } else if (video?.webkitExitFullscreen) {
          video.webkitExitFullscreen();
        }
      } catch {}
      setIsFullscreen(false);
    } else {
      try {
        if (container?.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
        } else if (container?.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen();
          setIsFullscreen(true);
        } else if (container?.mozRequestFullScreen) {
          await container.mozRequestFullScreen();
          setIsFullscreen(true);
        } else if (container?.msRequestFullscreen) {
          await container.msRequestFullscreen();
          setIsFullscreen(true);
        } else if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
          setIsFullscreen(true);
        } else if (video?.requestFullscreen) {
          await video.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch {
        // Fallback to video element fullscreen if container fullscreen failed/rejected on mobile
        if (video?.webkitEnterFullscreen) {
          try {
            video.webkitEnterFullscreen();
            setIsFullscreen(true);
          } catch {}
        } else if (video?.requestFullscreen) {
          try {
            await video.requestFullscreen();
            setIsFullscreen(true);
          } catch {}
        }
      }
    }
  }

  useEffect(() => {
    const update = () => setIsFullscreen(isCurrentlyFullscreen());
    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];
    events.forEach((ev) => document.addEventListener(ev, update));

    const video = videoRef.current;
    if (video) {
      video.addEventListener("webkitbeginfullscreen", update);
      video.addEventListener("webkitendfullscreen", update);
    }

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, update));
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", update);
        video.removeEventListener("webkitendfullscreen", update);
      }
    };
  }, [videoRef]);

  return { isFullscreen, toggleFullscreen };
}
