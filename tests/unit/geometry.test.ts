import { describe, expect, it } from 'vitest';
import { edgeSide, ensureClockwise, insetPolygon, pointInPolygon, polygonArea, rectOverlapArea, zoneOf } from '../../src/model/geometry';
import { unionArea } from '../../src/model/areas';

const square = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];

describe('geometry', () => {
  it('identifies compass side of clockwise edges (y down, north up)', () => {
    expect(edgeSide(square[0], square[1])).toBe('N');
    expect(edgeSide(square[1], square[2])).toBe('E');
    expect(edgeSide(square[2], square[3])).toBe('S');
    expect(edgeSide(square[3], square[0])).toBe('W');
  });

  it('insets by per-side setbacks', () => {
    const inset = insetPolygon(square, { N: 10, S: 5, E: 3, W: 7 });
    expect(inset.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [7, 10],
      [97, 10],
      [97, 75],
      [7, 75],
    ]);
  });

  it('handles counter-clockwise input', () => {
    const ccw = [...square].reverse();
    expect(ensureClockwise(ccw)).toEqual(square);
    expect(polygonArea(ccw)).toBe(8000);
  });

  it('point in polygon including the boundary', () => {
    expect(pointInPolygon({ x: 50, y: 40 }, square)).toBe(true);
    expect(pointInPolygon({ x: 100, y: 40 }, square)).toBe(true);
    expect(pointInPolygon({ x: 101, y: 40 }, square)).toBe(false);
  });

  it('overlap area ignores touching rectangles', () => {
    expect(rectOverlapArea({ x: 0, y: 0, w: 10, d: 10 }, { x: 10, y: 0, w: 10, d: 10 })).toBe(0);
    expect(rectOverlapArea({ x: 0, y: 0, w: 10, d: 10 }, { x: 5, y: 5, w: 10, d: 10 })).toBe(25);
  });

  it('union area does not double count overlaps', () => {
    expect(unionArea([{ x: 0, y: 0, w: 10, d: 10 }, { x: 5, y: 5, w: 10, d: 10 }])).toBe(175);
    expect(unionArea([{ x: 0, y: 0, w: 10, d: 10 }, { x: 0, y: 0, w: 10, d: 10 }])).toBe(100);
  });

  it('zones on a 3×3 grid', () => {
    const box = { x: 0, y: 0, w: 90, d: 90 };
    expect(zoneOf({ x: 80, y: 5 }, box)).toBe('NE');
    expect(zoneOf({ x: 5, y: 85 }, box)).toBe('SW');
    expect(zoneOf({ x: 45, y: 45 }, box)).toBe('C');
  });
});
