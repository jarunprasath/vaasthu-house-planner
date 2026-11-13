import { createWall } from './factory';
import { distanceToSegment, EPS, pointAlongWall, pointInRect, projectT, wallLength } from './geometry';
import { OUTDOOR_ROOM_TYPES } from './types';
import { roomContainsStrict, roomEdges } from './roomShape';
import type { Floor, Opening, Point, Project, ProjectSettings, Room, Wall } from './types';

/** Room types that do not get enclosing walls when walls are generated from rooms. */
export const NO_WALL_TYPES = [...OUTDOOR_ROOM_TYPES, 'staircase'] as const;

export function roomGetsWalls(r: Room): boolean {
  return !(NO_WALL_TYPES as readonly string[]).includes(r.type);
}

interface Seg {
  /** fixed coordinate (y for horizontal, x for vertical) */
  c: number;
  from: number;
  to: number;
}

const key = (v: number) => Math.round(v).toString();

/**
 * Generate wall centre-lines from the rectangles of walled rooms.
 * Shared edges become a single interior wall; edges with no walled room on one side become exterior.
 * Collinear pieces of the same kind are merged.
 */
export function buildWallsFromRooms(rooms: Room[], settings: ProjectSettings): Wall[] {
  const walled = rooms.filter(roomGetsWalls);
  const horiz = new Map<string, Seg[]>();
  const vert = new Map<string, Seg[]>();
  const push = (m: Map<string, Seg[]>, s: Seg) => {
    const k = key(s.c);
    const list = m.get(k) ?? [];
    list.push(s);
    m.set(k, list);
  };
  const diagonal: [Point, Point][] = [];
  for (const r of walled) {
    for (const [a, b] of roomEdges(r)) {
      if (Math.abs(a.y - b.y) < EPS) push(horiz, { c: a.y, from: Math.min(a.x, b.x), to: Math.max(a.x, b.x) });
      else if (Math.abs(a.x - b.x) < EPS) push(vert, { c: a.x, from: Math.min(a.y, b.y), to: Math.max(a.y, b.y) });
      else diagonal.push([a, b]);
    }
  }

  const insideWalled = (p: Point) => walled.some((r) => roomContainsStrict(r, p, EPS));

  const walls: Wall[] = [];
  const probe = 20; // mm either side of the centre-line

  const process = (m: Map<string, Seg[]>, horizontal: boolean) => {
    for (const segs of m.values()) {
      const c = segs[0].c;
      const cuts = Array.from(new Set(segs.flatMap((s) => [Math.round(s.from), Math.round(s.to)]))).sort(
        (a, b) => a - b,
      );
      type Piece = { from: number; to: number; kind: 'exterior' | 'interior' };
      const pieces: Piece[] = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        const from = cuts[i];
        const to = cuts[i + 1];
        if (to - from < EPS) continue;
        const mid = (from + to) / 2;
        const covered = segs.some((s) => s.from <= mid && s.to >= mid);
        if (!covered) continue;
        const p1 = horizontal ? { x: mid, y: c - probe } : { x: c - probe, y: mid };
        const p2 = horizontal ? { x: mid, y: c + probe } : { x: c + probe, y: mid };
        const kind = insideWalled(p1) && insideWalled(p2) ? 'interior' : 'exterior';
        const last = pieces[pieces.length - 1];
        if (last && last.kind === kind && Math.abs(last.to - from) < EPS) last.to = to;
        else pieces.push({ from, to, kind });
      }
      for (const p of pieces) {
        const a = horizontal ? { x: p.from, y: c } : { x: c, y: p.from };
        const b = horizontal ? { x: p.to, y: c } : { x: c, y: p.to };
        const t = p.kind === 'exterior' ? settings.defaultExteriorWallMm : settings.defaultInteriorWallMm;
        walls.push(createWall(a, b, p.kind, t, settings.defaultWallHeightMm));
      }
    }
  };
  process(horiz, true);
  process(vert, false);
  // Slanted edges of irregular rooms become exterior walls as they are (no sharing detection).
  for (const [a, b] of diagonal) walls.push(createWall(a, b, 'exterior', settings.defaultExteriorWallMm, settings.defaultWallHeightMm));
  return walls;
}

/**
 * Re-attach openings to a new set of walls: each opening keeps its world position and moves to the
 * collinear wall that now contains it. Openings that no longer sit on any wall are returned as dropped.
 */
export function rehostOpenings(
  openings: Opening[],
  oldWalls: Wall[],
  newWalls: Wall[],
): { kept: Opening[]; dropped: Opening[] } {
  const kept: Opening[] = [];
  const dropped: Opening[] = [];
  for (const o of openings) {
    const old = oldWalls.find((w) => w.id === o.wallId);
    if (!old) {
      dropped.push(o);
      continue;
    }
    const centre = pointAlongWall(old, o.offsetMm);
    const oldHorizontal = Math.abs(old.a.y - old.b.y) < Math.abs(old.a.x - old.b.x);
    const host = newWalls.find((w) => {
      const horizontal = Math.abs(w.a.y - w.b.y) < Math.abs(w.a.x - w.b.x);
      if (horizontal !== oldHorizontal) return false;
      if (distanceToSegment(centre, w.a, w.b) > 1) return false;
      const t = projectT(centre, w.a, w.b);
      return t > 0 && t < 1;
    });
    if (!host) {
      dropped.push(o);
      continue;
    }
    const offset = projectT(centre, host.a, host.b) * wallLength(host);
    // Preserve swing orientation if the new wall runs the opposite way.
    const sameDirection =
      (host.b.x - host.a.x) * (old.b.x - old.a.x) + (host.b.y - host.a.y) * (old.b.y - old.a.y) > 0;
    kept.push({
      ...o,
      wallId: host.id,
      offsetMm: offset,
      hinge: sameDirection ? o.hinge : o.hinge === 'start' ? 'end' : 'start',
      swing: sameDirection ? o.swing : o.swing === 'left' ? 'right' : 'left',
    });
  }
  return { kept, dropped };
}

/** Rebuild a floor's walls from its rooms, re-hosting doors and windows. */
export function rebuildFloorWalls(floor: Floor, settings: ProjectSettings): { floor: Floor; dropped: number } {
  const walls = buildWallsFromRooms(floor.rooms, settings);
  const { kept, dropped } = rehostOpenings(floor.openings, floor.walls, walls);
  return { floor: { ...floor, walls, openings: kept }, dropped: dropped.length };
}

/**
 * Compound wall along every plot boundary edge, set inside the boundary by half its thickness.
 */
export function buildCompoundWalls(project: Project, thicknessMm = 200, heightMm = 1500): Wall[] {
  const poly = project.plot.boundary;
  const n = poly.length;
  const walls: Wall[] = [];
  // Shift each edge inward by half the thickness and intersect neighbours (same as setback inset).
  const half = thicknessMm / 2;
  const inset = insetUniform(poly, half);
  for (let i = 0; i < n; i++) {
    walls.push(createWall(inset[i], inset[(i + 1) % n], 'compound', thicknessMm, heightMm));
  }
  return walls;
}

function insetUniform(poly: Point[], d: number): Point[] {
  // Local copy to avoid a circular import with geometry.insetPolygon's Side mapping.
  const n = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const inward = { x: -dir.y, y: dir.x };
    return { p: { x: a.x + inward.x * d, y: a.y + inward.y * d }, dir };
  });
  return lines.map((cur, i) => {
    const prev = lines[(i - 1 + n) % n];
    const cross = prev.dir.x * cur.dir.y - prev.dir.y * cur.dir.x;
    if (Math.abs(cross) < 1e-9) return cur.p;
    const t = ((cur.p.x - prev.p.x) * cur.dir.y - (cur.p.y - prev.p.y) * cur.dir.x) / cross;
    return { x: prev.p.x + prev.dir.x * t, y: prev.p.y + prev.dir.y * t };
  });
}

/** True if the rectangle of a room touches the given wall along its length (used for "room has a door"). */
export function wallBoundsRoom(w: Wall, r: Room): boolean {
  const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
  return pointInRect(mid, r, 1);
}
