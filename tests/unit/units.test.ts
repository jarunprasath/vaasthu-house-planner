import { describe, expect, it } from 'vitest';
import { formatArea, formatLength, fromMm, MM_PER_FOOT, MM_PER_INCH, parseLength, toMm } from '../../src/model/units';

describe('units', () => {
  it('round-trips every unit', () => {
    for (const u of ['ft', 'in', 'm', 'cm'] as const) expect(fromMm(toMm(12.5, u), u)).toBeCloseTo(12.5, 9);
  });

  it('formats feet and inches', () => {
    expect(formatLength(12 * MM_PER_FOOT + 6 * MM_PER_INCH, 'ft')).toBe(`12'-6"`);
    expect(formatLength(6 * MM_PER_INCH, 'ft')).toBe(`6"`);
    expect(formatLength(11 * MM_PER_INCH + 13, 'ft')).toBe(`1'-0"`); // rounds up to a full foot
    expect(formatLength(3810, 'm')).toBe('3.81 m');
    expect(formatLength(3810, 'cm')).toBe('381 cm');
  });

  it('formats areas', () => {
    expect(formatArea(100 * MM_PER_FOOT * MM_PER_FOOT, 'ft')).toBe('100 sq ft');
    expect(formatArea(12.345e6, 'm')).toBe('12.35 m²');
  });

  const f = (ftv: number, inch = 0) => ftv * MM_PER_FOOT + inch * MM_PER_INCH;
  it.each([
    ['12', 'ft', f(12)],
    ['12.5', 'ft', f(12.5)],
    [`12'6"`, 'ft', f(12, 6)],
    [`12'-6"`, 'ft', f(12, 6)],
    [`12' 6`, 'ft', f(12, 6)],
    ['12 ft 6 in', 'ft', f(12, 6)],
    ['6"', 'ft', f(0, 6)],
    ['6in', 'm', f(0, 6)],
    ['3.5m', 'ft', 3500],
    ['350 cm', 'ft', 3500],
    ['3500mm', 'ft', 3500],
    ['2.4', 'm', 2400],
    ['120', 'cm', 1200],
  ] as const)('parses %s (%s)', (input, unit, mm) => {
    expect(parseLength(input, unit)).toBeCloseTo(mm, 6);
  });

  it.each(['', 'abc', '12x', '3 4 5', '--3'])('rejects %j', (input) => {
    expect(parseLength(input, 'ft')).toBeNull();
  });
});
