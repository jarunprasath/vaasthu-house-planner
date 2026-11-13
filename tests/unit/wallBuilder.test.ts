import { describe, expect, it } from 'vitest';
import { createOpening, createRoom, DEFAULT_SETTINGS } from '../../src/model/factory';
import { buildWallsFromRooms, rehostOpenings } from '../../src/model/wallBuilder';

describe('wall builder', () => {
  const rooms = [createRoom('bedroom', 0, 0, 3000, 3000), createRoom('kitchen', 3000, 0, 3000, 3000)];

  it('makes one shared interior wall and merged exterior walls', () => {
    const walls = buildWallsFromRooms(rooms, DEFAULT_SETTINGS);
    expect(walls).toHaveLength(5);
    const interior = walls.filter((w) => w.kind === 'interior');
    expect(interior).toHaveLength(1);
    expect(interior[0].a.x).toBe(3000);
    expect(interior[0].thicknessMm).toBe(DEFAULT_SETTINGS.defaultInteriorWallMm);
    const top = walls.find((w) => w.a.y === 0 && w.b.y === 0)!;
    expect(top.b.x - top.a.x).toBe(6000);
  });

  it('splits an edge that is partly shared', () => {
    const r = [createRoom('living', 0, 0, 6000, 3000), createRoom('bedroom', 0, 3000, 3000, 3000)];
    const walls = buildWallsFromRooms(r, DEFAULT_SETTINGS);
    const at3000 = walls.filter((w) => w.a.y === 3000 && w.b.y === 3000);
    expect(at3000.map((w) => w.kind).sort()).toEqual(['exterior', 'interior']);
  });

  it('gives no walls to open areas', () => {
    expect(buildWallsFromRooms([createRoom('garden', 0, 0, 1000, 1000)], DEFAULT_SETTINGS)).toHaveLength(0);
  });

  it('re-hosts openings onto rebuilt walls and drops orphans', () => {
    const walls1 = buildWallsFromRooms(rooms, DEFAULT_SETTINGS);
    const interior = walls1.find((w) => w.kind === 'interior')!;
    const door = createOpening('door', interior.id, 1500);
    const orphan = createOpening('door', 'missing', 100);
    const walls2 = buildWallsFromRooms(rooms, DEFAULT_SETTINGS);
    const { kept, dropped } = rehostOpenings([door, orphan], walls1, walls2);
    expect(kept).toHaveLength(1);
    expect(kept[0].wallId).toBe(walls2.find((w) => w.kind === 'interior')!.id);
    expect(kept[0].offsetMm).toBeCloseTo(1500);
    expect(dropped).toEqual([orphan]);
  });
});
