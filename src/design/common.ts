/** Helpers shared by the kitchen and bathroom designers. */
import { catalogEntry, itemBounds, itemCorners } from '../model/catalog';
import { pointAlongWall, rectOverlapArea, wallDir, type Rect } from '../model/geometry';
import type { Floor, Item, Opening, Point, Room, Side, Wall } from '../model/types';

export interface RoomOpening {
  opening: Opening;
  wall: Wall;
  side: Side;
  /** Interval along that side, measured from the side's start (N/S: from west; E/W: from north), mm. */
  from: number;
  to: number;
  centre: Point;
}

/** Inner face offset from a room's centre-line edge (half of a 4½" partition). */
export const INSET = 57;

/** Which side of a rectangular room a point on its edge lies on. */
function sideOf(r: Rect, p: Point, tol = 30): Side | null {
  if (Math.abs(p.y - r.y) < tol && p.x > r.x - tol && p.x < r.x + r.w + tol) return 'N';
  if (Math.abs(p.y - (r.y + r.d)) < tol && p.x > r.x - tol && p.x < r.x + r.w + tol) return 'S';
  if (Math.abs(p.x - r.x) < tol && p.y > r.y - tol && p.y < r.y + r.d + tol) return 'W';
  if (Math.abs(p.x - (r.x + r.w)) < tol && p.y > r.y - tol && p.y < r.y + r.d + tol) return 'E';
  return null;
}

/** Doors and windows on the edges of a room (uses the room's bounding rectangle). */
export function roomOpenings(floor: Floor, room: Room): RoomOpening[] {
  const out: RoomOpening[] = [];
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const c = pointAlongWall(w, o.offsetMm);
    const side = sideOf(room, c);
    if (!side) continue;
    const along = side === 'N' || side === 'S' ? c.x - room.x : c.y - room.y;
    out.push({ opening: o, wall: w, side, from: along - o.widthMm / 2, to: along + o.widthMm / 2, centre: c });
  }
  return out;
}

export function sideLength(r: Rect, side: Side): number {
  return side === 'N' || side === 'S' ? r.w : r.d;
}

/** Rotation (deg) for an item standing against `side` with its front facing into the room. */
export function rotationAgainst(side: Side): number {
  return { N: 0, S: 180, E: 90, W: 270 }[side];
}

/** Centre of an item of depth `depth` placed against `side` at distance `along` from the side's start. */
export function placeAgainst(r: Rect, side: Side, along: number, depth: number): Point {
  switch (side) {
    case 'N':
      return { x: r.x + along, y: r.y + INSET + depth / 2 };
    case 'S':
      return { x: r.x + along, y: r.y + r.d - INSET - depth / 2 };
    case 'W':
      return { x: r.x + INSET + depth / 2, y: r.y + along };
    case 'E':
      return { x: r.x + r.w - INSET - depth / 2, y: r.y + along };
  }
}

/** Square area a door leaf sweeps through on the side it opens into (mm). */
export function doorSwingRect(o: Opening, w: Wall): Rect {
  const d = wallDir(w);
  const n = { x: -d.y, y: d.x }; // +v in the opening's local frame (matches the plan symbol)
  const side = o.swing === 'left' ? -1 : 1;
  const c = pointAlongWall(w, o.offsetMm);
  const pts = [
    { x: c.x - (d.x * o.widthMm) / 2, y: c.y - (d.y * o.widthMm) / 2 },
    { x: c.x + (d.x * o.widthMm) / 2, y: c.y + (d.y * o.widthMm) / 2 },
  ].flatMap((p) => [p, { x: p.x + n.x * side * o.widthMm, y: p.y + n.y * side * o.widthMm }]);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

/** Items whose centre lies inside the room's bounding rectangle. */
export function itemsInRoom(floor: Floor, room: Room): Item[] {
  return floor.items.filter((it) => it.x > room.x && it.x < room.x + room.w && it.y > room.y && it.y < room.y + room.d);
}

export interface DesignNote {
  level: 'ok' | 'warning' | 'info';
  text: string;
  /** Item ids the note is about. */
  ids: string[];
}

/** Items that sit in a door's swing area. */
export function doorConflicts(floor: Floor, room: Room, items: Item[]): DesignNote[] {
  const notes: DesignNote[] = [];
  for (const ro of roomOpenings(floor, room).filter((x) => x.opening.type === 'door')) {
    const swing = doorSwingRect(ro.opening, ro.wall);
    // Only swings that go into this room matter.
    const swingCentre = { x: swing.x + swing.w / 2, y: swing.y + swing.d / 2 };
    if (!(swingCentre.x > room.x && swingCentre.x < room.x + room.w && swingCentre.y > room.y && swingCentre.y < room.y + room.d)) continue;
    const hit = items.filter((it) => !catalogEntry(it.type).tags?.includes('wall-unit') && rectOverlapArea(itemBounds(it), swing) > 2500);
    if (hit.length) {
      notes.push({
        level: 'warning',
        text: `Door ${ro.opening.label || ''} swings into ${hit.map((h) => catalogEntry(h.type).label.toLowerCase()).join(', ')}. Move them, flip the door or use a sliding door.`,
        ids: hit.map((h) => h.id),
      });
    }
  }
  return notes;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest gap between two items' footprints (0 when they touch or overlap). */
export function gapBetween(a: Item, b: Item): number {
  const A = itemBounds(a);
  const B = itemBounds(b);
  const dx = Math.max(0, Math.max(A.x - (B.x + B.w), B.x - (A.x + A.w)));
  const dy = Math.max(0, Math.max(A.y - (B.y + B.d), B.y - (A.y + A.d)));
  return Math.hypot(dx, dy);
}

/** Direction the item's front faces (rotation 0 = south, turning clockwise as seen on the plan). */
export function frontFacing(it: Item): Side {
  const r = ((Math.round(it.rotation / 90) % 4) + 4) % 4;
  return (['S', 'W', 'N', 'E'] as Side[])[r];
}

const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const opposite = (s: Side) => OPP[s];

/** Direction a person faces while standing at the item's front and working at it (e.g. at a hob). */
export function userFacing(it: Item): Side {
  return OPP[frontFacing(it)];
}

export { itemCorners };
