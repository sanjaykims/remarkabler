import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  disciplineConfig,
  disciplineRepoName,
  fetchRepoTextFiles,
} from "@/lib/github";
import {
  replaceDisciplineNotebook,
  disciplineStatus,
  disciplineFiles,
  buildNotesContext,
  isDisciplineEnabled,
} from "@/lib/notes";
import { getCurrentProfile, saveProfile } from "@/lib/profile";
import { buildSelfModel, updateSelfModel } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

const LOCKED = () => NextResponse.json({ error: "Locked" }, { status: 401 });

export async function GET() {
  if (!isAuthenticated()) return LOCKED();
  return NextResponse.json({
    configured: !!disciplineConfig(),
    repo: disciplineRepoName(),
    ...disciplineStatus(),
    fileList: disciplineFiles(),
  });
}

export async function POST() {
  if (!isAuthenticated()) return LOCKED();

  if (!isDisciplineEnabled()) {
    return NextResponse.json(
      { error: "Discipline sharing is turned off in Remarkabler." },
      { status: 403 }
    );
  }

  const cfg = disciplineConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Not connected yet. Set DISCIPLINE_REPO and DISCIPLINE_GITHUB_TOKEN in Railway, then redeploy.",
      },
      { status: 400 }
    );
  }

  let files: Array<{ path: string; content: string }>;
  try {
    files = await fetchRepoTextFiles(cfg);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No readable text files found in that repo/branch (only binary files, dotfiles, or it's empty)." },
      { status: 400 }
    );
  }

  const disciplineText = replaceDisciplineNotebook(files);

  // Fold the discipline material into the evolving profile.
  try {
    const current = getCurrentProfile();
    const updated = current
      ? await updateSelfModel({ currentProfile: current, newContent: disciplineText })
      : await buildSelfModel({ notesContext: buildNotesContext() });
    saveProfile(updated);
  } catch {
    // profile fold is best-effort
  }

  return NextResponse.json({ ok: true, files: files.length });
}
