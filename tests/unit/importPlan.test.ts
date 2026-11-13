import { beforeEach, describe, expect, it } from 'vitest';
import { createPlot, createProject, createRoom } from '../../src/model/factory';
import { ft } from '../../src/model/units';
import { detectExtents, detectWallRects, rotationFor, type Pixels } from '../../src/import/planImage';
import { activeFloor, useProjectStore } from '../../src/store/projectStore';

/** White canvas with black rectangles drawn into it. */
function drawing(w: number, h: number, rects: [number, number, number, number][]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x0, y0, rw, rh] of rects)
    for (let y = y0; y < y0 + rh; y++)
      for (let x = x0; x < x0 + rw; x++) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 20;
      }
  return { width: w, height: h, data };
}

/** A 300×220 px house frame with 10 px walls, one inner wall, a thin dimension line and "text". */
function samplePlan(): Pixels {
  return drawing(400, 320, [
    [50, 40, 300, 10], // north wall
    [50, 250, 300, 10], // south wall
    [50, 40, 10, 220], // west wall
    [340, 40, 10, 220], // east wall
    [190, 50, 10, 120], // inner wall
    [30, 15, 340, 1], // thin dimension line above
    [60, 285, 2, 12], // thin "letters" below
    [70, 285, 2, 12],
  ]);
}

describe('plan drawing import', () => {
  it('finds the outer walls and ignores dimension lines and text', () => {
    expect(detectExtents(samplePlan(), 3)).toEqual({ x: 50, y: 40, w: 300, h: 220 });
  });

  it('returns null for a blank picture', () => {
    expect(detectExtents(drawing(50, 50, []), 2)).toBeNull();
  });

  it('turns the drawing so north points up', () => {
    expect([rotationFor('up'), rotationFor('down'), rotationFor('left'), rotationFor('right')]).toEqual([0, 180, 90, 270]);
  });

  it('detects wall rectangles at real-world size', () => {
    // crop exactly to the frame: 300 px = 9000 mm → 30 mm per px; 10 px walls ≈ 300 mm
    const full = samplePlan();
    const cropped: Pixels = { width: 300, height: 220, data: new Uint8ClampedArray(300 * 220 * 4) };
    for (let y = 0; y < 220; y++)
      for (let x = 0; x < 300; x++)
        for (let k = 0; k < 4; k++) cropped.data[(y * 300 + x) * 4 + k] = full.data[((y + 40) * 400 + x + 50) * 4 + k];
    const rects = detectWallRects(cropped, 9000, 6600);
    const long = rects.filter((r) => Math.max(r.w, r.d) > 2000);
    expect(long.length).toBeGreaterThanOrEqual(4);
    for (const r of rects) expect(Math.min(r.w, r.d)).toBeLessThan(450); // only wall-thick pieces
    const covered = rects.reduce((s, r) => s + r.w * r.d, 0);
    const expected = (2 * 9000 + 2 * 6600 + 3600) * 300; // rough wall area
    expect(covered / expected).toBeGreaterThan(0.7);
    expect(covered / expected).toBeLessThan(1.3);
  });
});

describe('placing a plan drawing in the plot', () => {
  const base = () => {
    const p = createProject('t', createPlot(ft(60), ft(58)));
    p.footprint = { x: ft(10), y: ft(8), w: ft(30), d: ft(30), locked: false };
    p.floors[0].rooms = [createRoom('living', ft(12), ft(10), ft(10), ft(10)), createRoom('garden', ft(45), ft(2), ft(10), ft(5))];
    return p;
  };
  beforeEach(() => useProjectStore.getState().load(base()));
  const args = (over = {}) => ({
    floorId: useProjectStore.getState().project.floors[0].id,
    name: 'Plan',
    dataUrl: 'data:image/png;base64,AAAA',
    w: ft(29),
    d: ft(41),
    clearOld: true,
    wallRects: [{ x: 0, y: 0, w: ft(29), d: 230 }],
    ...over,
  });

  it('never changes the plot; resizes the outline in place; replaces only the house plan', () => {
    const plotBefore = useProjectStore.getState().project.plot;
    useProjectStore.getState().placeHousePlan(args());
    const p = useProjectStore.getState().project;
    expect(p.plot).toBe(plotBefore);
    expect([p.footprint!.x, p.footprint!.y, p.footprint!.w, p.footprint!.d]).toEqual([ft(10), ft(8), ft(29), ft(41)]);
    const names = activeFloor(useProjectStore.getState()).rooms.map((r) => r.name);
    expect(names).toEqual(['Garden']); // living room inside the house removed, garden kept
    expect(p.floors[0].walls).toHaveLength(1);
    expect(p.underlays).toHaveLength(1);
    expect([p.underlays[0].x, p.underlays[0].w]).toEqual([ft(10), ft(29)]);
  });

  it('keeps the old plan when asked, and undo restores everything', () => {
    const before = useProjectStore.getState().project;
    useProjectStore.getState().placeHousePlan(args({ clearOld: false, wallRects: [] }));
    expect(activeFloor(useProjectStore.getState()).rooms).toHaveLength(2);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project).toBe(before);
  });

  it('centres the house in the buildable area when there is no outline yet', () => {
    const p = base();
    p.footprint = null;
    p.plot.setbacks = { N: ft(10), S: ft(10), E: ft(5), W: ft(5) };
    useProjectStore.getState().load(p);
    useProjectStore.getState().placeHousePlan(args({ clearOld: false }));
    const f = useProjectStore.getState().project.footprint!;
    expect(f.x / 304.8).toBeCloseTo(15.5); // (60 − 29) / 2
    expect(f.y / 304.8).toBeCloseTo(8.5); // 10 + (38 − 41)/2 → doesn't fit setbacks, so plot-centred: (58 − 41)/2
  });

  it('the drawing moves with the house', () => {
    useProjectStore.getState().placeHousePlan(args());
    useProjectStore.getState().moveHouse(ft(2), ft(1));
    const u = useProjectStore.getState().project.underlays[0];
    expect(u.x).toBeCloseTo(ft(12), 1);
    expect(u.y).toBeCloseTo(ft(9), 1);
  });
});
