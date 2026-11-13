import { describe, expect, it } from 'vitest';
import { createFloor, createPlot, createProject, createRoom } from '../../src/model/factory';
import { ft } from '../../src/model/units';
import { validateProject } from '../../src/validation/validate';

function projectWith(rooms: ReturnType<typeof createRoom>[]) {
  const p = createProject('t', createPlot(ft(30), ft(40)));
  p.plot.setbacks = { N: ft(5), S: ft(3), E: ft(3), W: ft(3) };
  const f = createFloor(0);
  f.rooms = rooms;
  p.floors = [f];
  return p;
}

describe('validation', () => {
  it('passes a room inside the setbacks', () => {
    expect(validateProject(projectWith([createRoom('living', ft(5), ft(8), ft(10), ft(10))]))).toEqual([]);
  });

  it('flags a room outside the plot', () => {
    const issues = validateProject(projectWith([createRoom('living', ft(25), ft(8), ft(10), ft(10))]));
    expect(issues.map((i) => i.message)).toContainEqual(expect.stringContaining('outside the plot'));
  });

  it('names the setback that is encroached', () => {
    const issues = validateProject(projectWith([createRoom('living', ft(5), ft(2), ft(10), ft(10))]));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('north setback');
  });

  it('allows a garden in the setback', () => {
    expect(validateProject(projectWith([createRoom('garden', 0, 0, ft(10), ft(3))]))).toEqual([]);
  });

  it('flags overlapping rooms', () => {
    const issues = validateProject(
      projectWith([createRoom('living', ft(5), ft(8), ft(10), ft(10)), createRoom('bedroom', ft(10), ft(10), ft(10), ft(10))]),
    );
    expect(issues.some((i) => i.message.includes('overlap'))).toBe(true);
  });

  it('checks floors and coverage limits', () => {
    const p = projectWith([createRoom('living', ft(5), ft(8), ft(20), ft(20))]);
    p.plot.maxCoveragePercent = 25;
    p.plot.maxFloors = 0;
    const issues = validateProject(p);
    expect(issues.some((i) => i.message.includes('coverage'))).toBe(true);
  });
});
