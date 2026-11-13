import { boundingBox, insetPolygon, pointInPolygon, pointInRect, polygonArea, type Rect } from './geometry';
import type { Footprint, Point, Project, RoomType, Side } from './types';

/** Open site elements that never move with the house. */
export const SITE_ROOM_TYPES: RoomType[] = ['garden', 'pathway', 'parking', 'sump', 'septic_tank', 'borewell'];

export interface Clearance {
  side: Side;
  /** Distance from the house edge to the plot boundary (mm), measured outward from the middle of that edge. */
  mm: number;
  /** House edge midpoint and the boundary point it was measured to. */
  from: Point;
  to: Point;
}

const OUTWARD: Record<Side, Point> = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };

function edgeMidpoint(f: Rect, side: Side): Point {
  switch (side) {
    case 'N':
      return { x: f.x + f.w / 2, y: f.y };
    case 'S':
      return { x: f.x + f.w / 2, y: f.y + f.d };
    case 'E':
      return { x: f.x + f.w, y: f.y + f.d / 2 };
    case 'W':
      return { x: f.x, y: f.y + f.d / 2 };
  }
}

/** Distance along a ray from p in direction dir to the first polygon edge, or null if none. */
function rayToPolygon(p: Point, dir: Point, poly: Point[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / denom;
    const u = ((a.x - p.x) * dir.y - (a.y - p.y) * dir.x) / denom;
    if (t >= -0.5 && u >= -1e-9 && u <= 1 + 1e-9 && (best === null || t < best)) best = t;
  }
  return best;
}

/**
 * Clearance from each side of the house to the plot boundary. For a rectangular plot this is the exact
 * gap; for an irregular plot it is measured at the middle of each house side. Sides whose middle lies
 * outside the plot are omitted.
 */
export function clearances(f: Rect, boundary: Point[]): Clearance[] {
  const out: Clearance[] = [];
  for (const side of ['N', 'E', 'S', 'W'] as Side[]) {
    const from = edgeMidpoint(f, side);
    if (!pointInPolygon(from, boundary, 1)) continue;
    const dir = OUTWARD[side];
    const t = rayToPolygon(from, dir, boundary);
    if (t === null) continue;
    const mm = Math.max(0, t);
    out.push({ side, mm, from, to: { x: from.x + dir.x * mm, y: from.y + dir.y * mm } });
  }
  return out;
}

export function footprintInsidePlot(f: Rect, boundary: Point[]): boolean {
  return [
    { x: f.x, y: f.y },
    { x: f.x + f.w, y: f.y },
    { x: f.x + f.w, y: f.y + f.d },
    { x: f.x, y: f.y + f.d },
  ].every((c) => pointInPolygon(c, boundary, 1));
}

/** Plot area not covered by the house outline (mm²). */
export function openLandArea(project: Project): number {
  const f = project.footprint;
  return polygonArea(project.plot.boundary) - (f ? f.w * f.d : 0);
}

/** Ids of rooms and walls (on every floor) that belong to the house, i.e. lie inside its outline. */
export function houseContents(project: Project, f: Rect): { rooms: Set<string>; walls: Set<string> } {
  const rooms = new Set<string>();
  const walls = new Set<string>();
  for (const floor of project.floors) {
    for (const r of floor.rooms) {
      if (SITE_ROOM_TYPES.includes(r.type)) continue;
      if (pointInRect({ x: r.x + r.w / 2, y: r.y + r.d / 2 }, f, 1)) rooms.add(r.id);
    }
    for (const w of floor.walls) {
      const tol = w.thicknessMm / 2 + 1;
      if (pointInRect(w.a, f, tol) && pointInRect(w.b, f, tol)) walls.add(w.id);
    }
  }
  return { rooms, walls };
}

/**
 * Default outline for a project that has none: the extent of the existing building rooms if there
 * are any, otherwise the buildable area inside the setbacks.
 */
export function defaultFootprint(project: Project): Footprint {
  const pts = project.floors.flatMap((f) =>
    f.rooms
      .filter((r) => !SITE_ROOM_TYPES.includes(r.type))
      .flatMap((r) => [
        { x: r.x, y: r.y },
        { x: r.x + r.w, y: r.y + r.d },
      ]),
  );
  const box = pts.length ? boundingBox(pts) : boundingBox(insetPolygon(project.plot.boundary, project.plot.setbacks));
  return { x: box.x, y: box.y, w: Math.max(box.w, 1000), d: Math.max(box.d, 1000), locked: false };
}
