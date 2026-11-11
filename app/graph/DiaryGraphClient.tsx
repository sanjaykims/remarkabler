"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import ForceGraph from "./ForceGraph";
import type {
  DiaryGraphEdge,
  DiaryGraphEdgeType,
  DiaryGraphNode,
  DiaryGraphNodeType,
  DiaryGraphPayload,
} from "@/lib/diaryGraph";

type Selection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

const NODE_TYPES: DiaryGraphNodeType[] = [
  "person",
  "place",
  "project",
  "day",
  "conversation",
  "reflection",
  "decision",
];

const EDGE_TYPES: DiaryGraphEdgeType[] = [
  "mentions",
  "co_occurs",
  "relationship",
];

const NODE_LABELS: Record<DiaryGraphNodeType, string> = {
  person: "People",
  place: "Places",
  project: "Projects",
  day: "Days",
  conversation: "Conversations",
  reflection: "Reflections",
  decision: "Decisions",
};

const EDGE_LABELS: Record<DiaryGraphEdgeType, string> = {
  mentions: "Mentions",
  co_occurs: "Same day",
  relationship: "Relationships",
};

const NODE_COLORS: Record<DiaryGraphNodeType, string> = {
  person: "#2dd4bf",
  place: "#f59e0b",
  project: "#38bdf8",
  day: "#cbd5e1",
  conversation: "#fb7185",
  reflection: "#a78bfa",
  decision: "#84cc16",
};

const EDGE_COLORS: Record<DiaryGraphEdgeType, string> = {
  mentions: "#94a3b8",
  co_occurs: "#22c55e",
  relationship: "#fb7185",
};

function metricLabel(value: number, total?: number): string {
  if (total && total > value) return `${value}/${total}`;
  return String(value);
}

function formatGeneratedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 10)} ${kst
    .toISOString()
    .slice(11, 19)} KST`;
}

function ToggleButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs transition ${
        active
          ? "border-slate-300 bg-white text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          : "border-slate-200 bg-white/40 text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500"
      }`}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: active ? color : "#64748b" }}
      />
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total?: number;
  tone: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone }} />
        <p className="text-[11px] uppercase text-slate-500">{label}</p>
      </div>
      <p className="mt-1 font-mono text-2xl text-slate-950 dark:text-slate-50">
        {metricLabel(value, total)}
      </p>
    </div>
  );
}

function Inspector({
  graph,
  selection,
  onSelect,
}: {
  graph: DiaryGraphPayload;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );
  const edgeById = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges]
  );
  const selectedNode =
    selection?.kind === "node" ? nodeById.get(selection.id) || null : null;
  const selectedEdge =
    selection?.kind === "edge" ? edgeById.get(selection.id) || null : null;

  if (selectedEdge) {
    const source = nodeById.get(selectedEdge.source);
    const target = nodeById.get(selectedEdge.target);
    return (
      <aside className="rounded border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-[11px] uppercase text-slate-500">
          {EDGE_LABELS[selectedEdge.type]}
        </p>
        <h2 className="mt-1 text-lg font-medium">
          {source?.label || "Source"} {selectedEdge.directed ? "->" : "-"}{" "}
          {target?.label || "Target"}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {selectedEdge.label} - {selectedEdge.evidenceCount} source
          {selectedEdge.evidenceCount === 1 ? "" : "s"}
        </p>
        <div className="mt-4 space-y-2">
          {selectedEdge.evidence.map((ev) => (
            <div
              key={ev.label + ev.pageId + ev.sourceKey}
              className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{ev.label}</span>
                {ev.date && <span className="font-mono text-xs opacity-50">{ev.date}</span>}
              </div>
              {ev.vaultPath && (
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">
                  {ev.vaultPath}
                </p>
              )}
              {ev.preview && (
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {ev.preview}
                </p>
              )}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="rounded border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Select a node or relationship to inspect its evidence.
        </p>
      </aside>
    );
  }

  const connected = graph.edges
    .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
    .sort(
      (a, b) =>
        Number(b.type === "relationship") - Number(a.type === "relationship") ||
        b.weight - a.weight ||
        a.label.localeCompare(b.label)
    );

  return (
    <aside className="rounded border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
        />
        <div className="min-w-0">
          <p className="text-[11px] uppercase text-slate-500">
            {NODE_LABELS[selectedNode.type]}
          </p>
          <h2 className="break-words text-xl font-medium">{selectedNode.label}</h2>
          {selectedNode.subtitle && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {selectedNode.subtitle}
            </p>
          )}
        </div>
      </div>

      {selectedNode.vaultPath && (
        <p className="mt-3 break-all rounded bg-slate-100 px-2 py-1.5 font-mono text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          {selectedNode.vaultPath}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
          <p className="text-[11px] uppercase text-slate-500">Mentions</p>
          <p className="font-mono text-lg">{selectedNode.counts.mentions}</p>
        </div>
        <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
          <p className="text-[11px] uppercase text-slate-500">Days</p>
          <p className="font-mono text-lg">{selectedNode.counts.diaryDays}</p>
        </div>
        <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
          <p className="text-[11px] uppercase text-slate-500">Notes</p>
          <p className="font-mono text-lg">{selectedNode.counts.notes}</p>
        </div>
        <div className="rounded border border-slate-200 p-2 dark:border-slate-800">
          <p className="text-[11px] uppercase text-slate-500">Rels</p>
          <p className="font-mono text-lg">{selectedNode.counts.relationships}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Links</h3>
          <span className="font-mono text-xs text-slate-500">{connected.length}</span>
        </div>
        <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
          {connected.slice(0, 32).map((edge) => {
            const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
            const other = nodeById.get(otherId);
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => onSelect({ kind: "edge", id: edge.id })}
                className="w-full rounded border border-slate-200 p-2 text-left transition hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-600"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: EDGE_COLORS[edge.type] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {edge.label} {other ? other.label : "Unknown"}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {edge.weight}
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase text-slate-500">
                  {EDGE_LABELS[edge.type]} - {edge.evidenceCount} evidence
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export default function DiaryGraphClient({
  initialGraph,
}: {
  initialGraph: DiaryGraphPayload;
}) {
  const [graph, setGraph] = useState(initialGraph);
  const [selection, setSelection] = useState<Selection>(() =>
    initialGraph.stats.topHubs[0]
      ? { kind: "node", id: initialGraph.stats.topHubs[0].id }
      : null
  );
  const [query, setQuery] = useState("");
  const [minWeight, setMinWeight] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [nodeTypes, setNodeTypes] = useState<Record<DiaryGraphNodeType, boolean>>(
    () =>
      Object.fromEntries(NODE_TYPES.map((type) => [type, true])) as Record<
        DiaryGraphNodeType,
        boolean
      >
  );
  const [edgeTypes, setEdgeTypes] = useState<Record<DiaryGraphEdgeType, boolean>>(
    () =>
      Object.fromEntries(EDGE_TYPES.map((type) => [type, true])) as Record<
        DiaryGraphEdgeType,
        boolean
      >
  );

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = new Set<string>();
    if (term) {
      for (const node of graph.nodes) {
        if (
          node.label.toLowerCase().includes(term) ||
          node.subtitle.toLowerCase().includes(term) ||
          (node.vaultPath || "").toLowerCase().includes(term)
        ) {
          matching.add(node.id);
        }
      }
      for (const edge of graph.edges) {
        if (
          edge.label.toLowerCase().includes(term) ||
          edge.evidence.some(
            (ev) =>
              ev.label.toLowerCase().includes(term) ||
              (ev.vaultPath || "").toLowerCase().includes(term)
          )
        ) {
          matching.add(edge.source);
          matching.add(edge.target);
        }
      }
      for (const edge of graph.edges) {
        if (matching.has(edge.source) || matching.has(edge.target)) {
          matching.add(edge.source);
          matching.add(edge.target);
        }
      }
    }

    const nodes = graph.nodes.filter(
      (node) => nodeTypes[node.type] && (!term || matching.has(node.id))
    );
    const visibleNodeIds = new Set(nodes.map((node) => node.id));
    const edges = graph.edges.filter(
      (edge) =>
        edgeTypes[edge.type] &&
        edge.weight >= minWeight &&
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target)
    );
    return { nodes, edges, matching };
  }, [edgeTypes, graph.edges, graph.nodes, minWeight, nodeTypes, query]);

  const selectedNodeId = selection?.kind === "node" ? selection.id : null;
  const selectedEdge =
    selection?.kind === "edge"
      ? graph.edges.find((edge) => edge.id === selection.id) || null
      : null;
  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedNodeId) {
      ids.add(selectedNodeId);
      for (const edge of graph.edges) {
        if (edge.source === selectedNodeId) ids.add(edge.target);
        if (edge.target === selectedNodeId) ids.add(edge.source);
      }
    }
    if (selectedEdge) {
      ids.add(selectedEdge.source);
      ids.add(selectedEdge.target);
    }
    return ids;
  }, [graph.edges, selectedEdge, selectedNodeId]);

  const labelIds = useMemo(() => {
    const ids = new Set(graph.stats.topHubs.map((hub) => hub.id));
    for (const id of filtered.matching) ids.add(id);
    return ids;
  }, [filtered.matching, graph.stats.topHubs]);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/graph");
      const data = (await r.json()) as DiaryGraphPayload | { error?: string };
      if ("error" in data) {
        throw new Error(data.error || "Graph refresh failed");
      }
      if (!r.ok) {
        throw new Error("Graph refresh failed");
      }
      const nextGraph = data as DiaryGraphPayload;
      setGraph(nextGraph);
      setSelection(
        nextGraph.stats.topHubs[0]
          ? { kind: "node", id: nextGraph.stats.topHubs[0].id }
          : null
      );
    } finally {
      setRefreshing(false);
    }
  }

  const metricTone = {
    entities: NODE_COLORS.person,
    days: NODE_COLORS.day,
    notes: NODE_COLORS.conversation,
    relationships: EDGE_COLORS.relationship,
  };
  const generatedAtLabel = formatGeneratedAt(graph.generatedAt);

  return (
    <div className="relative left-1/2 w-screen max-w-[1520px] -translate-x-1/2 space-y-4 px-4 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Diary Graph</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            People, places, projects, diary days, exported conversations, reflections,
            decisions, and the typed links between them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[11px] text-slate-500">
            {generatedAtLabel}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Entities"
          value={graph.stats.entityCount}
          total={graph.stats.totalEntityCount}
          tone={metricTone.entities}
        />
        <Metric
          label="Days"
          value={graph.stats.dayCount}
          total={graph.stats.totalDayCount}
          tone={metricTone.days}
        />
        <Metric
          label="Notes"
          value={graph.stats.contentCount}
          total={graph.stats.totalContentCount}
          tone={metricTone.notes}
        />
        <Metric
          label="Typed Links"
          value={graph.stats.relationshipCount}
          total={graph.stats.totalRelationshipCount}
          tone={metricTone.relationships}
        />
      </div>

      <section className="rounded border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center">
          <label className="block">
            <span className="sr-only">Search graph</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search graph"
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-black"
            />
          </label>
          <div className="flex items-center gap-3">
            <label className="flex min-w-[190px] items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>Min weight</span>
              <input
                type="range"
                min={1}
                max={6}
                value={minWeight}
                onChange={(e) => setMinWeight(Number(e.target.value))}
                className="w-full"
              />
              <span className="font-mono">{minWeight}</span>
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {NODE_TYPES.map((type) => (
            <ToggleButton
              key={type}
              active={nodeTypes[type]}
              label={NODE_LABELS[type]}
              color={NODE_COLORS[type]}
              onClick={() =>
                setNodeTypes((prev) => ({
                  ...prev,
                  [type]: !prev[type],
                }))
              }
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EDGE_TYPES.map((type) => (
            <ToggleButton
              key={type}
              active={edgeTypes[type]}
              label={EDGE_LABELS[type]}
              color={EDGE_COLORS[type]}
              onClick={() =>
                setEdgeTypes((prev) => ({
                  ...prev,
                  [type]: !prev[type],
                }))
              }
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded border border-slate-800 bg-slate-950 text-slate-100 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium">Live Map</h2>
              <p className="text-xs text-slate-400">
                {filtered.nodes.length} nodes - {filtered.edges.length} edges
              </p>
            </div>
            {selection && (
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-500"
              >
                Clear
              </button>
            )}
          </div>
          <div
            className="relative overflow-hidden"
            style={{
              backgroundColor: "#020617",
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          >
            {filtered.nodes.length === 0 ? (
              <div className="flex min-h-[520px] items-center justify-center px-6 text-center text-sm text-slate-400">
                No graph nodes match the current filters.
              </div>
            ) : (
              <ForceGraph
                className="h-[72vh] min-h-[480px] w-full sm:h-[680px]"
                nodes={filtered.nodes}
                edges={filtered.edges}
                colors={NODE_COLORS}
                selectedId={selectedNodeId}
                highlightedIds={highlightedIds}
                labelIds={labelIds}
                onSelect={(id) =>
                  setSelection(id ? { kind: "node", id } : null)
                }
              />
            )}
          </div>
        </section>

        <Inspector graph={graph} selection={selection} onSelect={setSelection} />
      </div>
    </div>
  );
}
