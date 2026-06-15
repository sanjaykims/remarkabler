import { describe, it, expect } from "vitest";
import { computePca, projectOnto } from "@/lib/mind";

// PCA tests assert mathematical INVARIANTS, never absolute coordinates.
// Power-iteration eigenvectors are unique only up to sign, so anything that
// pinned "pc1[0] > 0" or an exact projection value would be brittle. We test
// orthonormality, variance ordering, reconstruction, and direction match up
// to sign — and we deliberately build fixtures with well-separated variance
// so the components are unambiguous (no near-degenerate subspace to rotate
// within).

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Four points whose centred columns are mutually orthogonal (Hadamard-style
// sign patterns) with clearly separated variance: axis0 (36) ≫ axis1 (16) ≫
// axis2 (4). Axis3 is a constant offset that centring must remove; axis4 is
// pure zero. So PC1≈±e0, PC2≈±e1, PC3≈±e2.
function fixture(): Float32Array[] {
  const a = [3, -3, 3, -3]; // axis0 amplitudes — largest variance
  const b = [2, 2, -2, -2]; // axis1 — medium
  const c = [1, -1, -1, 1]; // axis2 — smallest
  return a.map((_, i) => {
    const v = new Float32Array(5);
    v[0] = a[i];
    v[1] = b[i];
    v[2] = c[i];
    v[3] = 10; // constant — removed by centring
    v[4] = 0;
    return v;
  });
}

const TOL = 1e-2;

describe("computePca", () => {
  it("returns null for empty input", () => {
    expect(computePca([], 3)).toBeNull();
  });

  it("returns null for zero-dim vectors", () => {
    expect(computePca([new Float32Array(0)], 3)).toBeNull();
  });

  it("centres correctly (mean removes the constant offset on axis3)", () => {
    const model = computePca(fixture(), 3)!;
    expect(model.mean[3]).toBeCloseTo(10, 5);
    expect(model.mean[0]).toBeCloseTo(0, 5);
    expect(model.mean[1]).toBeCloseTo(0, 5);
  });

  it("produces unit-norm principal components", () => {
    const { pcs } = computePca(fixture(), 3)!;
    for (const pc of pcs) {
      expect(Math.sqrt(dot(pc, pc))).toBeCloseTo(1, 3);
    }
  });

  it("produces mutually orthogonal components", () => {
    const { pcs } = computePca(fixture(), 3)!;
    expect(Math.abs(dot(pcs[0], pcs[1]))).toBeLessThan(TOL);
    expect(Math.abs(dot(pcs[0], pcs[2]))).toBeLessThan(TOL);
    expect(Math.abs(dot(pcs[1], pcs[2]))).toBeLessThan(TOL);
  });

  it("orders components by descending variance of the projections", () => {
    const data = fixture();
    const model = computePca(data, 3)!;
    const projected = data.map((v) => projectOnto(v, model));
    const variance = (axis: number) => {
      const vals = projected.map((p) => p[axis]);
      const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
      return vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
    };
    const v0 = variance(0);
    const v1 = variance(1);
    const v2 = variance(2);
    expect(v0).toBeGreaterThan(v1);
    expect(v1).toBeGreaterThan(v2);
  });

  it("recovers the known dominant directions up to sign", () => {
    const { pcs } = computePca(fixture(), 3)!;
    const e = (i: number) => {
      const v = new Float32Array(5);
      v[i] = 1;
      return v;
    };
    // |pc·e| ≈ 1 means the component lies along that axis (either sign).
    expect(Math.abs(dot(pcs[0], e(0)))).toBeCloseTo(1, 2);
    expect(Math.abs(dot(pcs[1], e(1)))).toBeCloseTo(1, 2);
    expect(Math.abs(dot(pcs[2], e(2)))).toBeCloseTo(1, 2);
  });

  it("reconstructs: sum of squared projections ≈ squared centred norm", () => {
    // The fixture lives in a 3-D subspace, so 3 PCs capture all variance and
    // the projection is energy-preserving for every point.
    const data = fixture();
    const model = computePca(data, 3)!;
    for (const v of data) {
      const coords = projectOnto(v, model);
      const projEnergy = coords.reduce((s, x) => s + x * x, 0);
      let centredEnergy = 0;
      for (let i = 0; i < v.length; i++) {
        const c = v[i] - model.mean[i];
        centredEnergy += c * c;
      }
      expect(projEnergy).toBeCloseTo(centredEnergy, 2);
    }
  });

  it("caps components at min(k, dim, n-1)", () => {
    // Two points → centred data is rank 1 → at most 1 meaningful component.
    const two = [new Float32Array([1, 0, 0]), new Float32Array([-1, 0, 0])];
    const model = computePca(two, 3)!;
    expect(model.pcs.length).toBe(1);
  });

  it("returns null for a single point (no variance to decompose)", () => {
    expect(computePca([new Float32Array([1, 2, 3])], 3)).toBeNull();
  });
});

describe("projectOnto", () => {
  it("returns one coordinate per component", () => {
    const model = computePca(fixture(), 3)!;
    expect(projectOnto(fixture()[0], model)).toHaveLength(3);
  });

  it("projects the mean to ~0 on every axis", () => {
    const model = computePca(fixture(), 3)!;
    const coords = projectOnto(model.mean, model);
    for (const c of coords) expect(Math.abs(c)).toBeLessThan(TOL);
  });
});
