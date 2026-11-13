/**
 * Kitchen layout generator and checks.
 *
 * The rules of thumb used here are common planning guidance, not regulations:
 *  - Work triangle (fridge – sink – hob, measured between the front centres): total about 4.0–7.9 m,
 *    each leg about 1.2–2.7 m (the widely quoted NKBA guideline, 26 ft total, 4–9 ft per leg).
 *  - Aisle between facing counters: about 1.0 m or more for one cook (NKBA quotes 42 in ≈ 1.07 m).
 *  - Keep at least about 300–600 mm of counter between the sink and the hob.
 *  - Vaasthu texts commonly place cooking in the south-east with the cook facing east.
 * Treat the output as a starting point; confirm sizes with your kitchen maker.
 */
import { catalogEntry, createItem, itemFront } from '../model/catalog';
import type { Floor, Item, Room, Side } from '../model/types';
import {
  distance,
  doorConflicts,
  INSET,
  itemsInRoom,
  placeAgainst,
  roomOpenings,
  rotationAgainst,
  sideLength,
  userFacing,
  type DesignNote,
  type RoomOpening,
} from './common';

export type KitchenLayout = 'straight' | 'L' | 'U' | 'parallel' | 'island';

export const KITCHEN_LAYOUTS: { id: KitchenLayout; label: string }[] = [
  { id: 'straight', label: 'Straight (one wall)' },
  { id: 'L', label: 'L-shaped' },
  { id: 'U', label: 'U-shaped' },
  { id: 'parallel', label: 'Parallel (two facing walls)' },
  { id: 'island', label: 'With island' },
];

export interface KitchenOptions {
  layout: KitchenLayout;
  fridge: boolean;
  chimney: boolean;
  wallCabinets: boolean;
  dishwasher: boolean;
  cabinetColor: string;
  counterColor: string;
}

export const DEFAULT_KITCHEN: KitchenOptions = {
  layout: 'L',
  fridge: true,
  chimney: true,
  wallCabinets: true,
  dishwasher: false,
  cabinetColor: '#d9d4c7',
  counterColor: '#2f2f31',
};

export const COUNTER_COLORS = [
  { value: '#2f2f31', label: 'Black granite' },
  { value: '#7d6b5d', label: 'Brown granite' },
  { value: '#e8e4dc', label: 'White quartz' },
  { value: '#9a9a96', label: 'Grey stone' },
  { value: '#5c5048', label: 'Tan brown granite' },
];

export const CABINET_COLORS = [
  { value: '#d9d4c7', label: 'Ivory' },
  { value: '#f2f2f0', label: 'White' },
  { value: '#7a5d44', label: 'Walnut wood' },
  { value: '#a37b55', label: 'Teak wood' },
  { value: '#4b5d4f', label: 'Sage green' },
  { value: '#2e3a52', label: 'Navy blue' },
  { value: '#8a8d92', label: 'Grey' },
];

const COUNTER_D = 600;
const SIDES: Side[] = ['N', 'E', 'S', 'W'];
/** Sides that meet `side` at its start and end corners. */
const ENDS: Record<Side, [Side, Side]> = { N: ['W', 'E'], S: ['W', 'E'], E: ['N', 'S'], W: ['N', 'S'] };

export const KITCHEN_TYPES = new Set(['base_cabinet', 'sink_unit', 'hob', 'chimney', 'wall_cabinet', 'fridge', 'dishwasher', 'tall_unit', 'island']);

interface Seg {
  side: Side;
  from: number;
  to: number;
  used: [number, number][];
}

function freeIntervals(seg: Seg): [number, number][] {
  const used = [...seg.used].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = seg.from;
  for (const [a, b] of used) {
    if (a > cur) out.push([cur, Math.min(a, seg.to)]);
    cur = Math.max(cur, b);
  }
  if (cur < seg.to) out.push([cur, seg.to]);
  return out.filter(([a, b]) => b - a > 1);
}

/** Usable counter runs along each side, after corners owned by earlier sides and doors. */
function runsFor(floor: Floor, room: Room, sides: Side[]): Seg[] {
  const ops = roomOpenings(floor, room);
  const segs: Seg[] = [];
  sides.forEach((side, i) => {
    const len = sideLength(room, side);
    let from = INSET;
    let to = len - INSET;
    const [startSide, endSide] = ENDS[side];
    if (sides.slice(0, i).includes(startSide)) from += COUNTER_D;
    if (sides.slice(0, i).includes(endSide)) to -= COUNTER_D;
    // Keep each doorway and the floor just inside it clear — this also stops a counter on a
    // neighbouring wall from running across a door near a corner.
    const band =
      side === 'N'
        ? { x: room.x, y: room.y, w: room.w, d: INSET + COUNTER_D }
        : side === 'S'
          ? { x: room.x, y: room.y + room.d - INSET - COUNTER_D, w: room.w, d: INSET + COUNTER_D }
          : side === 'W'
            ? { x: room.x, y: room.y, w: INSET + COUNTER_D, d: room.d }
            : { x: room.x + room.w - INSET - COUNTER_D, y: room.y, w: INSET + COUNTER_D, d: room.d };
    let pieces: [number, number][] = [[from, to]];
    for (const o of ops.filter((x) => x.opening.type === 'door')) {
      const z = doorZone(room, o);
      const ix = Math.max(band.x, z.x);
      const iy = Math.max(band.y, z.y);
      const ax = Math.min(band.x + band.w, z.x + z.w);
      const ay = Math.min(band.y + band.d, z.y + z.d);
      if (ax <= ix || ay <= iy) continue;
      const a = side === 'N' || side === 'S' ? ix - room.x : iy - room.y;
      const b = side === 'N' || side === 'S' ? ax - room.x : ay - room.y;
      pieces = pieces.flatMap(([p, q]) => {
        if (b <= p || a >= q) return [[p, q]] as [number, number][];
        const out: [number, number][] = [];
        if (a > p) out.push([p, a]);
        if (b < q) out.push([b, q]);
        return out;
      });
    }
    for (const [p, q] of pieces) if (q - p >= 300) segs.push({ side, from: p, to: q, used: [] });
  });
  return segs;
}

/** Floor area just inside a door that must stay clear: as wide as the door + 50 mm each side, as deep as the leaf. */
function doorZone(room: Room, o: RoomOpening) {
  const depth = Math.max(o.opening.widthMm, 750);
  const a = o.from - 50;
  const b = o.to + 50;
  switch (o.side) {
    case 'N':
      return { x: room.x + a, y: room.y - 200, w: b - a, d: depth + 200 };
    case 'S':
      return { x: room.x + a, y: room.y + room.d - depth, w: b - a, d: depth + 200 };
    case 'W':
      return { x: room.x - 200, y: room.y + a, w: depth + 200, d: b - a };
    case 'E':
      return { x: room.x + room.w - depth, y: room.y + a, w: depth + 200, d: b - a };
  }
}

function usableLength(floor: Floor, room: Room, sides: Side[]): number {
  return runsFor(floor, room, sides).reduce((s, g) => s + g.to - g.from, 0);
}

/** Pick the walls for a layout. Sides holding the room's doors are avoided where possible. */
export function chooseSides(floor: Floor, room: Room, layout: KitchenLayout): Side[] {
  const score = (sides: Side[]) => usableLength(floor, room, sides) + (sides.includes('E') ? 400 : 0);
  const best = (cands: Side[][]) => cands.sort((a, b) => score(b) - score(a))[0];
  const adjacent: Side[][] = [
    ['N', 'E'],
    ['E', 'S'],
    ['S', 'W'],
    ['W', 'N'],
  ];
  switch (layout) {
    case 'straight':
      return best(SIDES.map((s) => [s]));
    case 'L':
    case 'island': {
      // Longer side first so it owns the corner.
      const pair = best(adjacent.map((p) => [...p]));
      return pair.sort((a, b) => sideLength(room, b) - sideLength(room, a));
    }
    case 'U': {
      const cands = SIDES.map((mid) => {
        const [a, b] = ENDS[mid];
        return [mid, a, b] as Side[];
      });
      return best(cands);
    }
    case 'parallel':
      return best([
        ['N', 'S'],
        ['E', 'W'],
      ]);
  }
}

function place(segs: Seg[], segIdx: number, width: number, centre: number): number | null {
  const seg = segs[segIdx];
  let best: number | null = null;
  for (const [a, b] of freeIntervals(seg)) {
    if (b - a < width - 1) continue;
    const c = Math.min(Math.max(centre, a + width / 2), b - width / 2);
    if (best === null || Math.abs(c - centre) < Math.abs(best - centre)) best = c;
  }
  if (best !== null) seg.used.push([best - width / 2, best + width / 2]);
  return best;
}

export interface KitchenResult {
  items: Item[];
  sides: Side[];
  notes: DesignNote[];
}

export function generateKitchen(floor: Floor, room: Room, opt: KitchenOptions): KitchenResult {
  const notes: DesignNote[] = [];
  const sides = chooseSides(floor, room, opt.layout);
  const segs = runsFor(floor, room, sides);
  const items: Item[] = [];
  const ops = roomOpenings(floor, room);
  const windows = ops.filter((o) => o.opening.type === 'window');
  const door = ops.find((o) => o.opening.type === 'door');

  if (segs.length === 0) {
    notes.push({ level: 'warning', text: 'There is no free wall long enough for a counter (doors take up the walls). Make the room larger or move a door.', ids: [] });
    return { items, sides, notes };
  }

  const make = (type: string, seg: Seg, along: number, w?: number): Item => {
    const c = catalogEntry(type);
    const depth = c.d;
    const p = placeAgainst(room, seg.side, along, depth);
    const it = createItem(type, p.x, p.y, rotationAgainst(seg.side), w ? { w } : {});
    if (['base_cabinet', 'sink_unit', 'hob', 'dishwasher', 'tall_unit', 'wall_cabinet', 'island'].includes(type)) it.color = opt.cabinetColor;
    if (c.tags?.includes('counter')) it.topColor = opt.counterColor;
    return it;
  };
  const segLen = (g: Seg) => g.to - g.from;
  const byLength = segs.map((_, i) => i).sort((a, b) => segLen(segs[b]) - segLen(segs[a]));

  // Hob: prefer the east wall towards its south end (south-east, cook faces east), then south, north, west.
  const hobPref: Side[] = ['E', 'S', 'N', 'W'];
  const hobW = catalogEntry('hob').w;
  let hob: Item | null = null;
  let hobSeg = -1;
  // Scan every free position on every run; never under a window, then by side preference,
  // then towards the run's south (E/W walls) or east (N/S walls) end, keeping ~300 mm of counter beside it.
  let bestHob: { i: number; at: number; score: number } | null = null;
  segs.forEach((g, i) => {
    const pref = hobPref.indexOf(g.side);
    for (const [a, b] of freeIntervals(g)) {
      for (let at = a + hobW / 2; at <= b - hobW / 2 + 1; at += 50) {
        const underWin = windows.some((w) => w.side === g.side && at + hobW / 2 > w.from - 50 && at - hobW / 2 < w.to + 50);
        const endBias = (at - g.from) / Math.max(1, g.to - g.from); // 0 = start, 1 = end
        const nearEnd = Math.abs(g.to - (at + hobW / 2) - 300) < 200 ? 0.3 : 0;
        const score = (underWin ? -100 : 0) - pref * 10 + endBias + nearEnd;
        if (!bestHob || score > bestHob.score) bestHob = { i, at, score };
      }
    }
  });
  if (bestHob) {
    const { i, at } = bestHob as { i: number; at: number; score: number };
    segs[i].used.push([at - hobW / 2, at + hobW / 2]);
    hob = make('hob', segs[i], at);
    hobSeg = i;
  }
  if (hob) items.push(hob);

  // Sink: under a window when possible, otherwise on another run or well away from the hob.
  const sinkW = catalogEntry('sink_unit').w;
  let sink: Item | null = null;
  for (const w of [...windows].sort((a, b) => (a.side === 'N' || a.side === 'E' ? -1 : 0) - (b.side === 'N' || b.side === 'E' ? -1 : 0))) {
    const i = segs.findIndex((g) => g.side === w.side && (w.from + w.to) / 2 > g.from && (w.from + w.to) / 2 < g.to);
    if (i < 0) continue;
    const at = place(segs, i, sinkW, (w.from + w.to) / 2);
    if (at !== null) {
      sink = make('sink_unit', segs[i], at);
      break;
    }
  }
  if (!sink) {
    const order = byLength.filter((i) => i !== hobSeg).concat(hobSeg >= 0 ? [hobSeg] : []);
    for (const i of order) {
      const g = segs[i];
      // On the hob's run, keep at least ~600 mm of counter between them.
      let target = (g.from + g.to) / 2;
      if (i === hobSeg && hob) {
        const hobAlong = g.side === 'N' || g.side === 'S' ? hob.x - room.x : hob.y - room.y;
        target = hobAlong > (g.from + g.to) / 2 ? g.from + sinkW / 2 : g.to - sinkW / 2;
        if (Math.abs(target - hobAlong) < (hobW + sinkW) / 2 + 600) continue;
      }
      const at = place(segs, i, sinkW, target);
      if (at !== null) {
        sink = make('sink_unit', g, at);
        break;
      }
    }
  }
  if (sink) items.push(sink);

  // Fridge: at the end of a run nearest the door (so it can be reached without crossing the cook).
  if (opt.fridge) {
    const fw = catalogEntry('fridge').w;
    const doorPt = door?.centre ?? { x: room.x, y: room.y };
    const ends = segs.flatMap((g, i) => [
      { i, along: g.from + fw / 2 },
      { i, along: g.to - fw / 2 },
    ]);
    ends.sort((a, b) => {
      const pa = placeAgainst(room, segs[a.i].side, a.along, 0);
      const pb = placeAgainst(room, segs[b.i].side, b.along, 0);
      return distance(pa, doorPt) - distance(pb, doorPt);
    });
    let placed = false;
    for (const e of ends) {
      const g = segs[e.i];
      const free = freeIntervals(g).find(([a, b]) => e.along - fw / 2 >= a - 1 && e.along + fw / 2 <= b + 1);
      if (!free) continue;
      g.used.push([e.along - fw / 2, e.along + fw / 2]);
      items.push(make('fridge', g, e.along));
      placed = true;
      break;
    }
    if (!placed) notes.push({ level: 'info', text: 'No room for the refrigerator on the counters; place it nearby (for example in the dining area).', ids: [] });
  }

  if (opt.dishwasher && sink) {
    const i = segs.findIndex((g) => g.side === userFacing(sink!));
    const g = segs[i];
    const along = g.side === 'N' || g.side === 'S' ? sink.x - room.x : sink.y - room.y;
    const at = i >= 0 ? place(segs, i, 600, along + sinkW / 2 + 300) : null;
    if (at !== null) items.push(make('dishwasher', g, at));
  }

  // Fill the rest of every run with base cabinets (600 mm modules, the last one sized to fit).
  for (const g of segs) {
    for (const [a, b] of freeIntervals(g)) {
      let x = a;
      while (b - x >= 150) {
        const w = b - x >= 900 ? 600 : b - x; // avoid leaving a sliver: last module 300–900
        items.push(make('base_cabinet', g, x + w / 2, Math.round(w)));
        x += w;
      }
    }
  }

  // Wall units: chimney over the hob; wall cabinets over the counters except over windows, the fridge and the hob.
  if (hob && opt.chimney) {
    const ch = createItem('chimney', 0, 0, hob.rotation);
    const side = segs[hobSeg].side;
    const along = side === 'N' || side === 'S' ? hob.x - room.x : hob.y - room.y;
    const p = placeAgainst(room, side, along, ch.d);
    items.push({ ...ch, x: p.x, y: p.y });
  }
  if (opt.wallCabinets) {
    for (const side of sides) {
      const blocked: [number, number][] = [];
      for (const w of windows.filter((x) => x.side === side)) blocked.push([w.from - 50, w.to + 50]);
      for (const d of ops.filter((x) => x.side === side && x.opening.type === 'door')) blocked.push([d.from - 50, d.to + 50]);
      for (const it of items.filter((x) => (x.type === 'hob' || x.type === 'fridge') && x.rotation === rotationAgainst(side))) {
        const along = side === 'N' || side === 'S' ? it.x - room.x : it.y - room.y;
        const half = it.type === 'hob' ? Math.max(it.w, opt.chimney ? 900 : 0) / 2 : it.w / 2;
        blocked.push([along - half, along + half]);
      }
      const runs = segs.filter((g) => g.side === side);
      for (const g of runs) {
        const seg: Seg = { side, from: g.from, to: g.to, used: blocked };
        for (const [a, b] of freeIntervals(seg)) {
          let x = a;
          while (b - x >= 300) {
            const w = b - x >= 900 ? 600 : b - x;
            const wc = createItem('wall_cabinet', 0, 0, rotationAgainst(side), { w: Math.round(w), color: opt.cabinetColor });
            const p = placeAgainst(room, side, x + w / 2, wc.d);
            items.push({ ...wc, x: p.x, y: p.y });
            x += w;
          }
        }
      }
    }
  }

  // Island: in the free middle of the room if there is space for ~1 m aisles all round.
  if (opt.layout === 'island') {
    const inner = { x: room.x + INSET, y: room.y + INSET, w: room.w - 2 * INSET, d: room.d - 2 * INSET };
    for (const s of sides) {
      if (s === 'N') (inner.y += COUNTER_D), (inner.d -= COUNTER_D);
      if (s === 'S') inner.d -= COUNTER_D;
      if (s === 'W') (inner.x += COUNTER_D), (inner.w -= COUNTER_D);
      if (s === 'E') inner.w -= COUNTER_D;
    }
    const aisle = 1000;
    const longX = inner.w >= inner.d;
    const along = (longX ? inner.w : inner.d) - 2 * aisle;
    const across = (longX ? inner.d : inner.w) - 2 * aisle;
    const iw = Math.min(1800, Math.floor(along / 50) * 50);
    const id = Math.min(900, Math.floor(across / 50) * 50);
    if (iw >= 1200 && id >= 600) {
      items.push(
        createItem('island', inner.x + inner.w / 2, inner.y + inner.d / 2, longX ? 0 : 90, { w: iw, d: id, color: opt.cabinetColor, topColor: opt.counterColor }),
      );
    } else {
      notes.push({ level: 'warning', text: 'The room is too small for an island with about 1 m walkways around it, so no island was added. An L-shaped layout fits better.', ids: [] });
    }
  }

  notes.push(...kitchenChecks(floor, room, items));
  return { items, sides, notes };
}

/** The wall an item stands against (a person working at it faces that wall). */
function sideOfItem(it: Item): Side {
  return userFacing(it);
}

/** Checks that run on whatever kitchen items are in the room (generated or placed by hand). */
export function kitchenChecks(floor: Floor, room: Room, itemsArg?: Item[]): DesignNote[] {
  const items = itemsArg ?? itemsInRoom(floor, room);
  const notes: DesignNote[] = [];
  const of = (t: string) => items.filter((i) => i.type === t);
  const hob = of('hob')[0];
  const sink = of('sink_unit')[0];
  const fridge = of('fridge')[0];
  const windows = roomOpenings(floor, room).filter((o) => o.opening.type === 'window');

  if (!hob) notes.push({ level: 'info', text: 'No hob / stove counter in this kitchen yet.', ids: [] });
  if (!sink) notes.push({ level: 'info', text: 'No sink in this kitchen yet.', ids: [] });

  if (hob && sink && fridge) {
    const pts = [itemFront(fridge, 0), itemFront(sink, 0), itemFront(hob, 0)];
    const legs = [distance(pts[0], pts[1]), distance(pts[1], pts[2]), distance(pts[2], pts[0])];
    const total = legs[0] + legs[1] + legs[2];
    const m = (v: number) => (v / 1000).toFixed(1);
    const bad = total > 7900 || legs.some((l) => l < 1200 || l > 2700);
    notes.push({
      level: bad ? 'warning' : 'ok',
      text: `Work triangle (fridge–sink–hob): ${m(total)} m in total, legs ${legs.map(m).join(' / ')} m. Common guideline: about 4.0–7.9 m in total, each leg about 1.2–2.7 m.`,
      ids: bad ? [hob.id, sink.id, fridge.id] : [],
    });
  }
  if (hob && sink) {
    const gap = Math.hypot(hob.x - sink.x, hob.y - sink.y) - (hob.w + sink.w) / 2;
    if (hob.rotation === sink.rotation && gap < 300)
      notes.push({ level: 'warning', text: 'The sink and hob are very close. Keep at least about 300–600 mm of counter between them so water does not splash onto the flame.', ids: [hob.id, sink.id] });
  }
  if (hob) {
    const side = sideOfItem(hob);
    const along = side === 'N' || side === 'S' ? hob.x - room.x : hob.y - room.y;
    const under = windows.find((w) => w.side === side && along + hob.w / 2 > w.from && along - hob.w / 2 < w.to);
    if (under)
      notes.push({ level: 'warning', text: 'The hob is under a window. Wind can blow out or push the flame and curtains can catch fire — move it beside the window.', ids: [hob.id] });
    const facing = userFacing(hob);
    notes.push({
      level: facing === 'E' ? 'ok' : 'info',
      text:
        facing === 'E'
          ? 'Vaasthu: the cook faces east at the hob, as Vaasthu texts commonly recommend.'
          : `Vaasthu: the cook faces ${{ N: 'north', S: 'south', W: 'west', E: 'east' }[facing]} at the hob. Vaasthu texts commonly recommend facing east while cooking (traditions differ).`,
      ids: facing === 'E' ? [] : [hob.id],
    });
  }

  // Aisle between facing counters (parallel / U).
  const counters = items.filter((i) => catalogEntry(i.type).tags?.includes('counter') || i.type === 'fridge' || i.type === 'tall_unit');
  const sidesWith = new Set(counters.filter((c) => c.type !== 'island').map((c) => sideOfItem(c)));
  const aisleCheck = (a: Side, b: Side, len: number) => {
    if (sidesWith.has(a) && sidesWith.has(b)) {
      const aisle = len - 2 * INSET - 2 * COUNTER_D;
      if (aisle < 1000)
        notes.push({ level: 'warning', text: `Walkway between the facing counters is about ${(aisle / 1000).toFixed(2)} m. About 1.0–1.2 m is commonly recommended.`, ids: [] });
    }
  };
  aisleCheck('N', 'S', room.d);
  aisleCheck('E', 'W', room.w);
  const island = of('island')[0];
  if (island) {
    const half = { w: (island.rotation % 180 === 0 ? island.w : island.d) / 2, d: (island.rotation % 180 === 0 ? island.d : island.w) / 2 };
    const gaps = [
      island.x - half.w - (room.x + INSET + (sidesWith.has('W') ? COUNTER_D : 0)),
      room.x + room.w - INSET - (sidesWith.has('E') ? COUNTER_D : 0) - (island.x + half.w),
      island.y - half.d - (room.y + INSET + (sidesWith.has('N') ? COUNTER_D : 0)),
      room.y + room.d - INSET - (sidesWith.has('S') ? COUNTER_D : 0) - (island.y + half.d),
    ];
    const min = Math.min(...gaps);
    if (min < 900) notes.push({ level: 'warning', text: `The walkway around the island narrows to about ${(min / 1000).toFixed(2)} m. About 1.0 m is commonly recommended.`, ids: [island.id] });
  }

  if (!windows.length && !items.some((i) => i.type === 'chimney'))
    notes.push({ level: 'warning', text: 'The kitchen has no window and no chimney. Add a window or an exhaust/chimney for smoke and heat.', ids: [] });

  notes.push(...doorConflicts(floor, room, items));
  return notes;
}

export function isKitchenItem(it: Item): boolean {
  return KITCHEN_TYPES.has(it.type);
}
