import { beforeEach, describe, expect, it } from 'vitest';
import { createPlot, createProject, createRoom } from '../../src/model/factory';
import { clearances, defaultFootprint, houseContents, openLandArea } from '../../src/model/footprint';
import { ft } from '../../src/model/units';
import { buildWallsFromRooms } from '../../src/model/wallBuilder';
import { activeFloor, useProjectStore } from '../../src/store/projectStore';
import { parseProjectFile, serializeProject } from '../../src/storage/projectFile';
import { createSampleProject } from '../../src/templates/sample60x58';
import { validateProject } from '../../src/validation/validate';

const toFt = (mm: number) => Math.round((mm / 304.8) * 100) / 100;

/** 60' east–west × 58' north–south plot with a 29' × 41' house, 10' from the west and 8' from the north. */
function example() {
  const p = createProject('t', createPlot(ft(60), ft(58)));
  p.plot.setbacks = { N: ft(5), S: ft(5), E: ft(5), W: ft(5) };
  p.footprint = { x: ft(10), y: ft(8), w: ft(29), d: ft(41), locked: false };
  const g = p.floors[0];
  g.rooms = [
    createRoom('living', ft(10), ft(8), ft(29), ft(20)),
    createRoom('bedroom', ft(10), ft(28), ft(29), ft(21)),
    createRoom('garden', ft(45), ft(2), ft(10), ft(10)),
  ];
  g.walls = buildWallsFromRooms(g.rooms, p.settings);
  return p;
}

describe('house outline', () => {
  it('measures the open gap on every side', () => {
    const gaps = Object.fromEntries(clearances(example().footprint!, example().plot.boundary).map((c) => [c.side, toFt(c.mm)]));
    expect(gaps).toEqual({ N: 8, E: 21, S: 9, W: 10 }); // 60 − 10 − 29 = 21, 58 − 8 − 41 = 9
  });

  it('reports the open land left', () => {
    expect(openLandArea(example()) / 304.8 ** 2).toBeCloseTo(60 * 58 - 29 * 41, 6); // 2,291 sq ft
  });

  it('finds the rooms and walls inside it, but not the garden', () => {
    const p = example();
    const inside = houseContents(p, p.footprint!);
    expect(inside.rooms.size).toBe(2);
    expect(inside.walls.size).toBe(p.floors[0].walls.length);
  });

  it('defaults to the extent of the existing building rooms', () => {
    const p = example();
    const f = defaultFootprint({ ...p, footprint: null });
    expect([f.x, f.y, f.w, f.d].map(toFt)).toEqual([10, 8, 29, 41]);
  });

  it('is kept in project files, and older files load without one', () => {
    const p = example();
    expect(parseProjectFile(serializeProject(p)).footprint).toEqual(p.footprint);
    const old = JSON.parse(serializeProject(p));
    delete old.footprint;
    expect(parseProjectFile(JSON.stringify(old)).footprint).toBeNull();
  });

  it('flags an outline outside the plot, in a setback, and rooms sticking out', () => {
    const p = example();
    p.footprint = { ...p.footprint!, x: ft(40) };
    expect(validateProject(p).map((i) => i.message)).toContainEqual('The house outline extends outside the plot.');
    p.footprint = { ...p.footprint!, x: ft(2) };
    expect(validateProject(p).map((i) => i.message)).toContainEqual(expect.stringContaining('house outline is inside the west setback'));
    expect(validateProject(p).some((i) => i.message.includes('sticks out of the house outline'))).toBe(true);
  });

  it('the sample house sits inside its outline with no new warnings', () => {
    const msgs = validateProject(createSampleProject()).map((i) => i.message);
    expect(msgs.filter((m) => m.includes('outline'))).toEqual([]);
  });
});

describe('moving the house', () => {
  beforeEach(() => useProjectStore.getState().load(example()));

  it('moves the outline with its rooms and walls, leaves the garden, and undoes in one step', () => {
    const before = useProjectStore.getState().project;
    useProjectStore.getState().moveHouse(ft(5), ft(-3));
    const after = useProjectStore.getState().project;
    expect(toFt(after.footprint!.x)).toBe(15);
    expect(toFt(after.footprint!.y)).toBe(5);
    const rooms = activeFloor(useProjectStore.getState()).rooms;
    expect(toFt(rooms[0].x)).toBe(15);
    expect(toFt(rooms[2].x)).toBe(45); // garden stays
    expect(after.floors[0].walls[0].a.x - before.floors[0].walls[0].a.x).toBeCloseTo(ft(5));
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project).toBe(before);
  });

  it('does not move when locked', () => {
    useProjectStore.getState().updateFootprint({ locked: true });
    const p = useProjectStore.getState().project;
    useProjectStore.getState().moveHouse(ft(5), 0);
    expect(useProjectStore.getState().project).toBe(p);
  });

  it('resizing the outline does not move rooms', () => {
    useProjectStore.getState().updateFootprint({ w: ft(41), d: ft(29) });
    const s = useProjectStore.getState();
    expect(toFt(s.project.footprint!.w)).toBe(41);
    expect(toFt(activeFloor(s).rooms[0].x)).toBe(10);
  });

  it('removing the outline keeps the rooms', () => {
    const s = useProjectStore.getState();
    s.select({ kind: 'footprint', id: 'footprint' });
    s.deleteSelection();
    expect(useProjectStore.getState().project.footprint).toBeNull();
    expect(activeFloor(useProjectStore.getState()).rooms).toHaveLength(3);
  });
});
