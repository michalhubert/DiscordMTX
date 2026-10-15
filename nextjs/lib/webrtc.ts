// Resolves once ICE gathering completes, or after timeoutMs - whichever comes
// first - so the SDP sent to WHIP/WHEP carries the gathered candidates.
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", checkState);
      resolve();
    };
    const timeout = setTimeout(done, timeoutMs);
    function checkState() {
      if (pc.iceGatheringState === "complete") done();
    }
    pc.addEventListener("icegatheringstatechange", checkState);
  });
}
