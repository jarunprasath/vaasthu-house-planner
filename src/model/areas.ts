import { polygonArea, type Rect } from './geometry';
import { OUTDOOR_ROOM_TYPES } from './types';
import type { Floor, Project, Room, RoomType } from './types';

/** Area of the union of axis-aligned rectangles (mm²), by coordinate compression. */
export function unionArea(rects: Rect[]): number {
  if (rects.length === 0) return 0;
  const xs = Array.from(new Set(rects.flatMap((r) => [r.x, r.x + r.w]))).sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const width = x1 - x0;
    if (width <= 0) continue;
    const spans = rects
      .filter((r) => r.x <= x0 && r.x + r.w >= x1)
      .map((r) => [r.y, r.y + r.d] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let curStart = -Infinity;
    let curEnd = -Infinity;
    for (const [s, e] of spans) {
      if (s > curEnd) {
        if (curEnd > curStart) covered += curEnd - curStart;
        curStart = s;
        curEnd = e;
      } else curEnd = Math.max(curEnd, e);
    }
    if (curEnd > curStart) covered += curEnd - curStart;
    total += covered * width;
  }
  return total;
}

const SEPARATE_TYPES: RoomType[] = ['portico', 'staircase'];
/** Areas that do not count towards ground coverage (open to sky / landscaping). */
export const NON_COVERAGE_TYPES: RoomType[] = ['garden', 'pathway', 'courtyard', 'parking', 'terrace'];

export function isEnclosed(r: Room): boolean {
  return !OUTDOOR_ROOM_TYPES.includes(r.type) && !SEPARATE_TYPES.includes(r.type);
}

export interface FloorAreas {
  /** Enclosed rooms (to wall centre-lines), union so overlaps are not double counted. */
  enclosedMm2: number;
  /** Portico and staircase. */
  porticoStairMm2: number;
  /** Balconies, sit-outs, terraces, courtyards, parking, garden, pathways. */
  outdoorMm2: number;
  /** Footprint counted for ground coverage. */
  coverageMm2: number;
}

export function floorAreas(floor: Floor): FloorAreas {
  const enclosed = floor.rooms.filter(isEnclosed);
  const ps = floor.rooms.filter((r) => SEPARATE_TYPES.includes(r.type));
  const outdoor = floor.rooms.filter((r) => OUTDOOR_ROOM_TYPES.includes(r.type));
  const coverage = floor.rooms.filter((r) => !NON_COVERAGE_TYPES.includes(r.type));
  return {
    enclosedMm2: unionArea(enclosed),
    porticoStairMm2: unionArea(ps),
    outdoorMm2: unionArea(outdoor),
    coverageMm2: unionArea(coverage),
  };
}

export function plotArea(project: Project): number {
  return polygonArea(project.plot.boundary);
}

export function groundCoveragePercent(project: Project): number {
  const ground = project.floors.find((f) => f.level === 0);
  if (!ground) return 0;
  const pa = plotArea(project);
  return pa > 0 ? (floorAreas(ground).coverageMm2 / pa) * 100 : 0;
}

export function totalEnclosedArea(project: Project): number {
  return project.floors.reduce((s, f) => s + floorAreas(f).enclosedMm2, 0);
}
