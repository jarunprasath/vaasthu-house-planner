import { describe, expect, it } from 'vitest';
import { ft } from '../../src/model/units';
import { floorAreas, groundCoveragePercent } from '../../src/model/areas';
import { areaValue } from '../../src/model/units';
import { TEMPLATES } from '../../src/templates';
import { createSampleProject } from '../../src/templates/sample60x58';
import { createEast40x30Project } from '../../src/templates/east40x30';
import { createEast60x58Project } from '../../src/templates/east60x58';
import { evaluate } from '../../src/vaasthu/engine';
import { validateProject } from '../../src/validation/validate';

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s builds without errors', (_id, t) => {
    const p = t.create();
    const errors = validateProject(p).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('sample meets the brief', () => {
    const p = createSampleProject();
    const g = p.floors.find((f) => f.level === 0)!;
    const a = floorAreas(g);
    const sqft = areaValue(a.enclosedMm2, 'ft');
    expect(sqft).toBeGreaterThanOrEqual(1100);
    expect(sqft).toBeLessThanOrEqual(1200);
    expect(p.plot.roads.map((r) => r.side).sort()).toEqual(['E', 'W']);
    expect(p.plot.setbacks.N).toBeGreaterThan(p.plot.setbacks.S);
    expect(g.rooms.filter((r) => r.type.includes('bedroom'))).toHaveLength(2);
    expect(g.openings.some((o) => o.label.startsWith('MD'))).toBe(true);
    expect(p.siteOpenings).toHaveLength(2);
    expect(groundCoveragePercent(p)).toBeGreaterThan(30);
  });

  it('sample reports only the known, intentional warning', () => {
    const issues = validateProject(createSampleProject());
    expect(issues.map((i) => i.message)).toEqual([
      expect.stringContaining('Common bath (Ground floor) has no window'),
    ]);
  });

  it('east-facing 40×30 meets its brief', () => {
    const p = createEast40x30Project();
    const g = p.floors.find((f) => f.level === 0)!;
    expect(p.plot.roads.map((r) => r.side)).toEqual(['E']);
    expect(g.rooms.filter((r) => r.type.includes('bedroom'))).toHaveLength(2);
    for (const t of ['pooja', 'portico', 'sitout'] as const) expect(g.rooms.some((r) => r.type === t)).toBe(true);
    expect(validateProject(p)).toEqual([]);
    const v = evaluate(p);
    expect(v.centreIssues).toEqual([]);
    expect(v.score).toBeGreaterThanOrEqual(90);
    const zone = (name: string) => v.items.find((i) => i.name === name)?.zone;
    expect(zone('MD (main door)')).toBe('NE');
    expect(zone('Pooja room')).toBe('NE');
    expect(zone('Kitchen')).toBe('SE');
    expect(zone('Master bedroom')).toBe('SW');
  });

  it('east-facing 40×30 house on 60×58 plot meets its brief', () => {
    const p = createEast60x58Project();
    const g = p.floors.find((f) => f.level === 0)!;
    expect(p.footprint).toMatchObject({ w: ft(40), d: ft(30) });
    const fp = p.footprint!;
    expect(fp.x).toBeGreaterThanOrEqual(ft(5));
    expect(ft(58) - (fp.y + fp.d)).toBeGreaterThanOrEqual(ft(5) - 1);
    expect(fp.y).toBeGreaterThan(ft(58) - (fp.y + fp.d)); // more open land north than south
    expect(g.rooms.filter((r) => r.type.includes('bedroom'))).toHaveLength(2);
    for (const t of ['pooja', 'portico', 'sitout', 'staircase', 'kitchen', 'living'] as const) expect(g.rooms.some((r) => r.type === t)).toBe(true);
    expect(p.floors).toHaveLength(2);
    expect(validateProject(p)).toEqual([]);
    const v = evaluate(p);
    expect(v.centreIssues).toEqual([]);
    expect(v.score).toBeGreaterThanOrEqual(90);
    const zone = (name: string) => v.items.find((i) => i.name === name)?.zone;
    expect(zone('MD (main door)')).toBe('NE');
    expect(zone('Pooja room')).toBe('NE');
    expect(zone('Master bedroom')).toBe('SW');
  });
});
