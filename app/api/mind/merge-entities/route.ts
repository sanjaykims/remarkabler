import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  dedupeAllEntities,
  mergeEntitiesManually,
  listAliases,
} from "@/lib/entityMerge";
import { entityStubRelPathForName } from "@/lib/diaryExportDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KINDS = ["person", "place", "project"] as const;
type Kind = (typeof KINDS)[number];

// After a merge, clean up Dropbox/Obsidian: DELETE the stub notes of EVERY
// recorded alias (the full export overwrites but never deletes, so a stale
// stub survives as an orphaned graph node), then refresh the export when
// anything actually changed. Best-effort — never fails the merge.
async function postMergeDropbox(changed: boolean) {
  try {
    const dropbox = (await import("@/lib/dropbox")) as {
      deleteDiaryExportFiles: (n: string[]) => Promise<unknown>;
      maybeExportDiaryToDropbox: () => Promise<unknown>;
    };
    const stalePaths = listAliases().map((a) =>
      entityStubRelPathForName(a.kind, a.alias_name)
    );
    if (stalePaths.length > 0) await dropbox.deleteDiaryExportFiles(stalePaths);
    // The outer try/catch only guards the synchronous import + the awaited
    // delete above — .catch() below is what guards this returned promise,
    // so an async failure here can't become an unhandled rejection.
    if (changed) {
      void dropbox
        .maybeExportDiaryToDropbox()
        .catch((e) =>
          console.warn("[mind/merge-entities] dropbox export failed:", (e as Error).message)
        );
    }
  } catch {
    // best-effort
  }
}

// POST /api/mind/merge-entities
//   (no body)                          → Claude auto-dedup across all kinds.
//   { manual: { kind, canonical,       → fold exactly these variant spellings
//               variants: string[] } }    into `canonical` (for OCR variants /
//                                          cross-script pairs Claude won't
//                                          risk). Records aliases so future
//                                          ingests auto-fold too.
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | {
        manual?: {
          kind?: string;
          canonical?: string;
          variants?: unknown;
          makeCanonical?: unknown;
        };
      }
    | null;

  try {
    if (body?.manual) {
      const kind = String(body.manual.kind || "").trim().toLowerCase() as Kind;
      if (!KINDS.includes(kind)) {
        return NextResponse.json({ error: "Bad kind." }, { status: 400 });
      }
      const canonical = String(body.manual.canonical || "").trim();
      if (!canonical) {
        return NextResponse.json({ error: "Missing canonical name." }, { status: 400 });
      }
      const variants = Array.isArray(body.manual.variants)
        ? body.manual.variants.filter((v): v is string => typeof v === "string")
        : [];
      const result = mergeEntitiesManually(kind, canonical, variants, {
        makeCanonical: body.manual.makeCanonical === true,
      });
      // A canonical-only promotion rewrites rows but merges 0 variants, so
      // refresh when EITHER changed (rewritten>0), not just merged (Codex #121).
      await postMergeDropbox(result.merged > 0 || result.rewritten > 0);
      return NextResponse.json(result);
    }

    const result = await dedupeAllEntities();
    await postMergeDropbox(result.merged > 0);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `Merge failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
