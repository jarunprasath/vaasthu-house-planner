/**
 * Bathroom layout generator and checks.
 *
 * Clearances are approximate planning guidance (the widely used NKBA bathroom guidelines:
 * toilet centre to a side wall about 380 mm minimum / 450 mm recommended, about 530 mm minimum /
 * 760 mm recommended clear space in front of a toilet or basin). They are not regulations.
 * Vaasthu texts commonly advise that a person using the toilet faces north or south; traditions differ.
 */
import { catalogEntry, createItem, itemBounds, itemFront } from '../model/catalog';
import { rectOverlapArea, type Rect } from '../model/geometry';
import type { Floor, Item, Room, Side } from '../model/types';
import {
  doorConflicts,
  doorSwingRect,
  frontFacing,
  INSET,
  itemsInRoom,
  opposite,
  placeAgainst,
  roomOpenings,
  rotationAgainst,
  sideLength,
  type DesignNote,
} from './common';

export interface BathroomOptions {
  wc: 'western' | 'indian' | 'none';
  bathing: 'shower' | 'tub' | 'none';
  basin: boolean;
  geyser: boolean;
  exhaust: boolean;
  /** Prefer a toilet position where the user faces north or south (Vaasthu). */
  vaasthuWc: boolean;
}

export const DEFAULT_BATHROOM: BathroomOptions = { wc: 'western', bathing: 'shower', basin: true, geyser: true, exhaust: true, vaasthuWc: true };

export const BATHROOM_TYPES = new Set(['wc_western', 'wc_indian', 'washbasin', 'shower', 'bathtub', 'mirror', 'geyser', 'exhaust_fan', 'floor_drain', 'bath_storage']);

const SIDES: Side[] = ['N', 'E', 'S', 'W'];
const SIDE_WORD: Record<Side, string> = { N: 'north', S: 'south', E: 'east', W: 'west' };

function inner(room: Room): Rect {
  return { x: room.x + INSET, y: room.y + INSET, w: room.w - 2 * INSET, d: room.d - 2 * INSET };
}

function inside(b: Rect, r: Rect): boolean {
  return b.x >= r.x - 1 && b.y >= r.y - 1 && b.x + b.w <= r.x + r.w + 1 && b.y + b.d <= r.y + r.d + 1;
}

function grow(b: Rect, m: number): Rect {
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, d: b.d + 2 * m };
}

/** Clear zone in front of an item (depth `dist`, as wide as the item plus `extra` each side). */
function frontZone(it: Item, dist: number, extra = 0): Rect {
  const f = frontFacing(it);
  const b = itemBounds(it);
  switch (f) {
    case 'S':
      return { x: b.x - extra, y: b.y + b.d, w: b.w + 2 * extra, d: dist };
    case 'N':
      return { x: b.x - extra, y: b.y - dist, w: b.w + 2 * extra, d: dist };
    case 'E':
      return { x: b.x + b.w, y: b.y - extra, w: dist, d: b.d + 2 * extra };
    case 'W':
      return { x: b.x - dist, y: b.y - extra, w: dist, d: b.d + 2 * extra };
  }
}

export interface BathroomResult {
  items: Item[];
  notes: DesignNote[];
}

export function generateBathroom(floor: Floor, room: Room, opt: BathroomOptions): BathroomResult {
  const notes: DesignNote[] = [];
  const items: Item[] = [];
  const box = inner(room);
  const ops = roomOpenings(floor, room);
  const doors = ops.filter((o) => o.opening.type === 'door');
  const windows = ops.filter((o) => o.opening.type === 'window');
  const doorSide = doors[0]?.side;
  const swings = doors.map((d) => doorSwingRect(d.opening, d.wall)).filter((r) => rectOverlapArea(r, room) > 0);
  const doorStrips: Rect[] = doors.map((d) => {
    // Keep the doorway itself and ~600 mm in front of it clear.
    const a = Math.min(d.from, d.to) - 50;
    const len = Math.abs(d.to - d.from) + 100;
    const p = placeAgainst(room, d.side, a + len / 2, 600);
    return d.side === 'N' || d.side === 'S' ? { x: p.x - len / 2, y: p.y - 300, w: len, d: 600 } : { x: p.x - 300, y: p.y - len / 2, w: 600, d: len };
  });

  const blocked = (): Rect[] => [
    ...swings,
    ...doorStrips,
    ...items.filter((i) => !catalogEntry(i.type).tags?.includes('wall-unit') && i.type !== 'floor_drain').map((i) => itemBounds(i)),
  ];

  /** Try every wall position for an item and keep the best-scoring one that fits. */
  const tryPlace = (type: string, size: { w?: number; d?: number }, clear: { front: number; side: number }, score: (it: Item, side: Side) => number): Item | null => {
    const c = catalogEntry(type);
    const w = size.w ?? c.w;
    const d = size.d ?? c.d;
    let best: { it: Item; s: number } | null = null;
    for (const side of SIDES) {
      const len = sideLength(room, side);
      for (let along = INSET + w / 2; along <= len - INSET - w / 2 + 1; along += 50) {
        const p = placeAgainst(room, side, along, d);
        const it = createItem(type, p.x, p.y, rotationAgainst(side), { w, d });
        const b = itemBounds(it);
        if (!inside(b, box)) continue;
        const zone = frontZone(it, clear.front, clear.side);
        const all = blocked();
        if (all.some((r) => rectOverlapArea(grow(b, 0), r) > 100)) continue;
        // Side clearance (e.g. toilet centre to a wall) and front clear zone must stay inside and free.
        const sideZone = grow(b, clear.side);
        if (!inside({ ...sideZone, y: b.y, d: b.d }, box) && (side === 'N' || side === 'S')) continue;
        if (!inside({ ...sideZone, x: b.x, w: b.w }, box) && (side === 'E' || side === 'W')) continue;
        if (!inside(zone, box)) continue;
        if (items.filter((i) => !catalogEntry(i.type).tags?.includes('wall-unit')).some((i) => rectOverlapArea(zone, itemBounds(i)) > 100)) continue;
        const s = score(it, side);
        if (!best || s > best.s) best = { it, s };
      }
    }
    return best?.it ?? null;
  };

  const doorPt = doors[0]?.centre ?? { x: room.x, y: room.y };
  const far = (it: Item) => Math.hypot(it.x - doorPt.x, it.y - doorPt.y);

  // 1. Bathing area: the corner farthest from the door.
  if (opt.bathing !== 'none') {
    let bath: Item | null = null;
    if (opt.bathing === 'tub') {
      bath = tryPlace('bathtub', {}, { front: 0, side: 0 }, (it) => far(it));
      if (!bath) notes.push({ level: 'info', text: 'A bathtub does not fit; a shower area was used instead.', ids: [] });
    }
    if (!bath) {
      const s = Math.min(900, Math.floor(Math.min(box.w, box.d) / 2 / 50) * 50);
      if (s >= 750) bath = tryPlace('shower', { w: s, d: s }, { front: 0, side: 0 }, (it) => far(it) + (doorSide && frontFacing(it) === doorSide ? 0 : 1));
    }
    if (bath) {
      items.push(bath);
      // Floor drain in the middle of the wet area.
      items.push(createItem('floor_drain', Math.round(bath.x), Math.round(bath.y)));
      if (opt.geyser) {
        // On the back wall of the wet area.
        const g = createItem('geyser', 0, 0, bath.rotation);
        const p = itemFront(bath, -bath.d + g.d / 2);
        items.push({ ...g, x: Math.round(p.x), y: Math.round(p.y) });
      }
    } else notes.push({ level: 'warning', text: 'There is no free corner for a bathing area of at least 750 × 750 mm.', ids: [] });
  }

  // 2. Toilet: clear of the door, with side and front clearances; Vaasthu prefers the user facing N or S.
  if (opt.wc !== 'none') {
    const type = opt.wc === 'western' ? 'wc_western' : 'wc_indian';
    let wc = tryPlace(type, {}, { front: 600, side: 220 }, (it) => {
      const faces = frontFacing(it);
      let s = 0;
      if (opt.vaasthuWc && (faces === 'N' || faces === 'S')) s += 5000;
      if (doorSide && faces === opposite(doorSide)) s -= 800; // directly facing the door
      return s + far(it) * 0.3;
    });
    if (!wc) {
      wc = tryPlace(type, {}, { front: 450, side: 150 }, (it) => far(it));
      if (wc) notes.push({ level: 'warning', text: 'The toilet only fits with tight clearances; consider a larger bathroom.', ids: [wc.id] });
    }
    if (wc) items.push(wc);
    else notes.push({ level: 'warning', text: 'The toilet does not fit with the doors and other fittings. Make the room larger or move the door.', ids: [] });
  }

  // 3. Basin near the door with a mirror above it.
  if (opt.basin) {
    const basin = tryPlace('washbasin', {}, { front: 500, side: 100 }, (it) => -far(it));
    if (basin) {
      items.push(basin);
      const m = createItem('mirror', 0, 0, basin.rotation);
      const side = opposite(frontFacing(basin));
      const along = side === 'N' || side === 'S' ? basin.x - room.x : basin.y - room.y;
      const p = placeAgainst(room, side, along, m.d);
      items.push({ ...m, x: p.x, y: p.y });
    } else notes.push({ level: 'info', text: 'No room for a washbasin inside; place one outside the bathroom.', ids: [] });
  }

  // 4. Exhaust fan high on the wall farthest from the door, preferring an exterior wall.
  if (opt.exhaust) {
    const ext = SIDES.filter((s) => {
      const wallsOnSide = floor.walls.filter((w) => {
        const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
        if (s === 'N') return Math.abs(mid.y - room.y) < 30 && Math.abs(w.a.y - w.b.y) < 30;
        if (s === 'S') return Math.abs(mid.y - room.y - room.d) < 30 && Math.abs(w.a.y - w.b.y) < 30;
        if (s === 'W') return Math.abs(mid.x - room.x) < 30 && Math.abs(w.a.x - w.b.x) < 30;
        return Math.abs(mid.x - room.x - room.w) < 30 && Math.abs(w.a.x - w.b.x) < 30;
      });
      return wallsOnSide.some((w) => w.kind === 'exterior');
    });
    const pref = [...SIDES].sort((a, b) => (ext.includes(b) ? 1 : 0) - (ext.includes(a) ? 1 : 0) || (a === doorSide ? 1 : 0) - (b === doorSide ? 1 : 0));
    const side = pref.find((s) => s !== doorSide) ?? pref[0];
    const len = sideLength(room, side);
    const win = windows.find((w) => w.side === side);
    const along = win ? Math.min(len - INSET - 200, win.to + 300) : len / 2;
    const fan = createItem('exhaust_fan', 0, 0, rotationAgainst(side));
    const p = placeAgainst(room, side, along, fan.d);
    items.push({ ...fan, x: p.x, y: p.y });
    if (!ext.includes(side) && floor.walls.length) notes.push({ level: 'info', text: 'No outside wall found for the exhaust fan — it will need a duct to the outside.', ids: [] });
  }

  notes.push(...bathroomChecks(floor, room, items));
  return { items, notes };
}

export function bathroomChecks(floor: Floor, room: Room, itemsArg?: Item[]): DesignNote[] {
  const items = itemsArg ?? itemsInRoom(floor, room);
  const notes: DesignNote[] = [];
  const box = inner(room);
  const wcs = items.filter((i) => i.type === 'wc_western' || i.type === 'wc_indian');
  const others = items.filter((i) => !catalogEntry(i.type).tags?.includes('wall-unit') && i.type !== 'floor_drain');
  for (const wc of wcs) {
    const b = itemBounds(wc);
    const f = frontFacing(wc);
    // centre to nearest side obstruction, measured across the toilet
    const across = f === 'N' || f === 'S';
    const centre = across ? wc.x : wc.y;
    let left = across ? centre - box.x : centre - box.y;
    let right = across ? box.x + box.w - centre : box.y + box.d - centre;
    for (const o of others.filter((x) => x.id !== wc.id)) {
      const ob = itemBounds(o);
      const overlapsBand = across ? ob.y < b.y + b.d && ob.y + ob.d > b.y : ob.x < b.x + b.w && ob.x + ob.w > b.x;
      if (!overlapsBand) continue;
      if (across) {
        if (ob.x + ob.w <= centre) left = Math.min(left, centre - (ob.x + ob.w));
        if (ob.x >= centre) right = Math.min(right, ob.x - centre);
      } else {
        if (ob.y + ob.d <= centre) left = Math.min(left, centre - (ob.y + ob.d));
        if (ob.y >= centre) right = Math.min(right, ob.y - centre);
      }
    }
    const side = Math.min(left, right);
    if (side < 380)
      notes.push({ level: 'warning', text: `Toilet centre is about ${Math.round(side)} mm from the nearest wall or fitting. About 380 mm is a common minimum (450 mm is more comfortable).`, ids: [wc.id] });
    const zone = frontZone(wc, 530);
    const front = inside(zone, box) && !others.some((o) => o.id !== wc.id && o.type !== 'shower' && rectOverlapArea(zone, itemBounds(o)) > 100);
    if (!front) notes.push({ level: 'warning', text: 'Less than about 530 mm of clear floor in front of the toilet (760 mm is commonly recommended).', ids: [wc.id] });
    const userFaces = f; // a seated user faces the toilet's front
    notes.push({
      level: userFaces === 'N' || userFaces === 'S' ? 'ok' : 'info',
      text:
        userFaces === 'N' || userFaces === 'S'
          ? `Vaasthu: the user faces ${SIDE_WORD[userFaces]} on the toilet, as Vaasthu texts commonly advise.`
          : `Vaasthu: the user faces ${SIDE_WORD[userFaces]} on the toilet. Vaasthu texts commonly advise facing north or south (traditions differ). Turn it with R if the room allows.`,
      ids: userFaces === 'N' || userFaces === 'S' ? [] : [wc.id],
    });
  }

  const hasWindow = roomOpenings(floor, room).some((o) => o.opening.type === 'window');
  const hasFan = items.some((i) => i.type === 'exhaust_fan');
  if (!hasWindow && !hasFan) notes.push({ level: 'warning', text: 'No window or exhaust fan: a bathroom needs ventilation to the outside.', ids: [] });
  else if (!hasWindow) notes.push({ level: 'info', text: 'Ventilation is by exhaust fan only. A small ventilator window as well is common practice.', ids: [] });

  const wet = items.filter((i) => i.type === 'shower' || i.type === 'bathtub');
  if (wet.length && !items.some((i) => i.type === 'floor_drain')) notes.push({ level: 'warning', text: 'Add a floor drain in the bathing area and slope the floor towards it.', ids: wet.map((w) => w.id) });
  if (wet.length || wcs.length)
    notes.push({
      level: 'info',
      text: 'Waterproofing: treat the whole bathroom floor and turn it up the walls, higher in the shower area. Ask your contractor for the system and heights they use.',
      ids: [],
    });
  notes.push(...doorConflicts(floor, room, items));
  return notes;
}

export function isBathroomItem(it: Item): boolean {
  return BATHROOM_TYPES.has(it.type);
}
