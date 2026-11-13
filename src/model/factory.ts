import { nanoid } from 'nanoid';
import { ft } from './units';
import { ROOM_TYPE_LABELS, SCHEMA_VERSION } from './types';
import type {
  Floor,
  Opening,
  OpeningType,
  Plot,
  Point,
  Project,
  ProjectSettings,
  Room,
  RoomType,
  Side,
  Wall,
  WallKind,
} from './types';

export const newId = (): string => nanoid(10);

export const DEFAULT_SETTINGS: ProjectSettings = {
  unit: 'ft',
  snapMm: 6 * 25.4,
  // 9" and 4½" brick walls are common Indian practice; editable per project.
  defaultExteriorWallMm: 9 * 25.4,
  defaultInteriorWallMm: 4.5 * 25.4,
  defaultWallHeightMm: ft(10),
};

export function rectangularBoundary(widthMm: number, depthMm: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: widthMm, y: 0 },
    { x: widthMm, y: depthMm },
    { x: 0, y: depthMm },
  ];
}

export function createPlot(widthMm = ft(40), depthMm = ft(60)): Plot {
  return {
    boundary: rectangularBoundary(widthMm, depthMm),
    roads: [{ side: 'N', widthMm: ft(30) }],
    neighbours: ['E', 'W', 'S'],
    setbacks: { N: ft(5), S: ft(3), E: ft(3), W: ft(3) },
    elevationMm: 0,
    slopePercent: 0,
    slopeTowards: 'N',
    maxFloors: 2,
    maxHeightMm: ft(30),
    maxCoveragePercent: 0,
  };
}

export function createFloor(level: number, name?: string): Floor {
  return {
    id: newId(),
    name: name ?? (level === 0 ? 'Ground floor' : `Floor ${level}`),
    level,
    heightMm: ft(10),
    rooms: [],
    walls: [],
    openings: [],
  };
}

export function createProject(name = 'Untitled house', plot: Plot = createPlot()): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS },
    plot,
    floors: [createFloor(0)],
    siteWalls: [],
    siteOpenings: [],
    footprint: null,
  };
}

export function createRoom(type: RoomType, x: number, y: number, w: number, d: number, name?: string): Room {
  return { id: newId(), name: name ?? ROOM_TYPE_LABELS[type], type, x, y, w, d, locked: false };
}

export function createWall(
  a: Point,
  b: Point,
  kind: WallKind,
  thicknessMm: number,
  heightMm: number,
): Wall {
  return {
    id: newId(),
    a: { ...a },
    b: { ...b },
    thicknessMm,
    heightMm,
    kind,
    material: kind === 'compound' ? 'concrete_block' : 'brick',
    locked: false,
  };
}

export const OPENING_DEFAULTS: Record<OpeningType, { widthMm: number; heightMm: number; sillMm: number }> = {
  // Typical sizes (editable): door 3'-0" × 7'-0", window 4'-0" × 4'-0" at 3'-0" sill, gate 4'-0".
  door: { widthMm: ft(3), heightMm: ft(7), sillMm: 0 },
  window: { widthMm: ft(4), heightMm: ft(4), sillMm: ft(3) },
  gate: { widthMm: ft(4), heightMm: ft(5), sillMm: 0 },
};

export function createOpening(type: OpeningType, wallId: string, offsetMm: number, label = ''): Opening {
  const d = OPENING_DEFAULTS[type];
  return {
    id: newId(),
    wallId,
    type,
    offsetMm,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    sillMm: d.sillMm,
    hinge: 'start',
    swing: 'left',
    label,
    locked: false,
  };
}

export const SIDE_NAMES: Record<Side, string> = { N: 'North', S: 'South', E: 'East', W: 'West' };
