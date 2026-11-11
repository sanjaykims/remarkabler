"use client";

// Obsidian-style graph view: a live force simulation drawn on a canvas.
// Nodes are small dots that repel each other, links pull connected nodes
// together. You can drag a node (it pulls its neighbours along), pan the
// background, zoom with the wheel or a two-finger pinch, and tap a node to
// highlight it and its neighbours (everything else dims) — like Obsidian's
// graph. Labels fade in as you zoom in.

import { useEffect, useRef } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export type ForceNodeInput = {
  id: string;
  label: string;
  type: string;
  size: number;
};

export type ForceEdgeInput = {
  id: string;
  source: string;
  target: string;
  weight: number;
};

type SimNode = SimulationNodeDatum & {
  id: string;
  label: string;
  type: string;
  r: number;
};

type SimLink = SimulationLinkDatum<SimNode> & { weight: number };

type Props = {
  nodes: ForceNodeInput[];
  edges: ForceEdgeInput[];
  colors: Record<string, string>;
  selectedId: string | null;
  /** Node ids to emphasise (selected node + neighbours). Empty = no dimming. */
  highlightedIds: Set<string>;
  /** Node ids that always get a label (top hubs, search matches). */
  labelIds: Set<string>;
  onSelect: (id: string | null) => void;
  className?: string;
};

type Transform = { k: number; x: number; y: number };

function radiusFor(size: number): number {
  return Math.max(3, Math.min(13, 2.5 + size * 0.2));
}

export default function ForceGraph(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props for the draw loop without restarting the simulation.
  const propsRef = useRef(props);
  const redrawRef = useRef<() => void>(() => {});
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const transformRef = useRef<Transform>({ k: 1, x: 0, y: 0 });
  const sizeRef = useRef({ w: 300, h: 300 });
  const fittedRef = useRef(false);

  // (Re)build the simulation whenever the visible node/edge set changes,
  // keeping positions of nodes that were already on screen.
  useEffect(() => {
    const prev = nodesRef.current;
    const next = new Map<string, SimNode>();
    const simNodes: SimNode[] = props.nodes.map((n, i) => {
      const old = prev.get(n.id);
      const angle = i * 2.399963; // golden angle spread for a stable start
      const dist = 12 * Math.sqrt(i + 1);
      const node: SimNode = old ?? {
        id: n.id,
        label: n.label,
        type: n.type,
        r: 0,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      };
      node.label = n.label;
      node.type = n.type;
      node.r = radiusFor(n.size);
      node.fx = null;
      node.fy = null;
      next.set(n.id, node);
      return node;
    });
    const simLinks: SimLink[] = props.edges
      .filter((e) => next.has(e.source) && next.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, weight: e.weight }));

    nodesRef.current = next;
    simRef.current?.stop();
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(34)
          .strength((l) => Math.min(0.6, 0.12 + Math.sqrt(l.weight) * 0.06))
      )
      .force("charge", forceManyBody<SimNode>().strength(-70).distanceMax(280))
      .force("x", forceX<SimNode>(0).strength(0.05))
      .force("y", forceY<SimNode>(0).strength(0.05))
      .force("collide", forceCollide<SimNode>().radius((d) => d.r + 2))
      .alpha(prev.size ? 0.5 : 1)
      .on("tick", () => redrawRef.current());
    simRef.current = sim;
    fittedRef.current = false;
    return () => {
      sim.stop();
    };
  }, [props.nodes, props.edges]);

  // Drawing, sizing and input handling — set up once.
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let dirty = true;

    const dark = true; // the panel is always the dark Obsidian-like surface

    function fit() {
      const list = [...nodesRef.current.values()];
      if (!list.length) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const n of list) {
        minX = Math.min(minX, n.x ?? 0);
        maxX = Math.max(maxX, n.x ?? 0);
        minY = Math.min(minY, n.y ?? 0);
        maxY = Math.max(maxY, n.y ?? 0);
      }
      const { w, h } = sizeRef.current;
      const pad = 40;
      const gw = Math.max(40, maxX - minX);
      const gh = Math.max(40, maxY - minY);
      const k = Math.min(2.2, Math.min((w - pad * 2) / gw, (h - pad * 2) / gh));
      transformRef.current = {
        k,
        x: w / 2 - ((minX + maxX) / 2) * k,
        y: h / 2 - ((minY + maxY) / 2) * k,
      };
    }

    function draw() {
      const { w, h } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      const p = propsRef.current;
      const t = transformRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const dim = p.highlightedIds.size > 0;
      const sim = simRef.current;
      const links = sim
        ? ((sim.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>>).links() as SimLink[])
        : [];

      // Edges
      ctx.lineWidth = 1 / t.k;
      for (const l of links) {
        const s = l.source as SimNode;
        const d = l.target as SimNode;
        const on = dim && p.highlightedIds.has(s.id) && p.highlightedIds.has(d.id);
        const touchesSel = !!p.selectedId && (s.id === p.selectedId || d.id === p.selectedId);
        ctx.strokeStyle = touchesSel
          ? "rgba(167,139,250,0.9)"
          : on
            ? "rgba(148,163,184,0.5)"
            : dim
              ? "rgba(148,163,184,0.06)"
              : "rgba(148,163,184,0.28)";
        ctx.lineWidth = (touchesSel ? 1.6 : 1) / t.k;
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(d.x ?? 0, d.y ?? 0);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodesRef.current.values()) {
        const hi = !dim || p.highlightedIds.has(n.id);
        ctx.globalAlpha = hi ? 1 : 0.18;
        ctx.fillStyle = p.colors[n.type] || "#94a3b8";
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, n.r, 0, Math.PI * 2);
        ctx.fill();
        if (n.id === p.selectedId) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2 / t.k;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, n.r + 3 / t.k, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Labels: always for selected/highlighted/hubs; the rest fade in on zoom.
      ctx.globalAlpha = 1;
      const fontPx = 11 / t.k;
      ctx.font = `${fontPx}px var(--font-sans), system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const zoomAlpha = Math.max(0, Math.min(1, (t.k - 0.9) / 0.8));
      for (const n of nodesRef.current.values()) {
        const strong =
          n.id === p.selectedId ||
          (dim && p.highlightedIds.has(n.id)) ||
          p.labelIds.has(n.id);
        let a = strong ? 1 : zoomAlpha;
        if (dim && !p.highlightedIds.has(n.id)) a *= 0.25;
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        const text = n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label;
        const y = (n.y ?? 0) + n.r + 2 / t.k;
        ctx.lineWidth = 3 / t.k;
        ctx.strokeStyle = dark ? "rgba(2,6,23,0.9)" : "#fff";
        ctx.strokeText(text, n.x ?? 0, y);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(text, n.x ?? 0, y);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function loop() {
      if (dirty) {
        dirty = false;
        const sim = simRef.current;
        if (sim && !fittedRef.current && sim.alpha() < 0.35) {
          fit();
          fittedRef.current = true;
        } else if (sim && !fittedRef.current && nodesRef.current.size < 3) {
          fit();
          fittedRef.current = true;
        }
        draw();
      }
      raf = requestAnimationFrame(loop);
    }
    redrawRef.current = () => {
      dirty = true;
    };

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      if (fittedRef.current) fit();
      dirty = true;
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(loop);

    // ---- input ----
    const pointers = new Map<number, { x: number; y: number }>();
    let dragNode: SimNode | null = null;
    let panning = false;
    let moved = 0;
    let pinchDist = 0;
    let downNodeId: string | null = null;

    const toGraph = (cx: number, cy: number) => {
      const t = transformRef.current;
      return { x: (cx - t.x) / t.k, y: (cy - t.y) / t.k };
    };
    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    function hit(cx: number, cy: number): SimNode | null {
      const g = toGraph(cx, cy);
      const t = transformRef.current;
      // generous touch target: at least ~14 screen px
      const minR = 14 / t.k;
      let best: SimNode | null = null;
      let bestD = Infinity;
      for (const n of nodesRef.current.values()) {
        const dx = (n.x ?? 0) - g.x;
        const dy = (n.y ?? 0) - g.y;
        const d = Math.hypot(dx, dy);
        if (d <= Math.max(n.r + 3 / t.k, minR) && d < bestD) {
          best = n;
          bestD = d;
        }
      }
      return best;
    }
    function zoomAt(cx: number, cy: number, factor: number) {
      const t = transformRef.current;
      const k = Math.max(0.15, Math.min(8, t.k * factor));
      const f = k / t.k;
      transformRef.current = { k, x: cx - (cx - t.x) * f, y: cy - (cy - t.y) * f };
      dirty = true;
    }

    function onDown(e: PointerEvent) {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dragNode) {
          dragNode.fx = null;
          dragNode.fy = null;
          dragNode = null;
          simRef.current?.alphaTarget(0);
        }
        panning = false;
        downNodeId = null;
        return;
      }
      const n = hit(p.x, p.y);
      downNodeId = n ? n.id : null;
      if (n) {
        dragNode = n;
        const g = toGraph(p.x, p.y);
        n.fx = g.x;
        n.fy = g.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        panning = true;
      }
    }
    function onMove(e: PointerEvent) {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist);
        pinchDist = d;
        return;
      }
      if (dragNode) {
        const g = toGraph(p.x, p.y);
        dragNode.fx = g.x;
        dragNode.fy = g.y;
        dirty = true;
      } else if (panning) {
        const t = transformRef.current;
        transformRef.current = { ...t, x: t.x + (p.x - prev.x), y: t.y + (p.y - prev.y) };
        dirty = true;
      }
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size > 0) return;
      const tap = moved < 6;
      if (dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        dragNode = null;
        simRef.current?.alphaTarget(0);
      }
      panning = false;
      if (tap) propsRef.current.onSelect(downNodeId);
      downNodeId = null;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Keep the draw loop's props current, and repaint on selection/highlight
  // changes (no simulation restart needed).
  useEffect(() => {
    propsRef.current = props;
    redrawRef.current();
  });

  return (
    <div ref={wrapRef} className={props.className}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Diary graph. Drag nodes, pinch to zoom, tap a node to highlight its links."
        className="block touch-none"
      />
    </div>
  );
}
