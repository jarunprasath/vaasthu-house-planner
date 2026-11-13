/**
 * Building-regulation presets. Each preset only FILLS the editable setback fields; nothing is enforced.
 *
 * Tamil Nadu: Tamil Nadu Combined Development and Building Rules, 2019, rule 35(1)(a), Table E
 * ("Non High Rise buildings up to 16 dwellings"), as amended by G.O. Ms. No. 16 (31-01-2020):
 * https://tcp.tn.gov.in/storage/app/document/27.pdf
 * Later amendments — including G.O. (Ms.) No. 194 of 26-10-2026 — may change these values; the local
 * planning authority's current rules always take precedence.
 */
import type { Side } from './types';

export type AreaType = 'other' | 'ews' | 'continuous';

export interface PresetInput {
  areaType: AreaType;
  /** Width of the road on each side that has one (mm). */
  roads: { side: Side; widthMm: number }[];
  /** Plot width measured along the main road (mm). */
  plotWidthMm: number;
  /** Building height (mm). */
  heightMm: number;
}

export interface PresetResult {
  setbacks: Record<Side, number>;
  notes: string[];
  /** False when the input is outside what this preset covers. */
  applicable: boolean;
}

export const TN_SOURCE = {
  title: 'Tamil Nadu Combined Development and Building Rules, 2019 — rule 35(1)(a), Table E (non high-rise, up to 16 dwellings)',
  version: 'as amended by G.O. Ms. No. 16, 31 January 2020',
  url: 'https://tcp.tn.gov.in/storage/app/document/27.pdf',
  caution:
    'Later amendments, including G.O. (Ms.) No. 194 of 26 October 2026, may have changed these values. Always confirm with your local planning authority before applying for approval.',
};

const M = 1000;
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Front setback by abutting road width (Table E(i), other areas). */
export function tnFront(areaType: AreaType, roadWidthMm: number): number {
  if (areaType === 'continuous') return 1.5 * M;
  if (areaType === 'ews') return 1.0 * M;
  const w = roadWidthMm / M;
  if (w <= 9) return 1.5 * M;
  if (w <= 18) return 3 * M;
  if (w <= 30.5) return 4.5 * M;
  return 6 * M;
}

export function tamilNaduRule35(input: PresetInput): PresetResult {
  const notes: string[] = [];
  const h = input.heightMm / M;
  const plotW = input.plotWidthMm / M;
  const setbacks: Record<Side, number> = { N: 0, S: 0, E: 0, W: 0 };
  if (h > 12) {
    return {
      setbacks,
      notes: ['This preset covers buildings up to 12 m high. Taller buildings fall under other tables of the rules — enter setbacks from the rules for your height.'],
      applicable: false,
    };
  }
  if (input.roads.length === 0) notes.push('No road is set on the plot, so no front setback was applied. Add the road in Plot settings first.');

  // Front: every side facing a road.
  for (const r of input.roads) setbacks[r.side] = tnFront(input.areaType, r.widthMm);

  // Rear: opposite the widest road, if that side has no road.
  const main = [...input.roads].sort((a, b) => b.widthMm - a.widthMm)[0];
  const rear = main ? OPP[main.side] : null;
  const roadSides = new Set(input.roads.map((r) => r.side));
  const sideSides = (['N', 'E', 'S', 'W'] as Side[]).filter((s) => !roadSides.has(s) && s !== rear);

  if (input.areaType === 'continuous') {
    notes.push('Continuous building area: side and rear setbacks are nil in Table E.');
  } else {
    // Side setbacks (Table E(ii))
    let either = 0;
    let oneSide = 0;
    if (h <= 7) {
      if (plotW <= 9) oneSide = 1 * M;
      else either = 1 * M; // or 2 m on one side
    } else {
      if (plotW <= 6) oneSide = 1 * M;
      else if (plotW <= 9) oneSide = 1.5 * M;
      else either = 1.5 * M; // or 3 m on one side
    }
    if (either) {
      for (const s of sideSides) setbacks[s] = either;
      notes.push(`Side setback: ${either / M} m on either side (the rule also allows ${(either * 2) / M} m on one side instead).`);
    } else if (sideSides.length) {
      setbacks[sideSides[0]] = oneSide;
      notes.push(`Side setback: ${oneSide / M} m on one side — applied to the ${sideSides[0]} side; change it if you prefer the other side.`);
    }
    // Rear setback (Table E(iii))
    if (rear && !roadSides.has(rear)) setbacks[rear] = h <= 7 ? 0 : 1.5 * M;
    if (rear && !roadSides.has(rear)) notes.push(`Rear setback (${rear} side): ${h <= 7 ? 'nil for buildings up to 7 m' : '1.5 m for buildings above 7 m'}.`);
  }
  notes.push('Normally permissible FSI in this table: 2.0. Plot coverage is not stated in this table.');
  return { setbacks, notes, applicable: true };
}
