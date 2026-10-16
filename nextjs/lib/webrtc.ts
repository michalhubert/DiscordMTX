// Full gathering can take seconds; the first server-reflexive candidate is enough.
export function waitForIceGathering(
  pc: RTCPeerConnection,
  timeoutMs = 1000,
  settleMs = 100,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let settle: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(timeout);
      clearTimeout(settle);
      pc.removeEventListener("icegatheringstatechange", checkState);
      pc.removeEventListener("icecandidate", checkCandidate);
      resolve();
    };
    const timeout = setTimeout(done, timeoutMs);
    function checkState() {
      if (pc.iceGatheringState === "complete") done();
    }
    // Brief wait for the other IP family.
    function checkCandidate(event: RTCPeerConnectionIceEvent) {
      if (event.candidate?.type === "srflx" && !settle) settle = setTimeout(done, settleMs);
    }
    pc.addEventListener("icegatheringstatechange", checkState);
    pc.addEventListener("icecandidate", checkCandidate);
  });
}
