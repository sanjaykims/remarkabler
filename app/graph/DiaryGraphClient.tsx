"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
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

type LayoutNode = DiaryGraphNode & {
  x: number;
  y: number;
  r: number;
};

const WIDTH = 1180;
const HEIGHT = 760;

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

const ANCHORS: Record<DiaryGraphNodeType, { x: number; y: number }> = {
  person: { x: 520, y: 230 },
  place: { x: 340, y: 470 },
  project: { x: 710, y: 455 },
  day: { x: 175, y: 370 },
  conversation: { x: 990, y: 240 },
  reflection: { x: 980, y: 400 },
  decision: { x: 965, y: 560 },
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitter(value: string, spread: number): number {
  return ((hash(value) / 0xffffffff) * 2 - 1) * spread;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function truncate(value: string, n: number): string {
  return value.length > n ? `${value.slice(0, Math.max(0, n - 3))}...` : value;
}

function buildLayout(nodes: DiaryGraphNode[], edges: DiaryGraphEdge[]): LayoutNode[] {
  const layout = nodes.map((node, index) => {
    const anchor = ANCHORS[node.type];
    const ring = 26 + (index % 9) * 12;
    const angle = (hash(node.id) % 6283) / 1000;
    const x = anchor.x + Math.cos(angle) * ring + jitter(`${node.id}:x`, 34);
    const y = anchor.y + Math.sin(angle) * ring + jitter(`${node.id}:y`, 34);
    return {
      ...node,
      x,
      y,
      r: node.size,
      vx: 0,
      vy: 0,
    };
  });
  const byId = new Map(layout.map((node) => [node.id, node]));
  const links = edges
    .map((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      return source && target ? { edge, source, target } : null;
    })
    .filter((item): item is NonNullable<typeof item> => !!item);

  for (let tick = 0; tick < 230; tick++) {
    for (let i = 0; i < layout.length; i++) {
      const a = layout[i];
      for (let j = i + 1; j < layout.length; j++) {
        const b = layout[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = jitter(`${a.id}:${b.id}`, 1);
          dy = jitter(`${b.id}:${a.id}`, 1);
          d2 = dx * dx + dy * dy || 1;
        }
        const d = Math.sqrt(d2);
        const minDistance = a.r + b.r + 28;
        const force =
          d < minDistance
            ? (minDistance - d) * 0.032
            : Math.min(1100 / d2, 0.7);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    for (const link of links) {
      const { edge, source, target } = link;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired =
        edge.type === "relationship" ? 138 : edge.type === "co_occurs" ? 118 : 172;
      const strength =
        edge.type === "relationship" ? 0.032 : edge.type === "co_occurs" ? 0.018 : 0.012;
      const force = (d - desired) * strength * clamp(Math.sqrt(edge.weight), 1, 3);
      dx /= d;
      dy /= d;
      source.vx += dx * force;
      source.vy += dy * force;
      target.vx -= dx * force;
      target.vy -= dy * force;
    }

    for (const node of layout) {
      const anchor = ANCHORS[node.type];
      node.vx += (anchor.x - node.x) * 0.012;
      node.vy += (anchor.y - node.y) * 0.012;
      node.vx *= 0.74;
      node.vy *= 0.74;
      node.x = clamp(node.x + node.vx, 36, WIDTH - 36);
      node.y = clamp(node.y + node.vy, 42, HEIGHT - 42);
    }
  }

  return layout;
}

function edgePath(source: LayoutNode, target: LayoutNode, edge: DiaryGraphEdge): string {
  if (edge.type !== "relationship") {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = (hash(edge.id) % 2 === 0 ? 1 : -1) * 34;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`;
}

function midpoint(source: LayoutNode, target: LayoutNode, edge: DiaryGraphEdge) {
  if (edge.type !== "relationship") {
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  }
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const bend = (hash(edge.id) % 2 === 0 ? 1 : -1) * 24;
  return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
}

function metricLabel(value: number, total?: number): string {
  if (total && total > value) return `${value}/${total}`;
  return String(value);
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

function NodeShape({
  node,
  active,
  dimmed,
}: {
  node: LayoutNode;
  active: boolean;
  dimmed: boolean;
}) {
  const color = NODE_COLORS[node.type];
  const fill = node.type === "day" ? "#0f172a" : color;
  const opacity = dimmed ? 0.22 : 1;
  if (node.type === "day") {
    const side = node.r * 1.55;
    return (
      <rect
        x={node.x - side / 2}
        y={node.y - side / 2}
        width={side}
        height={side}
        rx={4}
        fill={fill}
        stroke={color}
        strokeWidth={active ? 4 : 2}
        opacity={opacity}
      />
    );
  }
  if (
    node.type === "conversation" ||
    node.type === "reflection" ||
    node.type === "decision"
  ) {
    const r = node.r * 1.05;
    return (
      <path
        d={`M ${node.x} ${node.y - r} L ${node.x + r} ${node.y} L ${node.x} ${
          node.y + r
        } L ${node.x - r} ${node.y} Z`}
        fill="#020617"
        stroke={color}
        strokeWidth={active ? 4 : 2.2}
        opacity={opacity}
      />
    );
  }
  return (
    <circle
      cx={node.x}
      cy={node.y}
      r={node.r}
      fill={color}
      stroke={active ? "#f8fafc" : "#020617"}
      strokeWidth={active ? 4 : 2}
      opacity={opacity}
    />
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

  const layoutNodes = useMemo(
    () => buildLayout(filtered.nodes, filtered.edges),
    [filtered.edges, filtered.nodes]
  );
  const layoutById = useMemo(
    () => new Map(layoutNodes.map((node) => [node.id, node])),
    [layoutNodes]
  );

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

  const topLabelIds = useMemo(
    () => new Set(graph.stats.topHubs.map((hub) => hub.id)),
    [graph.stats.topHubs]
  );

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
            {new Date(graph.generatedAt).toLocaleString()}
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
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label="Diary entity graph"
                className="block h-[540px] w-full sm:h-[680px]"
              >
                <defs>
                  <marker
                    id="diary-graph-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="8"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 8 3 L 0 6 z" fill="#fb7185" />
                  </marker>
                </defs>
                <g>
                  {filtered.edges.map((edge) => {
                    const source = layoutById.get(edge.source);
                    const target = layoutById.get(edge.target);
                    if (!source || !target) return null;
                    const selected =
                      selection?.kind === "edge"
                        ? selection.id === edge.id
                        : selectedNodeId
                          ? edge.source === selectedNodeId || edge.target === selectedNodeId
                          : false;
                    const dimmed =
                      highlightedIds.size > 0 &&
                      !selected &&
                      !highlightedIds.has(edge.source) &&
                      !highlightedIds.has(edge.target);
                    return (
                      <path
                        key={edge.id}
                        d={edgePath(source, target, edge)}
                        fill="none"
                        stroke={EDGE_COLORS[edge.type]}
                        strokeWidth={
                          edge.type === "relationship"
                            ? selected
                              ? 4.5
                              : 2.7
                            : clamp(0.8 + Math.sqrt(edge.weight), 1.2, selected ? 5 : 3.6)
                        }
                        strokeOpacity={dimmed ? 0.12 : selected ? 0.92 : 0.42}
                        strokeLinecap="round"
                        markerEnd={edge.directed ? "url(#diary-graph-arrow)" : undefined}
                        onClick={() => setSelection({ kind: "edge", id: edge.id })}
                        className="cursor-pointer"
                      />
                    );
                  })}
                </g>
                <g pointerEvents="none">
                  {filtered.edges
                    .filter((edge) => edge.type === "relationship")
                    .slice(0, 70)
                    .map((edge) => {
                      const source = layoutById.get(edge.source);
                      const target = layoutById.get(edge.target);
                      if (!source || !target) return null;
                      const selected =
                        selection?.kind === "edge"
                          ? selection.id === edge.id
                          : selectedNodeId
                            ? edge.source === selectedNodeId || edge.target === selectedNodeId
                            : true;
                      if (!selected && highlightedIds.size > 0) return null;
                      const p = midpoint(source, target, edge);
                      return (
                        <text
                          key={`${edge.id}:label`}
                          x={p.x}
                          y={p.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="select-none text-[10px] font-medium"
                          fill="#fecdd3"
                          stroke="#020617"
                          strokeWidth={3}
                          paintOrder="stroke"
                        >
                          {truncate(edge.label, 22)}
                        </text>
                      );
                    })}
                </g>
                <g>
                  {layoutNodes.map((node) => {
                    const active =
                      selection?.kind === "node"
                        ? selection.id === node.id
                        : selectedEdge
                          ? selectedEdge.source === node.id || selectedEdge.target === node.id
                          : false;
                    const dimmed = highlightedIds.size > 0 && !highlightedIds.has(node.id);
                    const matched = filtered.matching.has(node.id);
                    const showLabel =
                      active ||
                      matched ||
                      topLabelIds.has(node.id) ||
                      (node.type !== "day" && node.size >= 17);
                    return (
                      <g
                        key={node.id}
                        role="button"
                        aria-label={`${NODE_LABELS[node.type]} ${node.label}`}
                        tabIndex={0}
                        onClick={() => setSelection({ kind: "node", id: node.id })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelection({ kind: "node", id: node.id });
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <NodeShape node={node} active={active} dimmed={dimmed} />
                        {showLabel && (
                          <text
                            x={node.x}
                            y={node.y + node.r + 13}
                            textAnchor="middle"
                            className="pointer-events-none select-none text-[11px] font-medium"
                            fill={dimmed ? "#64748b" : "#f8fafc"}
                            stroke="#020617"
                            strokeWidth={4}
                            paintOrder="stroke"
                          >
                            {truncate(node.label, node.type === "day" ? 10 : 24)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>
        </section>

        <Inspector graph={graph} selection={selection} onSelect={setSelection} />
      </div>
    </div>
  );
}
