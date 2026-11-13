import { createOpening, createRoom } from '../model/factory';
import { distanceToSegment, projectT, wallLength } from '../model/geometry';
import { ft } from '../model/units';
import type { Floor, Opening, OpeningType, Point, RoomType, Wall } from '../model/types';

/** Room from feet values. */
export function roomFt(type: RoomType, x: number, y: number, w: number, d: number, name?: string) {
  return createRoom(type, ft(x), ft(y), ft(w), ft(d), name);
}

/** Find the wall whose centre-line passes through point p (mm). */
export function wallAt(walls: Wall[], p: Point): Wall | undefined {
  return walls.find((w) => {
    if (distanceToSegment(p, w.a, w.b) > 1) return false;
    const t = projectT(p, w.a, w.b);
    return t > 0 && t < 1;
  });
}

/**
 * Create an opening centred at a world point given in feet. Throws if no wall passes through it,
 * so a broken template is caught by the unit tests rather than shipped.
 */
export function openingAtFt(
  walls: Wall[],
  type: OpeningType,
  xFt: number,
  yFt: number,
  widthFt: number,
  label: string,
  extra: Partial<Opening> = {},
): Opening {
  const p = { x: ft(xFt), y: ft(yFt) };
  const w = wallAt(walls, p);
  if (!w) throw new Error(`Template error: no wall at (${xFt}', ${yFt}') for ${label}`);
  const o = createOpening(type, w.id, projectT(p, w.a, w.b) * wallLength(w), label);
  o.widthMm = ft(widthFt);
  return { ...o, ...extra };
}

export function addOpenings(floor: Floor, openings: Opening[]): Floor {
  return { ...floor, openings: [...floor.openings, ...openings] };
}
