import { describe, expect, it } from 'vitest';
import { tamilNaduRule35, tnFront } from '../../src/model/regulations';
import { ft } from '../../src/model/units';

// Values from TNCDBR 2019 rule 35(1)(a) Table E as amended by G.O. Ms. No. 16 (31-01-2020).
describe('Tamil Nadu rule 35(1)(a) preset', () => {
  it('front setback by road width', () => {
    expect([6, 9, 12, 18, 24, 30.5, 40].map((w) => tnFront('other', w * 1000) / 1000)).toEqual([1.5, 1.5, 3, 3, 4.5, 4.5, 6]);
    expect(tnFront('ews', 12000)).toBe(1000);
  });

  it('two roads (east and west), wide plot, single storey: fronts on both roads, 1 m either side', () => {
    const r = tamilNaduRule35({ areaType: 'other', roads: [{ side: 'E', widthMm: ft(20) }, { side: 'W', widthMm: ft(20) }], plotWidthMm: ft(58), heightMm: 3500 });
    expect(r.setbacks).toEqual({ E: 1500, W: 1500, N: 1000, S: 1000 });
  });

  it('north road, narrow plot, two storeys: side on one side, rear 1.5 m', () => {
    const r = tamilNaduRule35({ areaType: 'other', roads: [{ side: 'N', widthMm: 12000 }], plotWidthMm: 8000, heightMm: 9000 });
    expect(r.setbacks.N).toBe(3000);
    expect(r.setbacks.S).toBe(1500);
    expect(r.setbacks.E + r.setbacks.W).toBe(1500);
  });

  it('refuses buildings above 12 m', () => {
    expect(tamilNaduRule35({ areaType: 'other', roads: [], plotWidthMm: 10000, heightMm: 15000 }).applicable).toBe(false);
  });
});
