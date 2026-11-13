import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { createFloor, createOpening, createProject, newId } from '../model/factory';
import { pointAlongWall, wallLength } from '../model/geometry';
import { buildCompoundWalls, rebuildFloorWalls } from '../model/wallBuilder';
import { defaultFootprint, houseContents } from '../model/footprint';
import { withBounds } from '../model/roomShape';
import type { Floor, Footprint, Item, Opening, OpeningType, Project, Room, Side, Underlay, Wall } from '../model/types';
import { boundingBox, insetPolygon, pointInRect } from '../model/geometry';
import { createWall } from '../model/factory';

export type SelectionKind = 'room' | 'wall' | 'opening' | 'siteWall' | 'siteOpening' | 'footprint' | 'item';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

const HISTORY_LIMIT = 100;

export interface PlacePlanArgs {
  floorId: string;
  name: string;
  dataUrl: string;
  /** House size the drawing represents (mm, east–west × north–south). */
  w: number;
  d: number;
  /** Remove the rooms, walls, doors and windows currently inside the house outline on this floor. */
  clearOld: boolean;
  /** Wall rectangles detected in the drawing, relative to its north-west corner (mm). */
  wallRects: { x: number; y: number; w: number; d: number }[];
}

interface ProjectState {
  project: Project;
  past: Project[];
  future: Project[];
  activeFloorId: string;
  selection: Selection | null;
  /** Message from the last operation that the user should see (e.g. dropped openings). */
  notice: string | null;

  load: (p: Project) => void;
  commit: (recipe: (draft: Draft<Project>) => void) => void;
  undo: () => void;
  redo: () => void;
  select: (s: Selection | null) => void;
  setNotice: (n: string | null) => void;
  setActiveFloor: (id: string) => void;

  addRoom: (room: Room) => void;
  updateRoom: (id: string, patch: Partial<Room>) => void;
  addItem: (item: Item) => void;
  addItems: (items: Item[], floorId?: string) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  addWall: (wall: Wall) => void;
  updateWall: (id: string, patch: Partial<Wall>, site?: boolean) => void;
  addOpening: (type: OpeningType, wallId: string, offsetMm: number, site?: boolean) => void;
  updateOpening: (id: string, patch: Partial<Opening>, site?: boolean) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  toggleLockSelection: () => void;
  rotateSelectedRoom: () => void;
  rebuildWalls: () => void;
  generateCompoundWall: (gates: Side[]) => void;
  removeCompoundWall: () => void;

  /** Create the house outline (defaults to the current building extent or the buildable area). */
  addFootprint: () => void;
  removeFootprint: () => void;
  /** Change the outline's size or position without moving any rooms. */
  updateFootprint: (patch: Partial<Footprint>) => void;
  /** Move the house: the outline plus every room and wall inside it, on all floors. */
  moveHouse: (dx: number, dy: number) => void;
  /** Put an imported plan drawing into the house outline (the plot is never changed). */
  placeHousePlan: (args: PlacePlanArgs) => void;
  updateUnderlay: (id: string, patch: Partial<Underlay>) => void;
  removeUnderlay: (id: string) => void;

  addFloor: () => void;
  duplicateFloor: (id: string) => void;
  deleteFloor: (id: string) => void;
  renameFloor: (id: string, name: string) => void;
  updateFloor: (id: string, patch: Partial<Pick<Floor, 'heightMm' | 'name'>>) => void;
}

export function activeFloor(s: { project: Project; activeFloorId: string }): Floor {
  return s.project.floors.find((f) => f.id === s.activeFloorId) ?? s.project.floors[0];
}

function floorDraft(d: Draft<Project>, id: string): Draft<Floor> {
  return (d.floors.find((f) => f.id === id) ?? d.floors[0]) as Draft<Floor>;
}

/** Deep copy a floor with fresh ids (openings re-pointed at the copied walls). */
export function cloneFloor(floor: Floor, level: number): Floor {
  const wallMap = new Map<string, string>();
  const walls = floor.walls.map((w) => {
    const id = newId();
    wallMap.set(w.id, id);
    return { ...w, id, a: { ...w.a }, b: { ...w.b } };
  });
  return {
    ...floor,
    id: newId(),
    level,
    name: level === 0 ? 'Ground floor' : `Floor ${level}`,
    rooms: floor.rooms.map((r) => ({ ...r, id: newId() })),
    items: (floor.items ?? []).map((it) => ({ ...it, id: newId() })),
    walls,
    openings: floor.openings
      .filter((o) => wallMap.has(o.wallId))
      .map((o) => ({ ...o, id: newId(), wallId: wallMap.get(o.wallId)! })),
  };
}

const initial = createProject();

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: initial,
  past: [],
  future: [],
  activeFloorId: initial.floors[0].id,
  selection: null,
  notice: null,

  load: (p) =>
    set({
      project: p,
      past: [],
      future: [],
      activeFloorId: [...p.floors].sort((a, b) => a.level - b.level)[0]?.id ?? '',
      selection: null,
      notice: null,
    }),

  commit: (recipe) => {
    const { project, past } = get();
    const changed = produce(project, recipe);
    if (changed === project) return; // recipe made no change → no history entry
    const next = produce(changed, (d) => {
      d.updatedAt = new Date().toISOString();
    });
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [] });
  },

  undo: () => {
    const { past, project, future, activeFloorId } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future],
      selection: null,
      activeFloorId: prev.floors.some((f) => f.id === activeFloorId) ? activeFloorId : prev.floors[0].id,
    });
  },

  redo: () => {
    const { past, project, future, activeFloorId } = get();
    const next = future[0];
    if (!next) return;
    set({
      project: next,
      past: [...past, project],
      future: future.slice(1),
      selection: null,
      activeFloorId: next.floors.some((f) => f.id === activeFloorId) ? activeFloorId : next.floors[0].id,
    });
  },

  select: (selection) => set({ selection }),
  setNotice: (notice) => set({ notice }),
  setActiveFloor: (id) => set({ activeFloorId: id, selection: null }),

  addRoom: (room) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      floorDraft(d, fid).rooms.push(room);
    });
    set({ selection: { kind: 'room', id: room.id } });
  },

  updateRoom: (id, patch) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      const r = floorDraft(d, fid).rooms.find((x) => x.id === id);
      if (!r) return;
      // Irregular rooms: moving or resizing the bounding box moves or scales the outline with it.
      if (r.points && !patch.points) {
        const nx = patch.x ?? r.x;
        const ny = patch.y ?? r.y;
        const sx = patch.w !== undefined && r.w ? patch.w / r.w : 1;
        const sy = patch.d !== undefined && r.d ? patch.d / r.d : 1;
        r.points = r.points.map((p) => ({ x: nx + (p.x - r.x) * sx, y: ny + (p.y - r.y) * sy }));
      }
      Object.assign(r, patch);
      if (r.points) {
        const b = withBounds(r as Room);
        Object.assign(r, { x: b.x, y: b.y, w: b.w, d: b.d, points: b.points });
      }
    });
  },

  addItem: (item) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      floorDraft(d, fid).items.push(item);
    });
    set({ selection: { kind: 'item', id: item.id } });
  },

  addItems: (items, floorId) => {
    const fid = floorId ?? get().activeFloorId;
    get().commit((d) => {
      floorDraft(d, fid).items.push(...items);
    });
  },

  updateItem: (id, patch) => {
    get().commit((d) => {
      for (const f of d.floors) {
        const it = f.items.find((x) => x.id === id);
        if (it) {
          Object.assign(it, patch);
          return;
        }
      }
    });
  },

  addWall: (wall) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      floorDraft(d, fid).walls.push(wall);
    });
    set({ selection: { kind: 'wall', id: wall.id } });
  },

  updateWall: (id, patch, site = false) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      const list = site ? d.siteWalls : floorDraft(d, fid).walls;
      const w = list.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
    });
  },

  addOpening: (type, wallId, offsetMm, site = false) => {
    const fid = get().activeFloorId;
    const o = createOpening(type, wallId, offsetMm);
    get().commit((d) => {
      const list = site ? d.siteOpenings : floorDraft(d, fid).openings;
      const walls = site ? d.siteWalls : floorDraft(d, fid).walls;
      const w = walls.find((x) => x.id === wallId);
      if (w) {
        const len = wallLength(w as Wall);
        // Shrink the default width if the wall is short, and keep the opening on the wall.
        o.widthMm = Math.min(o.widthMm, Math.max(300, len - 100));
        o.offsetMm = Math.min(Math.max(offsetMm, o.widthMm / 2), len - o.widthMm / 2);
      }
      const count = list.filter((x) => x.type === type).length + 1;
      o.label = `${type === 'door' ? 'D' : type === 'window' ? 'W' : 'G'}${count}`;
      list.push(o);
    });
    set({ selection: { kind: site ? 'siteOpening' : 'opening', id: o.id } });
  },

  updateOpening: (id, patch, site = false) => {
    const fid = get().activeFloorId;
    get().commit((d) => {
      const list = site ? d.siteOpenings : floorDraft(d, fid).openings;
      const o = list.find((x) => x.id === id);
      if (o) Object.assign(o, patch);
    });
  },

  deleteSelection: () => {
    const { selection, activeFloorId } = get();
    if (!selection) return;
    get().commit((d) => {
      const f = floorDraft(d, activeFloorId);
      switch (selection.kind) {
        case 'room': {
          const r = f.rooms.find((x) => x.id === selection.id);
          if (r && !r.locked) f.rooms = f.rooms.filter((x) => x.id !== selection.id);
          break;
        }
        case 'wall': {
          const w = f.walls.find((x) => x.id === selection.id);
          if (w && !w.locked) {
            f.walls = f.walls.filter((x) => x.id !== selection.id);
            f.openings = f.openings.filter((o) => o.wallId !== selection.id);
          }
          break;
        }
        case 'opening': {
          const o = f.openings.find((x) => x.id === selection.id);
          if (o && !o.locked) f.openings = f.openings.filter((x) => x.id !== selection.id);
          break;
        }
        case 'siteWall': {
          const w = d.siteWalls.find((x) => x.id === selection.id);
          if (w && !w.locked) {
            d.siteWalls = d.siteWalls.filter((x) => x.id !== selection.id);
            d.siteOpenings = d.siteOpenings.filter((o) => o.wallId !== selection.id);
          }
          break;
        }
        case 'siteOpening': {
          const o = d.siteOpenings.find((x) => x.id === selection.id);
          if (o && !o.locked) d.siteOpenings = d.siteOpenings.filter((x) => x.id !== selection.id);
          break;
        }
        case 'item': {
          const it = f.items.find((x) => x.id === selection.id);
          if (it && !it.locked) f.items = f.items.filter((x) => x.id !== selection.id);
          break;
        }
        case 'footprint':
          // Removes only the outline; rooms and walls stay where they are.
          if (d.footprint && !d.footprint.locked) d.footprint = null;
          break;
      }
    });
    set({ selection: null });
  },

  duplicateSelection: () => {
    const { selection, activeFloorId, project } = get();
    if (!selection) return;
    const f = project.floors.find((x) => x.id === activeFloorId);
    if (!f) return;
    const step = project.settings.snapMm || 300;
    if (selection.kind === 'room') {
      const r = f.rooms.find((x) => x.id === selection.id);
      if (!r) return;
      const copy: Room = {
        ...r,
        id: newId(),
        name: `${r.name} copy`,
        x: r.x + step * 2,
        y: r.y + step * 2,
        points: r.points?.map((p) => ({ x: p.x + step * 2, y: p.y + step * 2 })),
        locked: false,
      };
      get().addRoom(copy);
    } else if (selection.kind === 'wall') {
      const w = f.walls.find((x) => x.id === selection.id);
      if (!w) return;
      const copy: Wall = {
        ...w,
        id: newId(),
        a: { x: w.a.x + step * 2, y: w.a.y + step * 2 },
        b: { x: w.b.x + step * 2, y: w.b.y + step * 2 },
        locked: false,
      };
      get().addWall(copy);
    } else if (selection.kind === 'item') {
      const it = f.items.find((x) => x.id === selection.id);
      if (it) get().addItem({ ...it, id: newId(), x: it.x + step * 2, y: it.y + step * 2, locked: false });
    } else if (selection.kind === 'opening') {
      const o = f.openings.find((x) => x.id === selection.id);
      const w = o && f.walls.find((x) => x.id === o.wallId);
      if (!o || !w) return;
      get().addOpening(o.type, o.wallId, Math.min(o.offsetMm + o.widthMm + step, wallLength(w) - o.widthMm / 2));
    }
  },

  toggleLockSelection: () => {
    const { selection, activeFloorId } = get();
    if (!selection) return;
    get().commit((d) => {
      const f = floorDraft(d, activeFloorId);
      const lists: Record<Exclude<SelectionKind, 'footprint'>, { id: string; locked: boolean }[]> = {
        item: f.items,
        room: f.rooms,
        wall: f.walls,
        opening: f.openings,
        siteWall: d.siteWalls,
        siteOpening: d.siteOpenings,
      };
      if (selection.kind === 'footprint') {
        if (d.footprint) d.footprint.locked = !d.footprint.locked;
        return;
      }
      const el = lists[selection.kind].find((x) => x.id === selection.id);
      if (el) el.locked = !el.locked;
    });
  },

  rotateSelectedRoom: () => {
    const { selection, activeFloorId } = get();
    if (selection?.kind !== 'room') return;
    get().commit((d) => {
      const r = floorDraft(d, activeFloorId).rooms.find((x) => x.id === selection.id);
      if (!r || r.locked) return;
      // Rotate 90° about the room centre.
      const cx = r.x + r.w / 2;
      const cy = r.y + r.d / 2;
      const w = r.d;
      const dd = r.w;
      if (r.points) r.points = r.points.map((p) => ({ x: cx - (p.y - cy), y: cy + (p.x - cx) }));
      r.x = cx - w / 2;
      r.y = cy - dd / 2;
      r.w = w;
      r.d = dd;
      if (r.points) {
        const b = withBounds(r as Room);
        r.points = b.points;
      }
      if (r.stairUp) r.stairUp = ({ N: 'E', E: 'S', S: 'W', W: 'N' } as const)[r.stairUp];
    });
  },

  rebuildWalls: () => {
    const { activeFloorId, project } = get();
    const f = project.floors.find((x) => x.id === activeFloorId);
    if (!f) return;
    const { floor, dropped } = rebuildFloorWalls(f, project.settings);
    get().commit((d) => {
      const target = floorDraft(d, activeFloorId);
      target.walls = floor.walls;
      target.openings = floor.openings;
    });
    set({
      selection: null,
      notice:
        dropped > 0
          ? `Walls rebuilt. ${dropped} door/window${dropped > 1 ? 's' : ''} no longer sat on a wall and ${dropped > 1 ? 'were' : 'was'} removed.`
          : `Walls rebuilt: ${floor.walls.length} wall segments.`,
    });
  },

  generateCompoundWall: (gates) => {
    const p = get().project;
    const walls = buildCompoundWalls(p);
    const openings: Opening[] = [];
    for (const side of gates) {
      // Find the compound wall facing this side (by its midpoint relative to the plot centre).
      const idx = walls.findIndex((w) => compoundWallSide(w, p) === side);
      if (idx < 0) continue;
      const w = walls[idx];
      const o = createOpening('gate', w.id, wallLength(w) / 2, `G${openings.length + 1}`);
      openings.push(o);
    }
    get().commit((d) => {
      d.siteWalls = walls;
      d.siteOpenings = openings;
    });
  },

  removeCompoundWall: () =>
    get().commit((d) => {
      d.siteWalls = [];
      d.siteOpenings = [];
    }),

  addFootprint: () => {
    const p = get().project;
    if (p.footprint) return;
    const f = defaultFootprint(p);
    get().commit((d) => {
      d.footprint = f;
    });
    set({ selection: { kind: 'footprint', id: 'footprint' } });
  },

  removeFootprint: () =>
    get().commit((d) => {
      d.footprint = null;
    }),

  updateFootprint: (patch) =>
    get().commit((d) => {
      if (d.footprint) Object.assign(d.footprint, patch);
    }),

  moveHouse: (dx, dy) => {
    const p = get().project;
    const f = p.footprint;
    if (!f || f.locked || (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)) return;
    const inside = houseContents(p, f);
    // Round to 0.01 mm so repeated moves don't accumulate floating-point noise.
    const r2 = (v: number) => Math.round(v * 100) / 100;
    get().commit((d) => {
      if (!d.footprint) return;
      d.footprint.x = r2(d.footprint.x + dx);
      d.footprint.y = r2(d.footprint.y + dy);
      for (const floor of d.floors) {
        for (const r of floor.rooms) {
          if (inside.rooms.has(r.id)) {
            r.x = r2(r.x + dx);
            r.y = r2(r.y + dy);
            if (r.points) r.points = r.points.map((p) => ({ x: r2(p.x + dx), y: r2(p.y + dy) }));
          }
        }
        for (const w of floor.walls) {
          if (inside.walls.has(w.id)) {
            w.a = { x: r2(w.a.x + dx), y: r2(w.a.y + dy) };
            w.b = { x: r2(w.b.x + dx), y: r2(w.b.y + dy) };
          }
        }
      }
      for (const floor of d.floors) {
        for (const it of floor.items) {
          if (inside.items.has(it.id)) {
            it.x = r2(it.x + dx);
            it.y = r2(it.y + dy);
          }
        }
      }
      // Plan drawings inside the outline move with the house.
      for (const u of d.underlays) {
        if (pointInRect({ x: u.x + u.w / 2, y: u.y + u.d / 2 }, f, 1)) {
          u.x = r2(u.x + dx);
          u.y = r2(u.y + dy);
        }
      }
    });
  },

  placeHousePlan: (a) => {
    const p = get().project;
    // Where the house goes: keep the existing outline's north-west corner; otherwise centre it in the
    // buildable area inside the setbacks (or the plot if the setbacks leave too little room).
    let x: number;
    let y: number;
    if (p.footprint) {
      x = p.footprint.x;
      y = p.footprint.y;
    } else {
      const env = boundingBox(insetPolygon(p.plot.boundary, p.plot.setbacks));
      const area = env.w >= a.w && env.d >= a.d ? env : boundingBox(p.plot.boundary);
      x = Math.round(area.x + (area.w - a.w) / 2);
      y = Math.round(area.y + (area.d - a.d) / 2);
    }
    const oldArea = p.footprint ?? { x, y, w: a.w, d: a.d };
    const inside = houseContents(p, oldArea);
    const walls: Wall[] = a.wallRects.map((r) => {
      const horizontal = r.w >= r.d;
      const t = horizontal ? r.d : r.w;
      const cx = x + r.x;
      const cy = y + r.y;
      const ends = horizontal
        ? [{ x: cx + Math.min(t / 2, r.w / 2), y: cy + r.d / 2 }, { x: cx + r.w - Math.min(t / 2, r.w / 2), y: cy + r.d / 2 }]
        : [{ x: cx + r.w / 2, y: cy + Math.min(t / 2, r.d / 2) }, { x: cx + r.w / 2, y: cy + r.d - Math.min(t / 2, r.d / 2) }];
      const onEdge = r.x < 150 || r.y < 150 || r.x + r.w > a.w - 150 || r.y + r.d > a.d - 150;
      const w = createWall(ends[0], ends[1], onEdge ? 'exterior' : 'interior', Math.round(t), p.settings.defaultWallHeightMm);
      return w;
    });
    get().commit((d) => {
      d.footprint = { x, y, w: a.w, d: a.d, locked: d.footprint?.locked ?? false };
      const floor = d.floors.find((f) => f.id === a.floorId);
      if (floor && a.clearOld) {
        floor.rooms = floor.rooms.filter((r) => !inside.rooms.has(r.id));
        floor.walls = floor.walls.filter((w) => !inside.walls.has(w.id));
        const wallIds = new Set(floor.walls.map((w) => w.id));
        floor.openings = floor.openings.filter((o) => wallIds.has(o.wallId));
      }
      if (floor) floor.walls.push(...walls);
      d.underlays = d.underlays.filter((u) => u.floorId !== a.floorId);
      d.underlays.push({ id: newId(), floorId: a.floorId, name: a.name, dataUrl: a.dataUrl, x, y, w: a.w, d: a.d, opacity: 0.85, showIn3d: true });
    });
    set({ selection: null, activeFloorId: a.floorId });
  },

  updateUnderlay: (id, patch) =>
    get().commit((d) => {
      const u = d.underlays.find((x) => x.id === id);
      if (u) Object.assign(u, patch);
    }),

  removeUnderlay: (id) =>
    get().commit((d) => {
      d.underlays = d.underlays.filter((x) => x.id !== id);
    }),

  addFloor: () => {
    const p = get().project;
    const level = Math.max(...p.floors.map((f) => f.level)) + 1;
    const f = createFloor(level);
    get().commit((d) => {
      d.floors.push(f);
    });
    set({ activeFloorId: f.id, selection: null });
  },

  duplicateFloor: (id) => {
    const p = get().project;
    const src = p.floors.find((f) => f.id === id);
    if (!src) return;
    const level = Math.max(...p.floors.map((f) => f.level)) + 1;
    const copy = cloneFloor(src, level);
    get().commit((d) => {
      d.floors.push(copy);
    });
    set({ activeFloorId: copy.id, selection: null });
  },

  deleteFloor: (id) => {
    const p = get().project;
    if (p.floors.length <= 1) return;
    get().commit((d) => {
      d.floors = d.floors.filter((f) => f.id !== id);
    });
    const rest = get().project.floors;
    set({ activeFloorId: rest[0].id, selection: null });
  },

  renameFloor: (id, name) =>
    get().commit((d) => {
      const f = d.floors.find((x) => x.id === id);
      if (f) f.name = name;
    }),

  updateFloor: (id, patch) =>
    get().commit((d) => {
      const f = d.floors.find((x) => x.id === id);
      if (f) Object.assign(f, patch);
    }),
}));

/** Which plot side a compound wall segment faces (by its outward direction). */
export function compoundWallSide(w: Wall, p: Project): Side {
  const mid = pointAlongWall(w, wallLength(w) / 2);
  const xs = p.plot.boundary.map((q) => q.x);
  const ys = p.plot.boundary.map((q) => q.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = mid.x - cx;
  const dy = mid.y - cy;
  const w2 = (Math.max(...xs) - Math.min(...xs)) / 2 || 1;
  const d2 = (Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  if (Math.abs(dx) / w2 >= Math.abs(dy) / d2) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}
