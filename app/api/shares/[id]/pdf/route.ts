import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readPendingShare } from "@/lib/pendingShares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Owner-only preview of a quarantined share, so approval is an informed
 * decision rather than one made on an attacker-chosen filename.
 *
 * Approving a share runs the full pipeline — OCR, embeddings, profile fold,
 * /mind analysis, entity extraction, Obsidian export — so whatever these bytes
 * contain ends up in the corpus Claude reasons over. The quarantine's entire
 * security value rests on this one decision, and until now the owner saw only
 * a name, a size, and a timestamp.
 *
 * Served as an ATTACHMENT, never inline: rendering untrusted PDF bytes in a
 * same-origin viewer would hand an attacker a parser surface on the very
 * origin that holds the session cookie. Downloading and opening it locally
 * keeps that outside the app's origin.
 */
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const params = await props.params;

  // readPendingShare re-verifies size and magic bytes, discarding a quarantine
  // file that no longer matches its row.
  const pending = readPendingShare(params.id);
  if (!pending) {
    return NextResponse.json(
      { error: "Pending share not found" },
      { status: 404 }
    );
  }

  return new NextResponse(pending.bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      // Quoted + ASCII-safe: the stored name is caller-supplied text.
      "content-disposition": `attachment; filename="pending-share.pdf"`,
      "content-length": String(pending.bytes.length),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
