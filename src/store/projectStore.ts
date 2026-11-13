import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { createFloor, createOpening, createProject, newId } from '../model/factory';
import { pointAlongWall, wallLength } from '../model/geometry';
import { buildCompoundWalls, rebuildFloorWalls } from '../model/wallBuilder';
import type { Floor, Opening, OpeningType, Project, Room, Side, Wall } from '../model/types';

export type SelectionKind = 'room' | 'wall' | 'opening' | 'siteWall' | 'siteOpening';
export interface Selection {
  kind: SelectionKind;
  id: string;
}

const HISTORY_LIMIT = 100;

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
      if (r) Object.assign(r, patch);
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
      const copy: Room = { ...r, id: newId(), name: `${r.name} copy`, x: r.x + step * 2, y: r.y + step * 2, locked: false };
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
      const lists: Record<SelectionKind, { id: string; locked: boolean }[]> = {
        room: f.rooms,
        wall: f.walls,
        opening: f.openings,
        siteWall: d.siteWalls,
        siteOpening: d.siteOpenings,
      };
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
      r.x = cx - w / 2;
      r.y = cy - dd / 2;
      r.w = w;
      r.d = dd;
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
