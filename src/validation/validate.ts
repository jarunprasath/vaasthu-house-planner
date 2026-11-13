import { groundCoveragePercent } from '../model/areas';
import { SIDE_NAMES } from '../model/factory';
import {
  distanceToSegment,
  edgeSide,
  EPS,
  pointAlongWall,
  pointInPolygon,
  pointInRect,
  rectCorners,
  rectOverlapArea,
  wallLength,
} from '../model/geometry';
import { formatLength } from '../model/units';
import { footprintInsidePlot, SITE_ROOM_TYPES } from '../model/footprint';
import { roomEdges, roomPolygon, roomRects } from '../model/roomShape';
import type { Floor, Project, Room, RoomType, Side } from '../model/types';

export type Severity = 'error' | 'warning' | 'info';
export type IssueCategory = 'plot' | 'regulation' | 'geometry' | 'access' | 'ventilation';

export interface Issue {
  id: string;
  severity: Severity;
  category: IssueCategory;
  message: string;
  floorId?: string;
  elementIds: string[];
}

/** Open, uncovered site elements that may sit inside setbacks. */
const SETBACK_ALLOWED: RoomType[] = ['garden', 'pathway', 'parking', 'courtyard', 'sump', 'septic_tank', 'borewell'];
/** Site elements that may overlap each other. */
const OVERLAP_ALLOWED: RoomType[] = ['garden', 'pathway', 'sump', 'septic_tank', 'borewell', 'terrace', 'overhead_tank'];
/** Rooms that are expected to have at least one door. */
/** Rooms expected to have a window or ventilator for daylight / ventilation. */
const NEEDS_WINDOW: RoomType[] = ['living', 'bedroom', 'master_bedroom', 'bathroom', 'toilet', 'kitchen'];
const NEEDS_DOOR: RoomType[] = [
  'bedroom',
  'master_bedroom',
  'bathroom',
  'toilet',
  'kitchen',
  'store',
  'pooja',
  'study',
  'utility',
];

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  const unit = project.settings.unit;
  const plot = project.plot;
  const boundary = plot.boundary;
  let n = 0;
  const add = (i: Omit<Issue, 'id'>) => issues.push({ ...i, id: `issue-${n++}` });

  if (boundary.length < 3) {
    add({ severity: 'error', category: 'plot', message: 'The plot boundary needs at least 3 points.', elementIds: [] });
    return issues;
  }

  const sortedFloors = [...project.floors].sort((a, b) => a.level - b.level);
  if (plot.maxFloors > 0 && sortedFloors.length > plot.maxFloors) {
    add({
      severity: 'warning',
      category: 'regulation',
      message: `${sortedFloors.length} floors exceed the configured limit of ${plot.maxFloors}.`,
      elementIds: [],
    });
  }
  const totalHeight = sortedFloors.reduce((s, f) => s + f.heightMm, 0);
  if (plot.maxHeightMm > 0 && totalHeight > plot.maxHeightMm + EPS) {
    add({
      severity: 'warning',
      category: 'regulation',
      message: `Total floor height ${formatLength(totalHeight, unit)} exceeds the configured maximum ${formatLength(plot.maxHeightMm, unit)}.`,
      elementIds: [],
    });
  }
  if (plot.maxCoveragePercent > 0) {
    const cov = groundCoveragePercent(project);
    if (cov > plot.maxCoveragePercent + 0.05) {
      add({
        severity: 'warning',
        category: 'regulation',
        message: `Ground coverage ${cov.toFixed(1)}% exceeds the configured maximum ${plot.maxCoveragePercent}%.`,
        elementIds: [],
      });
    }
  }

  const fp = project.footprint;
  if (fp) {
    if (!footprintInsidePlot(fp, boundary)) {
      add({ severity: 'error', category: 'plot', message: 'The house outline extends outside the plot.', elementIds: ['footprint'] });
    } else {
      const sides = setbackSidesViolated(project, rectCorners(fp));
      if (sides.length) {
        add({
          severity: 'warning',
          category: 'regulation',
          message: `The house outline is inside the ${sides.map((s) => SIDE_NAMES[s].toLowerCase()).join(' and ')} setback.`,
          elementIds: ['footprint'],
        });
      }
    }
    for (const floor of sortedFloors) {
      for (const r of floor.rooms) {
        if (SITE_ROOM_TYPES.includes(r.type)) continue;
        const outside = roomPolygon(r).some((c) => !pointInRect(c, fp, 1));
        if (outside) {
          add({
            severity: 'warning',
            category: 'geometry',
            message: `${r.name} (${floor.name}) sticks out of the house outline.`,
            floorId: floor.id,
            elementIds: [r.id],
          });
        }
      }
    }
  }

  for (const floor of sortedFloors) {
    validateFloor(project, floor, add);
  }

  // Compound wall gates
  for (const o of project.siteOpenings) {
    const w = project.siteWalls.find((x) => x.id === o.wallId);
    if (!w) {
      add({ severity: 'error', category: 'geometry', message: `Gate "${o.label || 'gate'}" has no wall.`, elementIds: [o.id] });
    } else if (o.offsetMm - o.widthMm / 2 < -EPS || o.offsetMm + o.widthMm / 2 > wallLength(w) + EPS) {
      add({ severity: 'error', category: 'geometry', message: `Gate "${o.label || 'gate'}" does not fit its compound wall.`, elementIds: [o.id] });
    }
  }

  return issues;
}

function setbackSidesViolated(project: Project, pts: { x: number; y: number }[]): Side[] {
  const boundary = project.plot.boundary;
  const sides = new Set<Side>();
  for (const c of pts) {
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const side = edgeSide(a, b);
      const sb = project.plot.setbacks[side];
      if (sb > 0 && distanceToSegment(c, a, b) < sb - 1) sides.add(side);
    }
  }
  return [...sides];
}

function validateFloor(project: Project, floor: Floor, add: (i: Omit<Issue, 'id'>) => void) {
  const unit = project.settings.unit;
  const boundary = project.plot.boundary;
  const where = floor.name;

  for (const r of floor.rooms) {
    if (r.w <= EPS || r.d <= EPS) {
      add({ severity: 'error', category: 'geometry', message: `${r.name} (${where}) has zero size.`, floorId: floor.id, elementIds: [r.id] });
      continue;
    }
    const outside = roomPolygon(r).some((c) => !pointInPolygon(c, boundary, 1));
    if (outside) {
      add({ severity: 'error', category: 'plot', message: `${r.name} (${where}) extends outside the plot.`, floorId: floor.id, elementIds: [r.id] });
    } else if (!SETBACK_ALLOWED.includes(r.type)) {
      const sides = setbackSidesViolated(project, roomPolygon(r));
      if (sides.length) {
        add({
          severity: 'warning',
          category: 'regulation',
          message: `${r.name} (${where}) is inside the ${sides.map((s) => SIDE_NAMES[s].toLowerCase()).join(' and ')} setback.`,
          floorId: floor.id,
          elementIds: [r.id],
        });
      }
    }
  }

  for (let i = 0; i < floor.rooms.length; i++) {
    for (let j = i + 1; j < floor.rooms.length; j++) {
      const a = floor.rooms[i];
      const b = floor.rooms[j];
      if (OVERLAP_ALLOWED.includes(a.type) && OVERLAP_ALLOWED.includes(b.type)) continue;
      const ra = roomRects(a);
      const rb = roomRects(b);
      const ov = ra.reduce((s, x) => s + rb.reduce((t, y) => t + rectOverlapArea(x, y), 0), 0);
      if (ov > 0) {
        add({
          severity: 'error',
          category: 'geometry',
          message: `${a.name} and ${b.name} (${where}) overlap.`,
          floorId: floor.id,
          elementIds: [a.id, b.id],
        });
      }
    }
  }

  for (const w of floor.walls) {
    const len = wallLength(w);
    if (len < 10) {
      add({ severity: 'error', category: 'geometry', message: `A wall on ${where} has (almost) zero length.`, floorId: floor.id, elementIds: [w.id] });
      continue;
    }
    if (!pointInPolygon(w.a, boundary, 1) || !pointInPolygon(w.b, boundary, 1)) {
      add({ severity: 'error', category: 'plot', message: `A wall on ${where} (${formatLength(len, unit)}) lies outside the plot.`, floorId: floor.id, elementIds: [w.id] });
    }
  }

  const byWall = new Map<string, typeof floor.openings>();
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    const name = o.label || (o.type === 'door' ? 'A door' : o.type === 'window' ? 'A window' : 'A gate');
    if (!w) {
      add({ severity: 'error', category: 'geometry', message: `${name} on ${where} is not attached to a wall.`, floorId: floor.id, elementIds: [o.id] });
      continue;
    }
    if (o.offsetMm - o.widthMm / 2 < -EPS || o.offsetMm + o.widthMm / 2 > wallLength(w) + EPS) {
      add({ severity: 'error', category: 'geometry', message: `${name} on ${where} is wider than the space available on its wall.`, floorId: floor.id, elementIds: [o.id] });
    }
    const list = byWall.get(w.id) ?? [];
    list.push(o);
    byWall.set(w.id, list);
  }
  for (const list of byWall.values()) {
    const sorted = [...list].sort((a, b) => a.offsetMm - b.offsetMm);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.offsetMm + a.widthMm / 2 > b.offsetMm - b.widthMm / 2 + EPS) {
        add({
          severity: 'error',
          category: 'geometry',
          message: `Two openings overlap on the same wall (${where}).`,
          floorId: floor.id,
          elementIds: [a.id, b.id],
        });
      }
    }
  }

  if (floor.walls.length > 0) {
    const pointsOf = (type: 'door' | 'window') =>
      floor.openings
        .filter((o) => o.type === type)
        .map((o) => {
          const w = floor.walls.find((x) => x.id === o.wallId);
          return w ? pointAlongWall(w, o.offsetMm) : null;
        })
        .filter((p): p is { x: number; y: number } => p !== null);
    const doorPoints = pointsOf('door');
    const windowPoints = pointsOf('window');
    const onEdge = (r: Room, pts: { x: number; y: number }[]) => {
      const edges = roomEdges(r);
      return pts.some((p) => edges.some(([a, b]) => distanceToSegment(p, a, b) < 5));
    };
    for (const r of floor.rooms) {
      if (NEEDS_DOOR.includes(r.type) && !onEdge(r, doorPoints)) {
        add({ severity: 'warning', category: 'access', message: `${r.name} (${where}) has no door — it may be inaccessible.`, floorId: floor.id, elementIds: [r.id] });
      }
      if (NEEDS_WINDOW.includes(r.type) && !onEdge(r, windowPoints)) {
        add({
          severity: 'warning',
          category: 'ventilation',
          message: `${r.name} (${where}) has no window or ventilator. If it has no outside wall, plan a duct or exhaust.`,
          floorId: floor.id,
          elementIds: [r.id],
        });
      }
    }

    if (floor.level === 0) {
      const entrance = floor.openings.some((o) => {
        const w = floor.walls.find((x) => x.id === o.wallId);
        return o.type === 'door' && w?.kind === 'exterior';
      });
      if (!entrance) {
        add({ severity: 'warning', category: 'access', message: 'The ground floor has no door on an exterior wall (no entrance).', floorId: floor.id, elementIds: [] });
      }
    }
  }
}
