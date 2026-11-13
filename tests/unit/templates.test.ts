import { describe, expect, it } from 'vitest';
import { floorAreas, groundCoveragePercent } from '../../src/model/areas';
import { areaValue } from '../../src/model/units';
import { TEMPLATES } from '../../src/templates';
import { createSampleProject } from '../../src/templates/sample60x58';
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
});
