// Minimal GitHub reader for pulling a repo's text files (e.g. a private
// "discipline" repo) into Remarkabler. Configured via environment variables so
// the token is never stored in the app database or sent to the client.

const API = "https://api.github.com";
const TEXT_EXT = [".md", ".markdown", ".mdx", ".txt"];
const MAX_FILES = 100;
const MAX_FILE_BYTES = 200_000;

export type RepoConfig = { repo: string; branch: string; token: string };

/** Read the configured discipline repo, or null if not set up. */
export function disciplineConfig(): RepoConfig | null {
  const repo = process.env.DISCIPLINE_REPO;
  const token = process.env.DISCIPLINE_GITHUB_TOKEN;
  if (!repo || !token) return null;
  return { repo, branch: process.env.DISCIPLINE_BRANCH || "main", token };
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
  const treeRes = await fetch(
    `${API}/repos/${cfg.repo}/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`,
    { headers: h }
  );
  if (!treeRes.ok) {
    throw new Error(
      `Couldn't read ${cfg.repo} @ ${cfg.branch} (GitHub returned ${treeRes.status}). Check the repo name, branch, and that the token has read access.`
    );
  }
  const tree = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string; size?: number }>;
  };
  const blobs = (tree.tree || [])
    .filter(
      (t) =>
        t.type === "blob" &&
        TEXT_EXT.some((e) => t.path.toLowerCase().endsWith(e)) &&
        (t.size ?? 0) <= MAX_FILE_BYTES
    )
    .slice(0, MAX_FILES);

  const files: Array<{ path: string; content: string }> = [];
  for (const b of blobs) {
    const encodedPath = b.path.split("/").map(encodeURIComponent).join("/");
    const r = await fetch(
      `${API}/repos/${cfg.repo}/contents/${encodedPath}?ref=${encodeURIComponent(cfg.branch)}`,
      { headers: h }
    );
    if (!r.ok) continue;
    const j = (await r.json()) as { content?: string; encoding?: string };
    if (j.content && j.encoding === "base64") {
      const text = Buffer.from(j.content, "base64").toString("utf-8");
      if (text.trim()) files.push({ path: b.path, content: text });
    }
  }
  return files;
}
