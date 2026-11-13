/**
 * Turns the building model into simple 3D parts (boxes and prisms) in metres.
 * Pure data — no three.js — so it can be unit-tested.
 *
 * Axes: x = east, z = south (plan y), y = up. Plan millimetres → metres.
 */
import { wallDir, wallLength } from '../model/geometry';
import { defaultFinishFor, floorFinish } from '../model/finishes';
import type { Floor, Opening, Project, Room, Wall } from '../model/types';
import { roomGetsWalls } from '../model/wallBuilder';
import { finishTexture, type TextureSpec } from './textureSpec';
import { roomRects } from '../model/roomShape';

export const PLINTH_MM = 450; // 1'-6" plinth above ground, a common default

export type PartKind = 'wall' | 'slab' | 'floor' | 'glass' | 'door' | 'gate' | 'step' | 'tank' | 'lid' | 'site' | 'parapet' | 'roof' | 'trim';

export interface BoxPart {
  shape: 'box';
  kind: PartKind;
  /** Centre (m). */
  x: number;
  y: number;
  z: number;
  /** Size along local x (length), y (height), z (depth), m. */
  sx: number;
  sy: number;
  sz: number;
  /** Rotation about the vertical axis (radians). */
  ry: number;
  color: string;
  floorLevel: number;
  /** Selection target when clicked. */
  ref?: { kind: 'room' | 'wall' | 'opening' | 'item'; id: string; floorId: string };
  /** Optional procedural texture (on the top face for floors, the side for walls). */
  texture?: TextureSpec;
}

export interface GablePart {
  shape: 'gable';
  kind: 'roof';
  /** Footprint (m) and ridge height above the base. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  base: number;
  rise: number;
  ridge: 'EW' | 'NS';
  color: string;
  floorLevel: number;
}

export type Part = BoxPart | GablePart;

const M = (mm: number) => mm / 1000;

/** Elevation (mm) of the top of each floor's slab, keyed by floor id. */
export function floorElevations(project: Project): Map<string, number> {
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);
  const out = new Map<string, number>();
  let e = PLINTH_MM;
  for (const f of sorted) {
    out.set(f.id, e);
    e += f.heightMm;
  }
  return out;
}

/** Wall-local pieces (u along the wall from a, v up from the floor) left after cutting the openings. */
export function wallPieces(w: Wall, openings: Opening[]): { u0: number; u1: number; v0: number; v1: number }[] {
  const len = wallLength(w);
  const H = w.heightMm;
  const ext = w.thicknessMm / 2; // square ends so corners close
  const ops = openings
    .filter((o) => o.wallId === w.id)
    .map((o) => ({ s: Math.max(0, o.offsetMm - o.widthMm / 2), e: Math.min(len, o.offsetMm + o.widthMm / 2), sill: Math.max(0, o.sillMm), top: Math.min(H, o.sillMm + o.heightMm) }))
    .filter((o) => o.e > o.s)
    .sort((a, b) => a.s - b.s);
  const pieces: { u0: number; u1: number; v0: number; v1: number }[] = [];
  let cursor = -ext;
  for (const o of ops) {
    if (o.s > cursor) pieces.push({ u0: cursor, u1: o.s, v0: 0, v1: H });
    if (o.sill > 0) pieces.push({ u0: o.s, u1: o.e, v0: 0, v1: o.sill });
    if (o.top < H) pieces.push({ u0: o.s, u1: o.e, v0: o.top, v1: H });
    cursor = Math.max(cursor, o.e);
  }
  if (len + ext > cursor) pieces.push({ u0: cursor, u1: len + ext, v0: 0, v1: H });
  return pieces;
}

function boxAlongWall(
  w: Wall,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  thickness: number,
  baseMm: number,
  kind: PartKind,
  color: string,
  floorLevel: number,
  ref?: BoxPart['ref'],
): BoxPart {
  const d = wallDir(w);
  const uc = (u0 + u1) / 2;
  return {
    shape: 'box',
    kind,
    x: M(w.a.x + d.x * uc),
    z: M(w.a.y + d.y * uc),
    y: M(baseMm + (v0 + v1) / 2),
    sx: M(u1 - u0),
    sy: M(v1 - v0),
    sz: M(thickness),
    ry: -Math.atan2(d.y, d.x),
    color,
    floorLevel,
    ref,
  };
}

function roomBox(r: Room, topMm: number, thickMm: number, kind: PartKind, color: string, floorLevel: number, ref?: BoxPart['ref']): BoxPart {
  return {
    shape: 'box',
    kind,
    x: M(r.x + r.w / 2),
    z: M(r.y + r.d / 2),
    y: M(topMm - thickMm / 2),
    sx: M(r.w),
    sy: M(thickMm),
    sz: M(r.d),
    ry: 0,
    color,
    floorLevel,
    ref,
  };
}

const COLORS = {
  glass: '#9cc8e4',
  door: '#8b5a34',
  gate: '#5d6168',
  compound: '#d9d2c3',
  step: '#b6a58e',
  tank: '#2f6f9f',
  lid: '#5d6a73',
  garden: '#8fbf72',
  pathway: '#cfc4b0',
  slabEdge: '#d8d6cf',
};

export function buildParts(project: Project): Part[] {
  const parts: Part[] = [];
  const elev = floorElevations(project);
  const fin = project.finishes;
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);

  // Compound wall and gates (ground level).
  for (const w of project.siteWalls) {
    for (const p of wallPieces(w, project.siteOpenings)) {
      parts.push({ ...boxAlongWall(w, p.u0, p.u1, p.v0, p.v1, w.thicknessMm, 0, 'wall', COLORS.compound, 0), texture: { kind: 'paint', tileM: 2 } });
    }
    for (const o of project.siteOpenings.filter((x) => x.wallId === w.id)) {
      parts.push(boxAlongWall(w, o.offsetMm - o.widthMm / 2, o.offsetMm + o.widthMm / 2, 0, Math.min(o.heightMm, w.heightMm), 40, 0, 'gate', COLORS.gate, 0));
    }
  }

  // Plinth under the whole house outline, so walls drawn without rooms still stand on a base.
  if (project.footprint && sorted.length) {
    const f = project.footprint;
    parts.push({ shape: 'box', kind: 'floor', x: M(f.x + f.w / 2), z: M(f.y + f.d / 2), y: M(PLINTH_MM / 2), sx: M(f.w), sy: M(PLINTH_MM - 5), sz: M(f.d), ry: 0, color: '#d6cbb6', floorLevel: sorted[0].level });
  }

  for (const floor of sorted) {
    const base = elev.get(floor.id)!;
    const lvl = floor.level;
    const ref = (kind: 'room' | 'wall' | 'opening', id: string) => ({ kind, id, floorId: floor.id });

    for (const r of floor.rooms) {
      if (r.type === 'garden' || r.type === 'pathway' || r.type === 'parking') {
        parts.push({ ...roomBox(r, 25, 20, 'site', r.type === 'garden' ? COLORS.garden : COLORS.pathway, lvl, ref('room', r.id)), texture: r.type === 'garden' ? { kind: 'grass', tileM: 2 } : { kind: 'paving', tileM: 1.2 } });
      } else if (r.type === 'sump' || r.type === 'septic_tank' || r.type === 'borewell') {
        parts.push(roomBox(r, 60, 60, 'lid', COLORS.lid, lvl, ref('room', r.id)));
      } else if (r.type === 'overhead_tank') {
        parts.push(roomBox(r, base + 1200, 1200, 'tank', COLORS.tank, lvl, ref('room', r.id)));
      } else if (r.type === 'staircase') {
        // A flight only where there is a floor above to reach; on the top floor it is just the arrival.
        if (sorted.some((f) => f.level > lvl)) parts.push(...stairSteps(r, base, floor, lvl, ref('room', r.id)));
      } else if (r.type === 'terrace') {
        // walkable roof: the slab below is drawn by the floor underneath
      } else {
        const finishId = r.floorFinish ?? defaultFinishFor(r.type) ?? fin.floor;
        const color = floorFinish(finishId).color;
        const texture = finishTexture(finishId);
        // Ground-floor rooms stand on a plinth block; upper floors on a thin finish layer over the slab.
        for (const piece of roomRects(r)) {
          const rr = { ...r, ...piece };
          if (lvl === 0) parts.push({ ...roomBox(rr, base, base, 'floor', color, lvl, ref('room', r.id)), texture });
          else parts.push({ ...roomBox(rr, base + 15, 15, 'floor', color, lvl, ref('room', r.id)), texture });
        }
      }
    }

    for (const w of floor.walls) {
      const color = w.kind === 'exterior' ? fin.exteriorWall : fin.interiorWall;
      for (const p of wallPieces(w, floor.openings)) {
        parts.push({ ...boxAlongWall(w, p.u0, p.u1, p.v0, p.v1, w.thicknessMm, base, 'wall', color, lvl, ref('wall', w.id)), texture: { kind: 'paint', tileM: 2 } });
      }
    }

    for (const o of floor.openings) {
      const w = floor.walls.find((x) => x.id === o.wallId);
      if (!w) continue;
      const u0 = o.offsetMm - o.widthMm / 2;
      const u1 = o.offsetMm + o.widthMm / 2;
      const top = Math.min(o.sillMm + o.heightMm, w.heightMm);
      if (o.type === 'window') parts.push(boxAlongWall(w, u0, u1, o.sillMm, top, 20, base, 'glass', COLORS.glass, lvl, ref('opening', o.id)));
      else parts.push(boxAlongWall(w, u0, u1, 0, top, o.type === 'gate' ? 40 : 35, base, o.type === 'gate' ? 'gate' : 'door', o.type === 'gate' ? COLORS.gate : COLORS.door, lvl, ref('opening', o.id)));
    }

    // Sunshades (chajjas) over windows and doors in outside walls, and bands at slab level.
    const ext = project.exterior;
    const extWalls = floor.walls.filter((w) => w.kind === 'exterior');
    if (extWalls.length && (ext?.sunshadeMm > 0 || ext?.bands)) {
      const pts = extWalls.flatMap((w) => [w.a, w.b]);
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      for (const w of extWalls) {
        const d = wallDir(w);
        let n = { x: -d.y, y: d.x };
        const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
        if ((mid.x - cx) * n.x + (mid.y - cy) * n.y < 0) n = { x: -n.x, y: -n.y };
        const ry = -Math.atan2(d.y, d.x);
        if (ext.sunshadeMm > 0) {
          for (const o of floor.openings.filter((x) => x.wallId === w.id && x.type !== 'gate')) {
            const top = Math.min(o.sillMm + o.heightMm, w.heightMm);
            if (top > w.heightMm - 100) continue; // no room above the opening
            const off = w.thicknessMm / 2 + ext.sunshadeMm / 2;
            const c = { x: w.a.x + d.x * o.offsetMm + n.x * off, y: w.a.y + d.y * o.offsetMm + n.y * off };
            parts.push({ shape: 'box', kind: 'trim', x: M(c.x), z: M(c.y), y: M(base + top + 150 + 40), sx: M(o.widthMm + 300), sy: M(80), sz: M(ext.sunshadeMm), ry, color: fin.exteriorWall, floorLevel: lvl });
          }
        }
        if (ext.bands) {
          const off = w.thicknessMm / 2 + 40;
          const len = wallLength(w) + w.thicknessMm + 160;
          const c = { x: mid.x + n.x * off, y: mid.y + n.y * off };
          parts.push({ shape: 'box', kind: 'trim', x: M(c.x), z: M(c.y), y: M(base + floor.heightMm + project.roof.slabMm / 2), sx: M(len), sy: M(Math.max(150, project.roof.slabMm + 50)), sz: M(80), ry, color: ext.bandColor, floorLevel: lvl });
        }
      }
    }

    // Slab over every walled room and the portico.
    const covered = floor.rooms.filter((r) => roomGetsWalls(r) || r.type === 'portico');
    const slabTop = base + floor.heightMm;
    for (const r of covered) {
      for (const piece of roomRects(r)) parts.push(roomBox({ ...r, ...piece }, slabTop, project.roof.slabMm, 'slab', project.finishes.roof, lvl, ref('room', r.id)));
    }
  }

  // Roof: parapet or gable over the highest floor that has walls.
  const top = [...sorted].reverse().find((f) => f.walls.length > 0);
  if (top) {
    const roofBase = elev.get(top.id)! + top.heightMm;
    if (project.roof.type === 'flat' && project.roof.parapetMm > 0) {
      for (const w of top.walls.filter((x) => x.kind === 'exterior')) {
        parts.push(boxAlongWall(w, -w.thicknessMm / 2, wallLength(w) + w.thicknessMm / 2, 0, project.roof.parapetMm, w.thicknessMm, roofBase, 'parapet', fin.exteriorWall, top.level));
      }
    } else if (project.roof.type === 'gable') {
      const xs = top.walls.flatMap((w) => [w.a.x, w.b.x]);
      const ys = top.walls.flatMap((w) => [w.a.y, w.b.y]);
      const overhang = 450;
      const x0 = Math.min(...xs) - overhang;
      const x1 = Math.max(...xs) + overhang;
      const z0 = Math.min(...ys) - overhang;
      const z1 = Math.max(...ys) + overhang;
      const span = project.roof.ridge === 'EW' ? z1 - z0 : x1 - x0;
      const rise = (span / 2) * Math.tan((project.roof.pitchDeg * Math.PI) / 180);
      parts.push({ shape: 'gable', kind: 'roof', x0: M(x0), z0: M(z0), x1: M(x1), z1: M(z1), base: M(roofBase), rise: M(rise), ridge: project.roof.ridge, color: fin.roof, floorLevel: top.level });
    }
  }

  return parts;
}

function stairSteps(r: Room, base: number, floor: Floor, lvl: number, ref: BoxPart['ref']): BoxPart[] {
  const up = r.stairUp ?? 'N';
  const vertical = up === 'N' || up === 'S';
  const run = vertical ? r.d : r.w;
  const rise = floor.heightMm;
  const n = Math.max(2, Math.round(rise / 175)); // ~7" risers
  const tread = run / n;
  const out: BoxPart[] = [];
  // External stairs on the ground floor start at ground level, not on the plinth.
  const start = floor.level === 0 ? 0 : base;
  const total = base + rise - start;
  for (let i = 0; i < n; i++) {
    const h = (total * (i + 1)) / n;
    const along = tread * i + tread / 2;
    // Position along the direction of travel (walking "up").
    let cx = r.x + r.w / 2;
    let cz = r.y + r.d / 2;
    if (up === 'N') cz = r.y + r.d - along;
    if (up === 'S') cz = r.y + along;
    if (up === 'E') cx = r.x + along;
    if (up === 'W') cx = r.x + r.w - along;
    out.push({
      shape: 'box',
      kind: 'step',
      x: M(cx),
      z: M(cz),
      y: M(start + h / 2),
      sx: M(vertical ? r.w : tread),
      sy: M(h),
      sz: M(vertical ? tread : r.d),
      ry: 0,
      color: COLORS.step,
      floorLevel: lvl,
      ref,
    });
  }
  return out;
}

/** Room types drawn only as site features (no floor slab). */
export const SITE_TYPES_3D = ['garden', 'pathway', 'parking', 'sump', 'septic_tank', 'borewell'];
