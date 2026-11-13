/**
 * Elevation drawings: the 3D model's parts projected flat onto a vertical plane, seen from one side.
 * Orthographic, painter's order (farthest first). Units: metres.
 */
import { buildParts, floorElevations, type BoxPart, type GablePart, type Part, type PartKind } from '../three/buildModel';
import type { Project, Side } from './types';

export interface ElevShape {
  pts: [number, number][];
  color: string;
  kind: PartKind;
}

export interface Elevation {
  side: Side;
  shapes: ElevShape[];
  /** Horizontal and vertical extent of the building (m). */
  h0: number;
  h1: number;
  top: number;
  /** Level lines: ground, plinth and each floor (m above ground). */
  levels: { label: string; v: number }[];
}

export const ELEVATION_TITLES: Record<Side, string> = {
  N: 'North elevation (seen from the north)',
  E: 'East elevation (seen from the east)',
  S: 'South elevation (seen from the south)',
  W: 'West elevation (seen from the west)',
};

/** Horizontal screen coordinate and distance from the viewer for a 3D point (x east, z south). */
function view(side: Side, x: number, z: number): { h: number; dist: number } {
  switch (side) {
    case 'S':
      return { h: x, dist: -z };
    case 'N':
      return { h: -x, dist: z };
    case 'E':
      return { h: -z, dist: -x };
    case 'W':
      return { h: z, dist: x };
  }
}

function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function boxCorners(p: BoxPart): [number, number, number][] {
  const c = Math.cos(p.ry);
  const s = Math.sin(p.ry);
  const out: [number, number, number][] = [];
  for (const lx of [-p.sx / 2, p.sx / 2])
    for (const ly of [-p.sy / 2, p.sy / 2])
      for (const lz of [-p.sz / 2, p.sz / 2]) out.push([p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c]);
  return out;
}

function gableCorners(g: GablePart): [number, number, number][] {
  const top = g.base + g.rise;
  const base: [number, number, number][] = [
    [g.x0, g.base, g.z0],
    [g.x1, g.base, g.z0],
    [g.x1, g.base, g.z1],
    [g.x0, g.base, g.z1],
  ];
  const zm = (g.z0 + g.z1) / 2;
  const xm = (g.x0 + g.x1) / 2;
  const ridge: [number, number, number][] =
    g.ridge === 'EW'
      ? [
          [g.x0, top, zm],
          [g.x1, top, zm],
        ]
      : [
          [xm, top, g.z0],
          [xm, top, g.z1],
        ];
  return [...base, ...ridge];
}

/** Parts that belong to the building (not the compound wall, gates or ground features). */
export function isBuildingPart(p: Part): boolean {
  if (p.kind === 'site' || p.kind === 'gate' || p.kind === 'lid') return false;
  if (p.kind === 'wall' && p.shape === 'box' && !p.ref) return false; // compound wall
  return true;
}

export function computeElevation(project: Project, side: Side, parts: Part[] = buildParts(project)): Elevation {
  const shapes: (ElevShape & { dist: number })[] = [];
  let h0 = Infinity;
  let h1 = -Infinity;
  let top = 0;
  for (const p of parts.filter(isBuildingPart)) {
    const corners = p.shape === 'box' ? boxCorners(p) : gableCorners(p);
    const proj = corners.map(([x, y, z]) => {
      const v = view(side, x, z);
      return { h: v.h, v: y, dist: v.dist };
    });
    const pts = hull(proj.map((q) => [q.h, q.v] as [number, number]));
    if (pts.length < 3) continue;
    const area = Math.abs(pts.reduce((a, q, i) => a + q[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * q[1], 0)) / 2;
    if (area < 1e-5) continue;
    // Sort key: the part's nearest face — walls in front of a slab are drawn after it.
    const dist = proj.reduce((a, q) => a + q.dist, 0) / proj.length;
    shapes.push({ pts, color: p.color, kind: p.kind, dist });
    for (const q of pts) {
      h0 = Math.min(h0, q[0]);
      h1 = Math.max(h1, q[0]);
      top = Math.max(top, q[1]);
    }
  }
  shapes.sort((a, b) => b.dist - a.dist);
  const levels: Elevation['levels'] = [{ label: 'Ground', v: 0 }];
  const elev = floorElevations(project);
  for (const f of [...project.floors].sort((a, b) => a.level - b.level)) {
    const v = (elev.get(f.id) ?? 0) / 1000;
    // Skip the bare 'Ground' mark's neighbours only if they coincide with it.
    if (v <= top + 0.01 && v > 0.01) levels.push({ label: `${f.name} level`, v });
  }
  if (!isFinite(h0)) {
    h0 = 0;
    h1 = 1;
  }
  return { side, shapes: shapes.map(({ dist: _d, ...s }) => s), h0, h1, top, levels };
}
