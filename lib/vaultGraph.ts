import { insightDropboxFolders } from "./insightSources";
import { readDropboxTextFiles } from "./dropbox";
import type {
  DiaryGraphEdge,
  DiaryGraphNode,
  DiaryGraphPayload,
  VaultNoteKind,
} from "./diaryGraph";

// Adds the user's Obsidian vault folders "Records" and "claude's lens" (read
// live, read-only, from Dropbox) to the diary graph as note nodes. Each note
// links to the diary days it dates to and to every person/place/project node
// whose name it mentions (plain text or [[wikilink]]). Fail-soft: any problem
// returns the graph unchanged.

const MAX_LINKS_PER_NOTE = 25;

function kindForFolder(folder: string): VaultNoteKind {
  return /lens/i.test(folder) ? "lens" : "record";
}

function noteDate(name: string, modified: string): string | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return modified ? modified.slice(0, 10) : null;
}

function noteLabel(name: string): string {
  return name
    .replace(/\.(md|txt)$/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}(-\d{4}(KST)?)?[-_ ]*/i, "")
    .replace(/^Claude's Lens\s*[—-]\s*/i, "")
    .trim() || name;
}

export async function addVaultNotesToGraph(
  graph: DiaryGraphPayload
): Promise<DiaryGraphPayload & { vaultError?: string }> {
  let files;
  let error: string | undefined;
  try {
    const r = await readDropboxTextFiles(insightDropboxFolders());
    files = r.files;
    error = r.error;
  } catch (e) {
    return { ...graph, vaultError: (e as Error).message };
  }
  if (!files.length) return error ? { ...graph, vaultError: error } : graph;

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  // Candidate entity names to look for in note text (lowercased).
  const entities = graph.nodes
    .filter((n) => n.type === "person" || n.type === "place" || n.type === "project")
    .map((n) => ({ id: n.id, needle: n.label.trim().toLowerCase(), size: n.size }))
    .filter((e) => e.needle.length >= 2)
    .filter((e) => /[^\x00-\x7f]/.test(e.needle) || e.needle.length >= 3);

  const nodes: DiaryGraphNode[] = [];
  const edges: DiaryGraphEdge[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    const kind = kindForFolder(f.folder);
    const id = `note:${kind}:${encodeURIComponent(f.path.toLowerCase())}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const date = noteDate(f.name, f.modified);
    const hay = f.text.toLowerCase();

    const hits = entities
      .filter((e) => hay.includes(e.needle))
      .sort((a, b) => b.size - a.size)
      .slice(0, MAX_LINKS_PER_NOTE);
    const dayNode = date && nodeIds.has(`day:${date}`) ? `day:${date}` : null;

    nodes.push({
      id,
      type: kind,
      label: noteLabel(f.name),
      subtitle: `${kind === "lens" ? "Claude's lens" : "Records"}${date ? ` - ${date}` : ""}`,
      size: 9 + Math.min(10, hits.length),
      date,
      vaultPath: f.path,
      counts: { mentions: hits.length, diaryDays: dayNode ? 1 : 0, notes: 1, relationships: 0 },
    });

    const targets = [...hits.map((h) => h.id), ...(dayNode ? [dayNode] : [])];
    for (const target of targets) {
      edges.push({
        id: `${id}->${target}`,
        source: id,
        target,
        type: "mentions",
        label: kind === "lens" ? "Claude's lens mentions" : "Record mentions",
        weight: 1,
        directed: false,
        evidenceCount: 1,
        evidence: [{ kind, label: noteLabel(f.name), date, vaultPath: f.path }],
      });
    }
  }

  const added = nodes.length;
  return {
    ...graph,
    nodes: [...graph.nodes, ...nodes],
    edges: [...graph.edges, ...edges],
    stats: {
      ...graph.stats,
      contentCount: graph.stats.contentCount + added,
      totalContentCount: graph.stats.totalContentCount + added,
    },
    ...(error ? { vaultError: error } : {}),
  };
}
