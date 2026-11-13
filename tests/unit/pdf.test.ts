import { describe, expect, it } from 'vitest';
import { buildPdf, chooseScale } from '../../src/export/pdf';
import { createSampleProject } from '../../src/templates/sample60x58';

describe('pdf export', () => {
  const p = createSampleProject();
  const base = { includeSite: true, includeSchedule: true, revision: 3, scale: 0, preparedBy: '' };

  it('picks the largest standard scale that fits', () => {
    expect(chooseScale({ x: 0, y: 0, w: 20000, d: 15000 }, 300, 200)).toBe(75);
    expect(chooseScale({ x: 0, y: 0, w: 20000, d: 16000 }, 300, 200)).toBe(100);
    expect(chooseScale({ x: 0, y: 0, w: 20000, d: 15000 }, 150, 100)).toBe(150);
  });

  it.each(['a4', 'a3', 'a2'] as const)('builds site + floors + schedule on %s', (paper) => {
    const doc = buildPdf(p, { ...base, paper, floorIds: p.floors.map((f) => f.id) });
    // the schedule paginates on small paper (31 openings → 2 pages on A4)
    expect(doc.getNumberOfPages()).toBe(1 + p.floors.length + (paper === 'a4' ? 2 : 1));
    const text = doc.output();
    expect(text).toContain('PRELIMINARY - NOT FOR CONSTRUCTION');
    expect(text).toContain('R3');
  });

  it('draws the 60x58 sample site plan at 1:100 on A3', () => {
    const text = buildPdf(p, { ...base, paper: 'a3', floorIds: [] , includeSchedule: false}).output();
    expect(text).toContain('1:100 on A3');
  });

  it('adds the Vaasthu orientation page when asked', () => {
    const doc = buildPdf(p, { ...base, paper: 'a3', floorIds: [], includeSite: false, includeSchedule: false, includeVaasthu: true });
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output()).toContain('Advisory score');
  });

  it('refuses an empty selection with a clear message', () => {
    expect(() => buildPdf(p, { ...base, paper: 'a4', includeSite: false, includeSchedule: false, floorIds: [] })).toThrow(
      'Choose at least one page',
    );
  });
});
