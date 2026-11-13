/**
 * Room shape helpers. A room is a rectangle (x, y, w, d) unless it has `points`, in which case it is a
 * polygon and x/y/w/d are kept as its bounding box. Rectilinear polygons (L, U, T shapes) are exact
 * everywhere; polygons with slanted edges are handled approximately for overlap and area-union checks.
 */
import { boundingBox, distanceToSegment, ensureClockwise, pointInPolygon, polygonArea, rectCorners, type Rect } from './geometry';
import type { Point, Room } from './types';

export function isPolygonRoom(r: Room): r is Room & { points: Point[] } {
  return Array.isArray(r.points) && r.points.length >= 3;
}

export function roomPolygon(r: Room): Point[] {
  return isPolygonRoom(r) ? r.points : rectCorners(r);
}

export function roomArea(r: Room): number {
  return isPolygonRoom(r) ? polygonArea(r.points) : r.w * r.d;
}

/** Strictly inside (not on an edge, with tolerance in mm). */
export function roomContainsStrict(r: Room, p: Point, tol = 0.5): boolean {
  if (!isPolygonRoom(r)) return p.x > r.x + tol && p.x < r.x + r.w - tol && p.y > r.y + tol && p.y < r.y + r.d - tol;
  const poly = r.points;
  for (let i = 0; i < poly.length; i++) if (distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]) <= tol) return false;
  return pointInPolygon(p, poly, 0);
}

export function roomEdges(r: Room): [Point, Point][] {
  const poly = roomPolygon(r);
  return poly.map((a, i) => [a, poly[(i + 1) % poly.length]] as [Point, Point]);
}

/**
 * Decompose a room into axis-aligned rectangles (one rectangle for a plain room). Cells of the grid formed
 * by the polygon's vertex coordinates are kept when their centre is inside; neighbouring cells in a row
 * are merged.
 */
export function roomRects(r: Room): Rect[] {
  if (!isPolygonRoom(r)) return [{ x: r.x, y: r.y, w: r.w, d: r.d }];
  const xs = [...new Set(r.points.map((p) => p.x))].sort((a, b) => a - b);
  const ys = [...new Set(r.points.map((p) => p.y))].sort((a, b) => a - b);
  const out: Rect[] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    let run: Rect | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const c = { x: (xs[i] + xs[i + 1]) / 2, y: (ys[j] + ys[j + 1]) / 2 };
      if (pointInPolygon(c, r.points, 0)) {
        if (run && Math.abs(run.x + run.w - xs[i]) < 0.5) run.w = xs[i + 1] - run.x;
        else {
          if (run) out.push(run);
          run = { x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], d: ys[j + 1] - ys[j] };
        }
      } else if (run) {
        out.push(run);
        run = null;
      }
    }
    if (run) out.push(run);
  }
  return out;
}

/** A good point for the room's label: centre of its largest rectangle piece. */
export function roomLabelRect(r: Room): Rect {
  const rects = roomRects(r);
  return rects.reduce((best, x) => (x.w * x.d > best.w * best.d ? x : best), rects[0] ?? { x: r.x, y: r.y, w: r.w, d: r.d });
}

export function roomCentre(r: Room): Point {
  const l = roomLabelRect(r);
  return { x: l.x + l.w / 2, y: l.y + l.d / 2 };
}

/** Recompute x, y, w, d from points. */
export function withBounds<T extends Room>(r: T): T {
  if (!isPolygonRoom(r)) return r;
  const pts = ensureClockwise(r.points);
  const b = boundingBox(pts);
  return { ...r, points: pts, x: b.x, y: b.y, w: b.w, d: b.d };
}

/** An L-shape from a rectangle: removes the south-east quarter. */
export function lShapeOf(r: Room): Point[] {
  const { x, y, w, d } = r;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d / 2 },
    { x: x + w / 2, y: y + d / 2 },
    { x: x + w / 2, y: y + d },
    { x, y: y + d },
  ];
}
