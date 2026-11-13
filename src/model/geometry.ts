import type { Point, Room, Side, Wall } from './types';

export const EPS = 0.5; // mm tolerance

export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export function rectOf(r: Room | Rect): Rect {
  return { x: r.x, y: r.y, w: r.w, d: r.d };
}

export function rectCorners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ];
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.d / 2 };
}

/** Area of overlap of two rectangles (mm²). Touching edges → 0. */
export function rectOverlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const d = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
  return w > EPS && d > EPS ? w * d : 0;
}

export function pointInRect(p: Point, r: Rect, tol = 0): boolean {
  return p.x >= r.x - tol && p.x <= r.x + r.w + tol && p.y >= r.y - tol && p.y <= r.y + r.d + tol;
}

/** Signed polygon area (shoelace). Positive for clockwise in our y-down plan coordinates. */
export function signedArea(poly: Point[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function polygonArea(poly: Point[]): number {
  return Math.abs(signedArea(poly));
}

export function boundingBox(points: Point[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, d: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, d: maxY - minY };
}

/** Ray-casting point-in-polygon. Points on the boundary (within tol) count as inside. */
export function pointInPolygon(p: Point, poly: Point[], tol = EPS): boolean {
  for (let i = 0; i < poly.length; i++) {
    if (distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]) <= tol) return true;
  }
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Parameter t (0..1, unclamped) of the projection of p onto segment ab. */
export function projectT(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const t = Math.max(0, Math.min(1, projectT(p, a, b)));
  return dist(p, lerp(a, b, t));
}

export function wallLength(w: Wall): number {
  return dist(w.a, w.b);
}

/** Unit direction vector of a wall. */
export function wallDir(w: Wall): Point {
  const len = wallLength(w) || 1;
  return { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
}

/** Point on the wall centre-line at `offset` mm from a. */
export function pointAlongWall(w: Wall, offset: number): Point {
  const d = wallDir(w);
  return { x: w.a.x + d.x * offset, y: w.a.y + d.y * offset };
}

/** Outward-facing compass side of a boundary edge for a clockwise (y-down) polygon. */
export function edgeSide(a: Point, b: Point): Side {
  // For a clockwise polygon in y-down coordinates, the outward normal of edge a→b is (dy, -dx).
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = dy;
  const ny = -dx;
  if (Math.abs(nx) >= Math.abs(ny)) return nx > 0 ? 'E' : 'W';
  return ny > 0 ? 'S' : 'N';
}

/** Ensure a polygon is clockwise in plan (y-down) coordinates. */
export function ensureClockwise(poly: Point[]): Point[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

function lineIntersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / cross;
  return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
}

/**
 * Inset a clockwise polygon by a per-edge distance chosen from the edge's compass side.
 * Each edge is moved inward and consecutive edges are intersected. Works for convex and
 * mildly concave plots; for strongly concave shapes the result should be checked visually.
 */
export function insetPolygon(poly: Point[], setbacks: Record<Side, number>): Point[] {
  const p = ensureClockwise(poly);
  const n = p.length;
  if (n < 3) return [];
  const lines = p.map((a, i) => {
    const b = p[(i + 1) % n];
    const len = dist(a, b) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    // inward normal for clockwise y-down polygon is (-dy, dx)
    const inward = { x: -dir.y, y: dir.x };
    const s = setbacks[edgeSide(a, b)];
    return { point: { x: a.x + inward.x * s, y: a.y + inward.y * s }, dir };
  });
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n];
    const cur = lines[i];
    const hit = lineIntersection(prev.point, prev.dir, cur.point, cur.dir);
    out.push(hit ?? cur.point);
  }
  return out;
}

export function snap(v: number, step: number): number {
  if (!step) return v;
  return Math.round(v / step) * step;
}

export function snapPoint(p: Point, step: number): Point {
  return { x: snap(p.x, step), y: snap(p.y, step) };
}

export function rectPolygon(x: number, y: number, w: number, d: number): Point[] {
  return rectCorners({ x, y, w, d });
}

/** Normalise a rectangle drawn by dragging (possibly negative size). */
export function normRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    d: Math.abs(b.y - a.y),
  };
}

/** Which of the eight compass zones (3×3 grid over a bounding box) contains a point. */
export type Zone = 'NW' | 'N' | 'NE' | 'W' | 'C' | 'E' | 'SW' | 'S' | 'SE';
export const ZONE_GRID: Zone[][] = [
  ['NW', 'N', 'NE'],
  ['W', 'C', 'E'],
  ['SW', 'S', 'SE'],
];
export const ZONE_LABELS: Record<Zone, string> = {
  NW: 'North-west',
  N: 'North',
  NE: 'North-east',
  W: 'West',
  C: 'Centre',
  E: 'East',
  SW: 'South-west',
  S: 'South',
  SE: 'South-east',
};

export function zoneOf(p: Point, box: Rect): Zone {
  const col = Math.min(2, Math.max(0, Math.floor(((p.x - box.x) / (box.w || 1)) * 3)));
  const row = Math.min(2, Math.max(0, Math.floor(((p.y - box.y) / (box.d || 1)) * 3)));
  return ZONE_GRID[row][col];
}
