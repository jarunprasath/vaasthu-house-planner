/**
 * Exterior style presets. Each preset only sets editable values (wall and roof colours, roof type,
 * sunshades, bands) — they are design starting points, not rules. Change any value afterwards.
 */
import type { ElevationStyle, Project } from './types';

export interface StylePreset {
  id: Exclude<ElevationStyle, 'custom'>;
  label: string;
  description: string;
  exteriorWall: string;
  roofColor: string;
  roof: { type: 'flat' | 'gable'; parapetMm: number; pitchDeg: number };
  sunshadeMm: number;
  bands: boolean;
  bandColor: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Flat roof with a tall parapet, plain white walls, slim sunshades.',
    exteriorWall: '#f1f0ec',
    roofColor: '#9b9b97',
    roof: { type: 'flat', parapetMm: 1050, pitchDeg: 25 },
    sunshadeMm: 450,
    bands: false,
    bandColor: '#3f4247',
  },
  {
    id: 'traditional',
    label: 'Traditional South Indian',
    description: 'Sloping terracotta tile roof, warm lime-wash walls, deep sunshades and a band at each floor.',
    exteriorWall: '#ecd9ae',
    roofColor: '#a4532f',
    roof: { type: 'gable', parapetMm: 0, pitchDeg: 30 },
    sunshadeMm: 600,
    bands: true,
    bandColor: '#8c4a2b',
  },
  {
    id: 'contemporary',
    label: 'Contemporary',
    description: 'Flat roof, light grey walls with dark grey bands and deep box sunshades.',
    exteriorWall: '#d9d9d5',
    roofColor: '#8f8f8b',
    roof: { type: 'flat', parapetMm: 900, pitchDeg: 25 },
    sunshadeMm: 750,
    bands: true,
    bandColor: '#43474d',
  },
  {
    id: 'villa',
    label: 'Villa',
    description: 'Gentle red-tile sloping roof, warm beige walls, white bands and medium sunshades.',
    exteriorWall: '#ead9bd',
    roofColor: '#9c3d2c',
    roof: { type: 'gable', parapetMm: 0, pitchDeg: 22 },
    sunshadeMm: 450,
    bands: true,
    bandColor: '#fbf8f1',
  },
];

/** Apply a preset to a project draft (keeps the ridge direction and slab thickness). */
export function applyStyle(d: Project, id: StylePreset['id']): void {
  const s = STYLE_PRESETS.find((x) => x.id === id);
  if (!s) return;
  d.finishes.exteriorWall = s.exteriorWall;
  d.finishes.roof = s.roofColor;
  d.roof.type = s.roof.type;
  d.roof.parapetMm = s.roof.parapetMm;
  d.roof.pitchDeg = s.roof.pitchDeg;
  d.exterior = { style: s.id, sunshadeMm: s.sunshadeMm, bands: s.bands, bandColor: s.bandColor };
}
