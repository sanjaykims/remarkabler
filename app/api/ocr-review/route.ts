import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { notebooksPinDenied } from "@/lib/notebooksPin";
import { listReviewCards, pendingFlagCount, resolveFlag, type ResolveAction } from "@/lib/ocrReview";
import { proofreadingStats } from "@/lib/ocrLearning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

// GET: the next few "Needs your eye" cards + how many are waiting in total.
// Behind the app lock AND the Notebooks PIN: the cards quote diary text.
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  return NextResponse.json({
    cards: listReviewCards(5),
    total: pendingFlagCount(),
    stats: proofreadingStats(),
  });
}

// POST {action: "choose", id, index} | {action: "custom", id, text} | {action: "keep", id}
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return LOCKED();
  const pinDenied = notebooksPinDenied(req);
  if (pinDenied) return pinDenied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let action: ResolveAction;
  switch (body?.action) {
    case "choose":
      action = { kind: "choose", index: Math.trunc(Number(body.index)) };
      break;
    case "custom":
      action = { kind: "custom", text: typeof body.text === "string" ? body.text : "" };
      break;
    case "keep":
      action = { kind: "keep" };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const r = resolveFlag(id, action);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  // Rewrites the handwriting-habits note once enough new corrections exist
  // (no-op otherwise; never throws).
  void import("@/lib/handwritingNotes")
    .then((m) => m.maybeRefreshHandwritingNotes())
    .catch((e) => console.warn("[ocr-review] handwriting notes failed:", (e as Error).message));

  // A changed page must reach the Obsidian/Dropbox day file (best-effort,
  // .catch guards the returned promise; the try only guards the import).
  if (r.changed) {
    try {
      const { maybeExportDiaryToDropbox } = (await import("@/lib/dropbox")) as {
        maybeExportDiaryToDropbox: (opts?: { notebookId?: string }) => Promise<unknown>;
      };
      void maybeExportDiaryToDropbox({ notebookId: r.notebookId }).catch((e) =>
        console.warn("[ocr-review] dropbox export failed:", (e as Error).message)
      );
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.json({ ok: true });
}
