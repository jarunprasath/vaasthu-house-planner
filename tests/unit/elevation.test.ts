import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../../src/templates/sample60x58';
import { computeElevation, isBuildingPart } from '../../src/model/elevation';
import { applyStyle } from '../../src/model/styles';
import { buildParts } from '../../src/three/buildModel';
import { migrateProject } from '../../src/storage/projectFile';
import { produce } from 'immer';

describe('elevations', () => {
  const p = createSampleProject();

  it('south and north elevations span the house width, east and west its depth', () => {
    const fp = p.footprint!;
    const s = computeElevation(p, 'S');
    const e = computeElevation(p, 'E');
    // walls are centre-lines, so allow for half the wall thickness and parapet each side
    expect(s.h1 - s.h0).toBeGreaterThan(fp.w / 1000 - 0.5);
    expect(s.h1 - s.h0).toBeLessThan(fp.w / 1000 + 1.5);
    expect(e.h1 - e.h0).toBeGreaterThan(fp.d / 1000 - 0.5);
    expect(e.h1 - e.h0).toBeLessThan(fp.d / 1000 + 1.5);
    expect(s.top).toBeGreaterThan(3);
    expect(s.levels[0]).toEqual({ label: 'Ground', v: 0 });
  });

  it('north view is the mirror of the south view', () => {
    const s = computeElevation(p, 'S');
    const n = computeElevation(p, 'N');
    expect(n.h0).toBeCloseTo(-s.h1, 3);
    expect(n.h1).toBeCloseTo(-s.h0, 3);
  });

  it('leaves out the compound wall and ground features', () => {
    const parts = buildParts(p);
    expect(parts.some((x) => !isBuildingPart(x))).toBe(true);
    expect(parts.filter(isBuildingPart).every((x) => x.kind !== 'site' && x.kind !== 'gate')).toBe(true);
  });

  it('style presets add sunshades and bands, and a gable roof raises the top', () => {
    const flat = computeElevation(p, 'E').top;
    const styled = produce(p, (d) => applyStyle(d, 'traditional'));
    expect(styled.exterior.sunshadeMm).toBe(600);
    const parts = buildParts(styled);
    expect(parts.filter((x) => x.kind === 'trim').length).toBeGreaterThan(5);
    expect(parts.some((x) => x.shape === 'gable')).toBe(true);
    expect(computeElevation(styled, 'E').top).toBeGreaterThan(flat - 1);
  });

  it('old project files get default exterior settings', () => {
    const { exterior: _e, ...old } = p;
    const m = migrateProject(old as never);
    expect(m.exterior).toEqual({ style: 'custom', sunshadeMm: 0, bands: false, bandColor: '#ffffff' });
  });
});
