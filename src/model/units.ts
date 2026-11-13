import type { DisplayUnit } from './types';

export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;

export const UNIT_LABELS: Record<DisplayUnit, string> = {
  ft: 'Feet & inches',
  in: 'Inches',
  m: 'Metres',
  cm: 'Centimetres',
};

/** Convert a value expressed in `unit` to millimetres. */
export function toMm(value: number, unit: DisplayUnit): number {
  switch (unit) {
    case 'ft':
      return value * MM_PER_FOOT;
    case 'in':
      return value * MM_PER_INCH;
    case 'm':
      return value * 1000;
    case 'cm':
      return value * 10;
  }
}

/** Convert millimetres to a plain number in `unit` (feet as decimal feet). */
export function fromMm(mm: number, unit: DisplayUnit): number {
  switch (unit) {
    case 'ft':
      return mm / MM_PER_FOOT;
    case 'in':
      return mm / MM_PER_INCH;
    case 'm':
      return mm / 1000;
    case 'cm':
      return mm / 10;
  }
}

/**
 * Format a length for display.
 * ft → 12'-6" (nearest inch), in → 150", m → 3.81 m, cm → 381 cm.
 */
export function formatLength(mm: number, unit: DisplayUnit): string {
  const sign = mm < 0 ? '-' : '';
  const abs = Math.abs(mm);
  switch (unit) {
    case 'ft': {
      let totalIn = Math.round(abs / MM_PER_INCH);
      const ft = Math.floor(totalIn / 12);
      totalIn -= ft * 12;
      if (ft === 0) return `${sign}${totalIn}"`;
      return `${sign}${ft}'-${totalIn}"`;
    }
    case 'in':
      return `${sign}${round(abs / MM_PER_INCH, 1)}"`;
    case 'm':
      return `${sign}${round(abs / 1000, 2).toFixed(2)} m`;
    case 'cm':
      return `${sign}${round(abs / 10, 1)} cm`;
  }
}

/** Short "W × D" label for a rectangle. */
export function formatSize(wMm: number, dMm: number, unit: DisplayUnit): string {
  return `${formatLength(wMm, unit)} × ${formatLength(dMm, unit)}`;
}

export function areaUnitLabel(unit: DisplayUnit): string {
  return unit === 'ft' || unit === 'in' ? 'sq ft' : 'm²';
}

/** Area in sq ft for imperial display units, m² for metric. */
export function formatArea(mm2: number, unit: DisplayUnit): string {
  if (unit === 'ft' || unit === 'in') {
    return `${Math.round(mm2 / (MM_PER_FOOT * MM_PER_FOOT)).toLocaleString('en-IN')} sq ft`;
  }
  return `${round(mm2 / 1e6, 2).toFixed(2)} m²`;
}

export function areaValue(mm2: number, unit: DisplayUnit): number {
  return unit === 'ft' || unit === 'in' ? mm2 / (MM_PER_FOOT * MM_PER_FOOT) : mm2 / 1e6;
}

const UNIT_ALIASES: Record<string, DisplayUnit | 'mm'> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  ft: 'ft',
  feet: 'ft',
  foot: 'ft',
  "'": 'ft',
  '’': 'ft',
  in: 'in',
  inch: 'in',
  inches: 'in',
  '"': 'in',
  '”': 'in',
  "''": 'in',
};

/**
 * Parse a user-typed length into millimetres. Returns null when the text is not a valid length.
 *
 * Accepted examples (defaultUnit = 'ft'):
 *   "12" → 12 ft, "12.5" → 12.5 ft, "12'6\"" / "12'-6" / "12 ft 6 in" → 12 ft 6 in,
 *   "6\"" / "6in" → 6 in, "3.5m", "350 cm", "3500mm".
 * A bare number following a feet value is read as inches ("12' 6" → 12 ft 6 in).
 */
export function parseLength(input: string, defaultUnit: DisplayUnit): number | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/''/g, '"')
    .replace(/(['’])\s*-\s*/g, '$1 ');
  if (!text) return null;

  const re = /(\d+(?:\.\d+)?|\.\d+)\s*(mm|cm|m|feet|foot|ft|inches|inch|in|['’"”])?/gy;
  let total = 0;
  let pos = 0;
  let parts = 0;
  let previousUnit: DisplayUnit | 'mm' | null = null;

  while (pos < text.length) {
    // skip separators
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
    if (pos >= text.length) break;
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m || m.index !== pos) return null;
    const value = Number(m[1]);
    if (!Number.isFinite(value)) return null;
    let unit: DisplayUnit | 'mm';
    if (m[2]) {
      const alias = UNIT_ALIASES[m[2]];
      if (!alias) return null;
      unit = alias;
    } else if (previousUnit === 'ft') {
      unit = 'in';
    } else if (parts === 0) {
      unit = defaultUnit;
    } else {
      return null;
    }
    total += unit === 'mm' ? value : toMm(value, unit);
    previousUnit = unit;
    parts++;
    pos = re.lastIndex;
  }

  if (parts === 0) return null;
  return total;
}

/** Sensible snap steps for each display unit, in mm. */
export function snapOptions(unit: DisplayUnit): { label: string; mm: number }[] {
  if (unit === 'ft' || unit === 'in') {
    return [
      { label: 'Off', mm: 0 },
      { label: '1"', mm: MM_PER_INCH },
      { label: '3"', mm: 3 * MM_PER_INCH },
      { label: '6"', mm: 6 * MM_PER_INCH },
      { label: "1'", mm: MM_PER_FOOT },
    ];
  }
  return [
    { label: 'Off', mm: 0 },
    { label: '1 cm', mm: 10 },
    { label: '5 cm', mm: 50 },
    { label: '10 cm', mm: 100 },
    { label: '50 cm', mm: 500 },
  ];
}

/** Major grid spacing for drawing, in mm. */
export function gridStepMm(unit: DisplayUnit): number {
  return unit === 'ft' || unit === 'in' ? MM_PER_FOOT : 500;
}

export function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

export function ft(v: number): number {
  return v * MM_PER_FOOT;
}
