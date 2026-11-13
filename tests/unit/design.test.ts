import { describe, expect, it } from 'vitest';
import { createFloor, createOpening, createRoom, createWall } from '../../src/model/factory';
import { itemBounds } from '../../src/model/catalog';
import { rectOverlapArea } from '../../src/model/geometry';
import { DEFAULT_KITCHEN, generateKitchen, kitchenChecks } from '../../src/design/kitchen';
import { DEFAULT_BATHROOM, generateBathroom } from '../../src/design/bathroom';
import { frontFacing, userFacing } from '../../src/design/common';
import { createItem } from '../../src/model/catalog';
import type { Floor, Room } from '../../src/model/types';

/** A walled rectangular room with a door on the west wall and a window on the east wall. */
function setup(w: number, d: number, type: 'kitchen' | 'bathroom'): { floor: Floor; room: Room } {
  const floor = createFloor(0);
  const room = createRoom(type, 1000, 1000, w, d);
  floor.rooms.push(room);
  const c = [
    { x: 1000, y: 1000 },
    { x: 1000 + w, y: 1000 },
    { x: 1000 + w, y: 1000 + d },
    { x: 1000, y: 1000 + d },
  ];
  const walls = c.map((p, i) => createWall(p, c[(i + 1) % 4], 'exterior', 230, 3000));
  floor.walls.push(...walls);
  // west wall runs from SW corner (index 3) to NW corner; door near its south end
  const door = createOpening('door', walls[3].id, 700);
  door.widthMm = 900;
  const win = createOpening('window', walls[1].id, d / 2);
  win.widthMm = 1200;
  floor.openings.push(door, win);
  return { floor, room };
}

describe('item facing helpers', () => {
  it('front and user facing follow the rotation', () => {
    const it0 = createItem('hob', 0, 0, 0);
    expect(frontFacing(it0)).toBe('S');
    expect(userFacing(it0)).toBe('N');
    expect(userFacing({ ...it0, rotation: 90 })).toBe('E');
    expect(userFacing({ ...it0, rotation: 270 })).toBe('W');
  });
});

describe('kitchen generator', () => {
  for (const layout of ['straight', 'L', 'U', 'parallel'] as const) {
    it(`${layout}: places sink and hob inside the room without overlaps`, () => {
      const { floor, room } = setup(3000, 3600, 'kitchen');
      const { items } = generateKitchen(floor, room, { ...DEFAULT_KITCHEN, layout });
      expect(items.some((i) => i.type === 'hob')).toBe(true);
      expect(items.some((i) => i.type === 'sink_unit')).toBe(true);
      const base = items.filter((i) => !['wall_cabinet', 'chimney'].includes(i.type));
      for (const it of base) {
        const b = itemBounds(it);
        expect(b.x).toBeGreaterThanOrEqual(room.x - 1);
        expect(b.y).toBeGreaterThanOrEqual(room.y - 1);
        expect(b.x + b.w).toBeLessThanOrEqual(room.x + room.w + 1);
        expect(b.y + b.d).toBeLessThanOrEqual(room.y + room.d + 1);
      }
      for (let i = 0; i < base.length; i++)
        for (let j = i + 1; j < base.length; j++) expect(rectOverlapArea(itemBounds(base[i]), itemBounds(base[j]))).toBeLessThan(10);
    });
  }

  it('puts the hob on the east wall (cook faces east) but not under the east window', () => {
    const { floor, room } = setup(3000, 3600, 'kitchen');
    const { items, notes } = generateKitchen(floor, room, { ...DEFAULT_KITCHEN, layout: 'L' });
    const hob = items.find((i) => i.type === 'hob')!;
    expect(userFacing(hob)).toBe('E');
    expect(notes.some((n) => n.text.includes('under a window'))).toBe(false);
    // sink goes under the window
    const sink = items.find((i) => i.type === 'sink_unit')!;
    expect(userFacing(sink)).toBe('E');
    expect(Math.abs(sink.y - (room.y + room.d / 2))).toBeLessThan(10);
  });

  it('flags a hob placed under a window', () => {
    const { floor, room } = setup(3000, 3600, 'kitchen');
    const hob = createItem('hob', room.x + room.w - 57 - 300, room.y + room.d / 2, 90);
    const notes = kitchenChecks(floor, room, [hob]);
    expect(notes.some((n) => n.level === 'warning' && n.text.includes('under a window'))).toBe(true);
  });

  it('keeps counters out of the doorway', () => {
    const { floor, room } = setup(3000, 3600, 'kitchen');
    const { items } = generateKitchen(floor, room, { ...DEFAULT_KITCHEN, layout: 'U' });
    // door on west wall centred 700 mm from its south end
    const doorRect = { x: room.x - 100, y: room.y + room.d - 700 - 450, w: 700, d: 900 };
    for (const it of items.filter((i) => i.type !== 'wall_cabinet')) expect(rectOverlapArea(itemBounds(it), doorRect)).toBeLessThan(10);
  });

  it('refuses an island in a small kitchen', () => {
    const { floor, room } = setup(2400, 3000, 'kitchen');
    const { items, notes } = generateKitchen(floor, room, { ...DEFAULT_KITCHEN, layout: 'island' });
    expect(items.some((i) => i.type === 'island')).toBe(false);
    expect(notes.some((n) => n.text.includes('too small for an island'))).toBe(true);
  });
});

describe('bathroom generator', () => {
  it('fits a toilet, shower and basin in a 1.8 × 2.4 m bathroom', () => {
    const { floor, room } = setup(1800, 2400, 'bathroom');
    const { items } = generateBathroom(floor, room, DEFAULT_BATHROOM);
    const types = items.map((i) => i.type);
    expect(types).toContain('wc_western');
    expect(types).toContain('shower');
    expect(types).toContain('floor_drain');
    expect(types).toContain('exhaust_fan');
    const floorItems = items.filter((i) => ['wc_western', 'shower', 'washbasin'].includes(i.type));
    for (let i = 0; i < floorItems.length; i++)
      for (let j = i + 1; j < floorItems.length; j++) expect(rectOverlapArea(itemBounds(floorItems[i]), itemBounds(floorItems[j]))).toBeLessThan(10);
  });

  it('prefers a toilet where the user faces north or south', () => {
    const { floor, room } = setup(1800, 2400, 'bathroom');
    const { items } = generateBathroom(floor, room, DEFAULT_BATHROOM);
    const wc = items.find((i) => i.type === 'wc_western')!;
    expect(['N', 'S']).toContain(frontFacing(wc));
  });
});
