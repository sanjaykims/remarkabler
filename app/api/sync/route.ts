import { NextRequest } from "next/server";
import { syncAll } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ocr = body.ocr !== false;
  const notebookIds: string[] | undefined = Array.isArray(body.notebookIds)
    ? body.notebookIds
    : undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of syncAll({ ocr, notebookIds })) {
          controller.enqueue(encoder.encode(JSON.stringify(evt) + "\n"));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ stage: "error", message: (err as Error).message }) + "\n"
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
