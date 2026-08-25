import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db, DATA_DIR } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ATTACHMENT_DIR = path.join(DATA_DIR, "chat-attachments");

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await isAuthenticated())) {
    return new NextResponse("Locked", { status: 401 });
  }
  const row = db()
    .prepare(`SELECT path, mime FROM chat_attachments WHERE id = ?`)
    .get(Number(params.id)) as { path: string; mime: string } | undefined;
  if (!row) {
    return new NextResponse("Not found", { status: 404 });
  }
  let data: Buffer;
  try {
    data = fs.readFileSync(path.join(ATTACHMENT_DIR, row.path));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": row.mime,
      "cache-control": "private, max-age=86400",
    },
  });
}
