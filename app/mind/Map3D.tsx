"use client";

// 3D embedding map. Loaded only on the client (next/dynamic, ssr:false in
// the parent) because three.js needs `window`. We render directly with
// react-three-fiber + drei's <OrbitControls>:
//   - one-finger drag → rotate
//   - two-finger pinch → zoom
//   - two-finger drag → pan
//
// Touch interaction gotcha: r3f mesh handlers like onPointerDown fire on
// the very first touch event, and if we call e.stopPropagation() there
// it eats the touch before OrbitControls can interpret it as a rotate
// gesture — so once the user's finger lands on a point, rotation breaks
// for the rest of the session. The fix is to use onClick (r3f synthesises
// it from down+up without significant movement), so dragging across a
// point still rotates the camera, and only a clean tap selects it.

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Html, Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

export type MapPoint = {
  page_id: string;
  x: number;
  y: number;
  z: number;
  entry_date: string | null;
  notebook_name: string;
  page_index: number;
  sentiment: number | null;
  themes: string[];
  summary: string;
  preview: string;
};

export type AxisLabels = {
  pc1: { positive: string; negative: string };
  pc2: { positive: string; negative: string };
  pc3: { positive: string; negative: string };
};

function sentimentColour(s: number | null): string {
  if (s == null) return "#78716c"; // stone-500
  if (s > 0) {
    // Warm amber, brighter for more positive.
    const t = Math.min(1, s);
    const r = Math.round(217 + (255 - 217) * t * 0.5);
    const g = Math.round(119 + (200 - 119) * t * 0.4);
    return `rgb(${r}, ${g}, 6)`;
  }
  const t = Math.min(1, Math.abs(s));
  const b = Math.round(140 + (220 - 140) * t * 0.5);
  return `rgb(70, 90, ${b})`;
}

// One point in the scene. Slight idle bob/glow on the active point so the
// user can pick it out after they tap.
function Point({
  p,
  active,
  onSelect,
}: {
  p: MapPoint;
  active: boolean;
  onSelect: (p: MapPoint) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  // The scaling pulse for the active point is purely cosmetic.
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (active) {
      const s = 1 + 0.15 * Math.sin(clock.getElapsedTime() * 4);
      ref.current.scale.setScalar(s);
    } else {
      ref.current.scale.setScalar(1);
    }
  });
  return (
    <mesh
      ref={ref}
      position={[p.x, p.y, p.z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        // onClick fires only when the pointer goes down and back up on
        // the same mesh without significant movement, i.e. a tap. A drag
        // that happens to pass over a point still goes to OrbitControls
        // for rotation. e.stopPropagation here prevents the click from
        // also triggering the canvas-level "deselect" handler below.
        e.stopPropagation();
        onSelect(p);
      }}
    >
      {/* Slightly larger radius than the 2D version so it remains tappable
          on a phone, given perspective foreshortening at the far side. */}
      <sphereGeometry args={[0.035, 16, 16]} />
      <meshStandardMaterial
        color={sentimentColour(p.sentiment)}
        emissive={sentimentColour(p.sentiment)}
        emissiveIntensity={active ? 0.6 : 0.15}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

function ActiveLabel({ p }: { p: MapPoint }) {
  // 3D billboarded label that always faces the camera. Keeps the diary date
  // visible above the highlighted dot during rotation so the user doesn't
  // lose it.
  const label = p.entry_date || "(no date)";
  return (
    <Billboard position={[p.x, p.y + 0.07, p.z]}>
      <Text
        fontSize={0.045}
        color="#fafaf9"
        outlineWidth={0.005}
        outlineColor="#1c1917"
        anchorY="bottom"
      >
        {label}
      </Text>
    </Billboard>
  );
}

// Floating label at the end of an axis. Rendered via drei's <Html> so it
// uses the page's normal CSS font instead of three.js's SDF text — that
// matters because Claude's labels can be Korean (or anything else) and the
// SDF default font doesn't include CJK glyphs, so <Text> would silently
// render nothing. `center` anchors on the 3D position, `distanceFactor`
// keeps the pill a reasonable size as the camera moves, and `pointerEvents:
// "none"` is essential so the label can't block OrbitControls' touch.
function AxisEndLabel({
  position,
  text,
  tone,
}: {
  position: [number, number, number];
  text: string;
  tone: "warm" | "cool";
}) {
  if (!text) return null;
  return (
    <Html
      position={position}
      center
      distanceFactor={6}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          background:
            tone === "warm" ? "rgba(120, 53, 15, 0.85)" : "rgba(30, 58, 138, 0.85)",
          color: "#fef3c7",
          padding: "3px 8px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          userSelect: "none",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

// Three thin lines through the origin so the user has a stable orientation
// reference while rotating. Subtle — not the focus, just a frame.
function Axes() {
  const len = 1.2;
  return (
    <group>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-len, 0, 0, len, 0, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#a8a29e" opacity={0.18} transparent />
      </line>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -len, 0, 0, len, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#a8a29e" opacity={0.18} transparent />
      </line>
      <line>
        <bufferGeometry attach="geometry">
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, -len, 0, 0, len]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial attach="material" color="#a8a29e" opacity={0.18} transparent />
      </line>
    </group>
  );
}

export default function Map3D({
  data,
  axisLabels,
}: {
  data: MapPoint[];
  axisLabels?: AxisLabels | null;
}) {
  const [active, setActive] = useState<MapPoint | null>(null);

  // Memoise so the per-point objects don't churn React on every re-render.
  const points = useMemo(() => data, [data]);

  return (
    <div className="space-y-2">
      <div
        className="w-full rounded border border-stone-200 dark:border-stone-800 overflow-hidden bg-stone-50 dark:bg-stone-950"
        // touchAction:none is set on BOTH the wrapper and the Canvas to keep
        // mobile browsers from stealing one-finger drags as page scrolls.
        // The wrapper covers the gap if the Canvas hasn't mounted yet; the
        // inline style on Canvas covers the inner <canvas> element itself.
        style={{ height: 480, touchAction: "none" }}
      >
        <Canvas
          camera={{ position: [1.6, 1.4, 1.8], fov: 50 }}
          // Clicking empty space (canvas with no mesh under the pointer)
          // clears the active selection. With onClick on meshes also
          // calling stopPropagation, this only fires for real misses.
          onPointerMissed={() => setActive(null)}
          dpr={[1, 2]}
          style={{ touchAction: "none" }}
        >
          {/* Hemisphere + soft directional gives the spheres dimensionality
              without making the dark theme washed-out. */}
          <hemisphereLight args={["#f5f5f4", "#1c1917", 0.7]} />
          <directionalLight position={[3, 4, 2]} intensity={0.6} />
          <Axes />
          {axisLabels && (
            <>
              {/* Six labels at the axis tips. Positioned just beyond the
                  cluster (which is normalised to ±1). Positive ends use the
                  warm tone, negative ends the cool tone — same colour cue
                  used for sentiment so the visual language stays
                  consistent. */}
              <AxisEndLabel position={[1.15, 0, 0]} tone="warm" text={axisLabels.pc1.positive} />
              <AxisEndLabel position={[-1.15, 0, 0]} tone="cool" text={axisLabels.pc1.negative} />
              <AxisEndLabel position={[0, 1.15, 0]} tone="warm" text={axisLabels.pc2.positive} />
              <AxisEndLabel position={[0, -1.15, 0]} tone="cool" text={axisLabels.pc2.negative} />
              <AxisEndLabel position={[0, 0, 1.15]} tone="warm" text={axisLabels.pc3.positive} />
              <AxisEndLabel position={[0, 0, -1.15]} tone="cool" text={axisLabels.pc3.negative} />
            </>
          )}
          {points.map((p) => (
            <Point
              key={p.page_id}
              p={p}
              active={active?.page_id === p.page_id}
              onSelect={setActive}
            />
          ))}
          {active && <ActiveLabel p={active} />}
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            // 50/120% zoom-out range — keeps the cluster readable on a phone
            // and prevents the user from flying through it.
            minDistance={0.6}
            maxDistance={6}
            // Slow the rotate so a touch flick doesn't whip past the cluster.
            rotateSpeed={0.7}
            zoomSpeed={0.8}
            panSpeed={0.6}
            // Pin the gestures so one finger always rotates and two fingers
            // always zoom+pan, regardless of which order OrbitControls'
            // internal state-machine ended up in after a previous gesture.
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN,
            }}
            makeDefault
          />
        </Canvas>
      </div>

      {/* Guaranteed-visible static legend of the axis labels. Lives outside
          the WebGL canvas so it renders regardless of font / Html overlay
          behaviour inside three.js. Shown only when labels actually exist. */}
      {axisLabels && (
        <div className="rounded border border-stone-200 dark:border-stone-800 p-2 text-xs space-y-1.5">
          <p className="text-[11px] opacity-50 uppercase tracking-wide">
            Axes
          </p>
          {(["pc1", "pc2", "pc3"] as const).map((k, i) => (
            <p key={k} className="flex items-center gap-2 flex-wrap">
              <span className="font-mono opacity-40 text-[10px]">
                {["X", "Y", "Z"][i]}
              </span>
              <span className="rounded-full bg-amber-900/80 text-amber-100 px-2 py-0.5">
                {axisLabels[k].positive}
              </span>
              <span className="opacity-40">↔</span>
              <span className="rounded-full bg-blue-900/80 text-blue-100 px-2 py-0.5">
                {axisLabels[k].negative}
              </span>
            </p>
          ))}
        </div>
      )}

      {active ? (
        <div className="rounded border border-stone-200 dark:border-stone-800 p-2 text-xs space-y-1">
          <p className="opacity-60">
            {active.entry_date || "(no date)"} · {active.notebook_name} · page{" "}
            {active.page_index + 1}
            {active.sentiment != null && (
              <> · sentiment {active.sentiment.toFixed(2)}</>
            )}
          </p>
          {active.themes.length > 0 && (
            <p className="opacity-90">
              {active.themes.map((t) => (
                <span
                  key={t}
                  className="inline-block mr-1 mb-1 rounded bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5"
                >
                  {t}
                </span>
              ))}
            </p>
          )}
          {active.summary && <p>{active.summary}</p>}
          {!active.summary && active.preview && (
            <p className="opacity-70 whitespace-pre-wrap">{active.preview}…</p>
          )}
          <button
            onClick={() => setActive(null)}
            className="text-[11px] opacity-50 hover:opacity-100 underline"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-[11px] opacity-50">
          Drag to rotate · pinch to zoom · tap a point for detail
        </p>
      )}
    </div>
  );
}

// Tiny re-export so the parent page doesn't need to import three directly.
export { Suspense };
