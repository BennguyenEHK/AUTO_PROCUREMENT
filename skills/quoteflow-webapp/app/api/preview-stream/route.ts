import { subscribe } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: ready\ndata: {}\n\n"));
      const unsubscribe = subscribe((event) => {
        controller.enqueue(encoder.encode(`event: preview\ndata: ${JSON.stringify(event)}\n\n`));
      });
      return () => unsubscribe();
    }
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
