import { produce } from 'immer';
import { boundingBox, pointAlongWall, rectOverlapArea, wallLength, zoneOf, type Rect } from '../model/geometry';
import { SITE_ROOM_TYPES } from '../model/footprint';
import { roomGetsWalls } from '../model/wallBuilder';
import type { Floor, Opening, Point, Project, Room, RoomType, Wall, ZoneId, ZoneRating } from '../model/types';
import { CENTRE_AVOID, PLOT_GRID_TARGETS, RULE_TEXT, ruleTargetFor, ZONE_IDS, type RuleTarget } from './rules';

export const RATING_POINTS: Record<ZoneRating, number> = { preferred: 1, acceptable: 0.6, neutral: 0.4, avoid: 0 };

export interface VaasthuItem {
  key: string;
  target: RuleTarget;
  /** The room or opening judged, with its floor. */
  elementId: string;
  elementKind: 'room' | 'opening';
  floorId: string;
  name: string;
  zone: ZoneId;
  rating: ZoneRating;
  weight: number;
  preferredZones: ZoneId[];
  acceptableZones: ZoneId[];
  /** True when judged on the plot grid rather than the house grid. */
  onPlot: boolean;
}

export interface CentreIssue {
  elementId: string;
  floorId: string;
  name: string;
}

export interface VaasthuReport {
  houseGrid: Rect;
  plotGrid: Rect;
  /** How the house grid was found. */
  houseGridSource: 'outline' | 'rooms' | 'plot';
  items: VaasthuItem[];
  centreIssues: CentreIssue[];
  /** Advisory score 0–100 (null when nothing could be judged). */
  score: number | null;
  entrance: { opening: Opening; floorId: string; point: Point; guessed: boolean } | null;
}

/** Grid the house is judged on: the house outline, else the extent of the building rooms, else the plot. */
export function houseGrid(project: Project): { rect: Rect; source: VaasthuReport['houseGridSource'] } {
  if (project.footprint) return { rect: project.footprint, source: 'outline' };
  const ground = [...project.floors].sort((a, b) => a.level - b.level)[0];
  const rooms = (ground?.rooms ?? []).filter((r) => roomGetsWalls(r) || r.type === 'staircase');
  if (rooms.length) {
    return {
      rect: boundingBox(rooms.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.d }])),
      source: 'rooms',
    };
  }
  return { rect: boundingBox(project.plot.boundary), source: 'plot' };
}

/**
 * The main entrance: a ground-floor door marked as main; otherwise a door labelled "MD…";
 * otherwise the first door in an exterior wall (reported as guessed).
 */
export function mainEntrance(project: Project): VaasthuReport['entrance'] {
  const ground = [...project.floors].sort((a, b) => a.level - b.level)[0];
  if (!ground) return null;
  const doors = ground.openings.filter((o) => o.type === 'door');
  const withWall = (o: Opening) => ({ o, w: ground.walls.find((w) => w.id === o.wallId) });
  const pick =
    doors.map(withWall).find((x) => x.o.isMain && x.w) ??
    doors.map(withWall).find((x) => /^MD\b/i.test(x.o.label) && x.w);
  const guess = pick ? null : doors.map(withWall).find((x) => x.w?.kind === 'exterior');
  const chosen = pick ?? guess;
  if (!chosen || !chosen.w) return null;
  return { opening: chosen.o, floorId: ground.id, point: pointAlongWall(chosen.w as Wall, chosen.o.offsetMm), guessed: !pick };
}

function centreCell(grid: Rect): Rect {
  return { x: grid.x + grid.w / 3, y: grid.y + grid.d / 3, w: grid.w / 3, d: grid.d / 3 };
}

export function evaluate(project: Project): VaasthuReport {
  const { rect: hg, source } = houseGrid(project);
  const pg = boundingBox(project.plot.boundary);
  const rules = new Map(project.vaasthu.rules.filter((r) => r.enabled).map((r) => [r.target, r]));
  const items: VaasthuItem[] = [];
  const centreIssues: CentreIssue[] = [];

  const judge = (target: RuleTarget, p: Point, base: Omit<VaasthuItem, 'zone' | 'rating' | 'weight' | 'preferredZones' | 'acceptableZones' | 'onPlot' | 'target' | 'key'>) => {
    const rule = rules.get(target);
    if (!rule) return;
    const onPlot = PLOT_GRID_TARGETS.includes(target);
    const zone = zoneOf(p, onPlot ? pg : hg) as ZoneId;
    items.push({
      ...base,
      key: `${base.elementKind}:${base.elementId}`,
      target,
      zone,
      rating: rule.zones[zone],
      weight: rule.weight,
      preferredZones: ZONE_IDS.filter((z) => rule.zones[z] === 'preferred'),
      acceptableZones: ZONE_IDS.filter((z) => rule.zones[z] === 'acceptable'),
      onPlot,
    });
  };

  const entrance = mainEntrance(project);
  if (entrance) {
    judge('entrance', entrance.point, {
      elementId: entrance.opening.id,
      elementKind: 'opening',
      floorId: entrance.floorId,
      name: entrance.opening.label || 'Main door',
    });
  }

  const centre = centreCell(hg);
  for (const floor of project.floors) {
    for (const r of floor.rooms) {
      const target = ruleTargetFor(r.type);
      if (target) {
        judge(target, { x: r.x + r.w / 2, y: r.y + r.d / 2 }, { elementId: r.id, elementKind: 'room', floorId: floor.id, name: r.name });
      }
      if (project.vaasthu.keepCentreOpen && CENTRE_AVOID.includes(r.type) && !SITE_ROOM_TYPES.includes(r.type)) {
        const ov = rectOverlapArea(r, centre);
        if (ov > 0.25 * Math.min(r.w * r.d, centre.w * centre.d)) centreIssues.push({ elementId: r.id, floorId: floor.id, name: r.name });
      }
    }
  }

  const totalWeight = items.reduce((s, i) => s + i.weight, 0) + centreIssues.length;
  const points = items.reduce((s, i) => s + i.weight * RATING_POINTS[i.rating], 0);
  return {
    houseGrid: hg,
    plotGrid: pg,
    houseGridSource: source,
    items,
    centreIssues,
    score: totalWeight > 0 ? Math.round((points / totalWeight) * 100) : null,
    entrance,
  };
}

// ---------------------------------------------------------------------------------------------
// Alternative placements: swapping what two similar-sized rooms are used for.
// ---------------------------------------------------------------------------------------------

/** Room uses that can be exchanged between rectangles of similar size. */
const SWAPPABLE: RoomType[] = [
  'living',
  'dining',
  'kitchen',
  'store',
  'bedroom',
  'master_bedroom',
  'bathroom',
  'toilet',
  'pooja',
  'utility',
  'study',
];

export interface SwapSuggestion {
  floorId: string;
  a: { id: string; name: string };
  b: { id: string; name: string };
  /** Change in the advisory score (percentage points). */
  delta: number;
}

function compatible(a: Room, b: Room): boolean {
  if (a.type === b.type) return false;
  if (!SWAPPABLE.includes(a.type) || !SWAPPABLE.includes(b.type)) return false;
  const areaA = a.w * a.d;
  const areaB = b.w * b.d;
  const ratio = areaA / areaB;
  if (ratio < 0.6 || ratio > 1 / 0.6) return false;
  // Both rooms must still be usable: shortest side of each within 70% of the other's.
  const minA = Math.min(a.w, a.d);
  const minB = Math.min(b.w, b.d);
  return Math.min(minA, minB) / Math.max(minA, minB) >= 0.7;
}

/** Exchange the use (name, type, finishes) of two rooms, keeping their geometry. */
export function swapRoomUse(floor: Floor | import('immer').Draft<Floor>, aId: string, bId: string): void {
  const a = floor.rooms.find((r) => r.id === aId);
  const b = floor.rooms.find((r) => r.id === bId);
  if (!a || !b) return;
  [a.name, b.name] = [b.name, a.name];
  [a.type, b.type] = [b.type, a.type];
  [a.floorFinish, b.floorFinish] = [b.floorFinish, a.floorFinish];
}

export function applySwap(project: Project, s: { floorId: string; a: { id: string }; b: { id: string } }): Project {
  return produce(project, (d) => {
    const f = d.floors.find((x) => x.id === s.floorId);
    if (f) swapRoomUse(f, s.a.id, s.b.id);
  });
}

/** Single swaps that raise the advisory score, best first. */
export function suggestSwaps(project: Project, limit = 6): SwapSuggestion[] {
  const base = evaluate(project).score ?? 0;
  const out: SwapSuggestion[] = [];
  for (const floor of project.floors) {
    const rooms = floor.rooms.filter((r) => !r.locked);
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i];
        const b = rooms[j];
        if (!compatible(a, b)) continue;
        const swapped = applySwap(project, { floorId: floor.id, a, b });
        const score = evaluate(swapped).score ?? 0;
        if (score > base) out.push({ floorId: floor.id, a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name }, delta: score - base });
      }
    }
  }
  return out.sort((x, y) => y.delta - x.delta).slice(0, limit);
}

/**
 * A suggested alternative layout: apply the best swap repeatedly (each room moves at most once)
 * until nothing improves. Returns the swaps and the score change; nothing is applied.
 */
export function suggestLayout(project: Project, maxSwaps = 6): { swaps: SwapSuggestion[]; from: number; to: number } {
  const from = evaluate(project).score ?? 0;
  let current = project;
  const swaps: SwapSuggestion[] = [];
  const used = new Set<string>();
  for (let n = 0; n < maxSwaps; n++) {
    const next = suggestSwaps(current, 50).find((s) => !used.has(s.a.id) && !used.has(s.b.id));
    if (!next) break;
    swaps.push(next);
    used.add(next.a.id).add(next.b.id);
    current = applySwap(current, next);
  }
  return { swaps, from, to: evaluate(current).score ?? 0 };
}

export function ruleLabel(target: RuleTarget, lang: 'en' | 'ta' = 'en'): string {
  return RULE_TEXT[target]?.label[lang] ?? target;
}

/** Point on the plan where an item sits (for drawing markers). */
export function itemPoint(project: Project, item: VaasthuItem): Point | null {
  const floor = project.floors.find((f) => f.id === item.floorId);
  if (!floor) return null;
  if (item.elementKind === 'room') {
    const r = floor.rooms.find((x) => x.id === item.elementId);
    return r ? { x: r.x + r.w / 2, y: r.y + r.d / 2 } : null;
  }
  const o = floor.openings.find((x) => x.id === item.elementId);
  const w = o && floor.walls.find((x) => x.id === o.wallId);
  return o && w ? pointAlongWall(w, Math.min(o.offsetMm, wallLength(w))) : null;
}
