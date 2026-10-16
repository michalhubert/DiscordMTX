const HEARTBEAT_MS = 10_000;
// Browsers default to ~3s.
const RETRY_MS = 1000;

export type EventStream = {
  send: (event: object) => void;
  close: () => void;
};

export type EventStreamHandlers = {
  heartbeat?: () => void;
  close?: () => void;
};

export function eventStream(
  req: Request,
  start: (stream: EventStream) => EventStreamHandlers | void,
): Response {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let handlers: EventStreamHandlers | void;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        req.signal.removeEventListener("abort", cleanup);
        try {
          handlers?.close?.();
        } catch (err) {
          console.error("Event stream cleanup failed:", err);
        }
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      // Padding: Safari and some proxies buffer the first ~1KB.
      write(`:${" ".repeat(2048)}\n\nretry: ${RETRY_MS}\n\n`);
      handlers = start({
        send: (event) => write(`data: ${JSON.stringify(event)}\n\n`),
        close: cleanup,
      });

      // Keeps proxies from idling out and detects vanished clients.
      heartbeat = setInterval(() => {
        write(": ping\n\n");
        if (!closed) handlers?.heartbeat?.();
      }, HEARTBEAT_MS);

      if (req.signal.aborted) cleanup();
      else req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
