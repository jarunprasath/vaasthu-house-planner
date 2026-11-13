import { describe, expect, it } from 'vitest';
import { createFloor, createPlot, createProject, createRoom, DEFAULT_SETTINGS } from '../../src/model/factory';
import { floorAreas } from '../../src/model/areas';
import { lShapeOf, roomArea, roomCentre, roomRects, withBounds } from '../../src/model/roomShape';
import { ft } from '../../src/model/units';
import { buildWallsFromRooms } from '../../src/model/wallBuilder';
import { activeFloor, useProjectStore } from '../../src/store/projectStore';
import { validateProject } from '../../src/validation/validate';

const L = () => {
  const r = createRoom('living', 0, 0, 6000, 6000);
  return withBounds({ ...r, points: lShapeOf(r) }); // 6×6 m with the south-east 3×3 m removed
};

describe('irregular rooms', () => {
  it('area, pieces and label point of an L-shape', () => {
    const r = L();
    expect(roomArea(r)).toBe(27e6);
    expect(roomRects(r).reduce((s, x) => s + x.w * x.d, 0)).toBe(27e6);
    const c = roomCentre(r);
    expect(c.y).toBeLessThan(3000); // inside the full-width northern half
  });

  it('walls follow the outline: 6 exterior walls, none across the missing corner', () => {
    const walls = buildWallsFromRooms([L()], DEFAULT_SETTINGS);
    expect(walls.filter((w) => w.kind === 'exterior')).toHaveLength(6);
    expect(walls.some((w) => w.kind === 'interior')).toBe(false);
  });

  it('a room in the missing corner shares two interior walls and does not overlap', () => {
    const corner = createRoom('bedroom', 3000, 3000, 3000, 3000);
    const walls = buildWallsFromRooms([L(), corner], DEFAULT_SETTINGS);
    expect(walls.filter((w) => w.kind === 'interior')).toHaveLength(2);
    const p = createProject('t', createPlot(ft(60), ft(60)));
    p.plot.setbacks = { N: 0, S: 0, E: 0, W: 0 };
    const f = createFloor(0);
    f.rooms = [L(), corner].map((r) => ({ ...r, ...(r.points ? { points: r.points.map((q) => ({ x: q.x + 2000, y: q.y + 2000 })), x: r.x + 2000, y: r.y + 2000 } : { x: r.x + 2000, y: r.y + 2000 }) }));
    p.floors = [f];
    expect(validateProject(p).filter((i) => i.message.includes('overlap'))).toEqual([]);
    expect(floorAreas(f).enclosedMm2).toBe(36e6);
  });

  it('moving and rotating an irregular room keeps its shape', () => {
    const p = createProject('t', createPlot(ft(60), ft(60)));
    p.floors[0].rooms = [L()];
    useProjectStore.getState().load(p);
    const s = useProjectStore.getState();
    const id = activeFloor(s).rooms[0].id;
    s.updateRoom(id, { x: 1000, y: 500 });
    let r = activeFloor(useProjectStore.getState()).rooms[0];
    expect(r.points![0]).toEqual({ x: 1000, y: 500 });
    expect(roomArea(r)).toBe(27e6);
    useProjectStore.getState().select({ kind: 'room', id });
    useProjectStore.getState().rotateSelectedRoom();
    r = activeFloor(useProjectStore.getState()).rooms[0];
    expect(roomArea(r)).toBeCloseTo(27e6);
    useProjectStore.getState().updateRoom(id, { points: undefined });
    r = activeFloor(useProjectStore.getState()).rooms[0];
    expect(r.points).toBeUndefined();
    expect(r.w * r.d).toBe(36e6);
  });
});
