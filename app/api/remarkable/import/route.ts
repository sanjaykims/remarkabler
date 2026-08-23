import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { importRemarkableNotebook } from "@/lib/remarkableImport";
import { remarkableStatus } from "@/lib/remarkableCloud";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rendering + download can take a while for a many-page notebook (the actual
// OCR runs in the background after this returns).
export const maxDuration = 300;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// POST — import ONE reMarkable notebook by { id, hash, name }: download its
// raw pages, render to PDF, and feed it into the OCR pipeline. Returns
// immediately after kicking off OCR (status becomes 'processing').
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    hash?: string;
    name?: string;
    force?: boolean;
  };
  const id = (body.id || "").trim();
  const hash = (body.hash || "").trim();
  if (!id || !hash) {
    return NextResponse.json(
      { ok: false, error: "Missing notebook id or hash." },
      { status: 400 }
    );
  }
  const result = await importRemarkableNotebook(id, hash, body.name || "", {
    force: body.force === true,
  });
  return NextResponse.json({ ...result, status_meta: remarkableStatus() });
}
