// Minimal GitHub reader for pulling a repo's text files (e.g. a private
// "discipline" repo) into Remarkabler. Configured via environment variables so
// the token is never stored in the app database or sent to the client.

const API = "https://api.github.com";
// Accept any text file regardless of extension; only skip known-binary types
// and dotfiles. Content is also checked for null bytes before inclusion.
const BINARY_EXT = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg", ".pdf",
  ".zip", ".gz", ".tar", ".7z", ".rar", ".mp3", ".mp4", ".mov", ".avi",
  ".wav", ".m4a", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".exe", ".bin",
  ".dll", ".so", ".dylib", ".db", ".sqlite", ".lock", ".pyc", ".class",
];
const MAX_FILES = 100;
const MAX_FILE_BYTES = 200_000;

export type RepoConfig = { repo: string; branch: string | null; token: string };

/** Read the configured discipline repo, or null if not set up. */
export function disciplineConfig(): RepoConfig | null {
  const repo = process.env.DISCIPLINE_REPO;
  const token = process.env.DISCIPLINE_GITHUB_TOKEN;
  if (!repo || !token) return null;
  // Branch is optional — if unset we detect the repo's default branch.
  return { repo, branch: process.env.DISCIPLINE_BRANCH || null, token };
}

export function disciplineRepoName(): string | null {
  return process.env.DISCIPLINE_REPO || null;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Remarkabler",
  };
}

/** Fetch every text file (.md/.txt/...) from the repo at the given branch. */
export async function fetchRepoTextFiles(
  cfg: RepoConfig
): Promise<Array<{ path: string; content: string }>> {
  const h = headers(cfg.token);

  // Verify access and discover the default branch. For a private repo GitHub
  // returns 404 (not 403) when the token can't see it, so distinguish causes.
  const repoRes = await fetch(`${API}/repos/${cfg.repo}`, { headers: h });
  if (repoRes.status === 401) {
    throw new Error(
      "GitHub rejected the token (401). Regenerate DISCIPLINE_GITHUB_TOKEN and update it in Railway."
    );
  }
  if (repoRes.status === 404) {
    throw new Error(
      `Can't see ${cfg.repo}. For a private repo, GitHub returns 404 when the fine-grained token doesn't include this repository or lacks Contents access. In the token's settings, add the repo under "Repository access" and grant Contents → Read-only. Also confirm DISCIPLINE_REPO is exactly "owner/name" (case-sensitive).`
    );
  }
  if (!repoRes.ok) {
    throw new Error(`GitHub error reading ${cfg.repo} (${repoRes.status}).`);
  }
  const meta = (await repoRes.json()) as { default_branch?: string };
  const branch = cfg.branch || meta.default_branch || "main";

  const treeRes = await fetch(
    `${API}/repos/${cfg.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers: h }
  );
  if (treeRes.status === 404) {
    throw new Error(
      `Branch "${branch}" not found, or the repo has no files yet. If your branch isn't "${branch}", set DISCIPLINE_BRANCH in Railway.`
    );
  }
  if (!treeRes.ok) {
    throw new Error(`Couldn't read ${cfg.repo} @ ${branch} (GitHub returned ${treeRes.status}).`);
  }
  const tree = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string; size?: number }>;
  };
  const blobs = (tree.tree || [])
    .filter((t) => {
      if (t.type !== "blob" || (t.size ?? 0) > MAX_FILE_BYTES) return false;
      const lower = t.path.toLowerCase();
      if (BINARY_EXT.some((e) => lower.endsWith(e))) return false;
      const base = t.path.split("/").pop() || "";
      if (base.startsWith(".")) return false; // skip .gitignore, etc.
      return true;
    })
    .slice(0, MAX_FILES);

  const files: Array<{ path: string; content: string }> = [];
  for (const b of blobs) {
    const encodedPath = b.path.split("/").map(encodeURIComponent).join("/");
    const r = await fetch(
      `${API}/repos/${cfg.repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { headers: h }
    );
    if (!r.ok) continue;
    const j = (await r.json()) as { content?: string; encoding?: string };
    if (j.content && j.encoding === "base64") {
      const buf = Buffer.from(j.content, "base64");
      if (buf.includes(0)) continue; // looks binary — skip
      const text = buf.toString("utf-8");
      if (text.trim()) files.push({ path: b.path, content: text });
    }
  }
  return files;
}
