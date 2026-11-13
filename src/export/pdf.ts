import { jsPDF } from 'jspdf';
import { floorAreas, groundCoveragePercent, plotArea } from '../model/areas';
import { SIDE_NAMES } from '../model/factory';
import { boundingBox, dist, edgeSide, insetPolygon, type Rect, wallDir } from '../model/geometry';
import { formatArea, formatLength, formatSize } from '../model/units';
import { ROOM_COLORS, ROOM_TYPE_LABELS } from '../model/types';
import type { Floor, Opening, Point, Project, Side, Wall } from '../model/types';

import { PAPER_MM, SCALES, type PaperSize } from './paper';
import { clearances, openLandArea } from '../model/footprint';
import { evaluate } from '../vaasthu/engine';
import { catalogEntry, itemCorners } from '../model/catalog';
import { computeElevation, ELEVATION_TITLES, type Elevation } from '../model/elevation';
import { buildParts } from '../three/buildModel';
import { isPolygonRoom, roomArea, roomLabelRect, roomPolygon } from '../model/roomShape';
import { ZONE_NAMES } from '../vaasthu/rules';
export { PAPER_MM, SCALES, type PaperSize };

export interface PdfOptions {
  paper: PaperSize;
  includeSite: boolean;
  floorIds: string[];
  includeSchedule: boolean;
  revision: number;
  /** Fixed scale denominator, or 0 to pick the largest scale that fits. */
  scale: number;
  preparedBy: string;
  /** Add the Vaasthu orientation page (defaults to off). */
  includeVaasthu?: boolean;
  /** Add two pages of elevations (N & S, E & W). */
  includeElevations?: boolean;
}

const MARGIN = 10;
const TITLE_H = 26;
const INK: [number, number, number] = [31, 42, 90];
const GREY: [number, number, number] = [110, 116, 136];
const LIGHT: [number, number, number] = [200, 205, 215];

/** True when every character is in Latin-1, which jsPDF's built-in fonts can draw. */
export function isLatin1(text: string): boolean {
  return /^[\x00-\xFF]*$/.test(text);
}

/**
 * Draw text that jsPDF cannot (e.g. Tamil): the browser shapes it on a canvas, which is placed as an
 * image. Falls back to the built-in font (with "?" for unknown glyphs) where no canvas exists.
 * Returns the width used, in mm.
 */
export function smartText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: { size: number; color?: [number, number, number]; bold?: boolean; align?: 'left' | 'center' | 'right'; baseline?: 'alphabetic' | 'middle' } ,
): number {
  if (isLatin1(text) || typeof document === 'undefined') {
    doc.setFontSize(opts.size);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    if (opts.color) doc.setTextColor(...opts.color);
    doc.text(text, x, y, { align: opts.align, baseline: opts.baseline === 'middle' ? 'middle' : undefined });
    const w = doc.getTextWidth(text);
    doc.setFont('helvetica', 'normal');
    return w;
  }
  const PX_PER_PT = 8;
  const fontPx = opts.size * PX_PER_PT;
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d')!;
  const font = `${opts.bold ? '700' : '400'} ${fontPx}px "Noto Sans Tamil", "Atkinson Hyperlegible", system-ui, sans-serif`;
  g.font = font;
  const m = g.measureText(text);
  canvas.width = Math.ceil(m.width + fontPx * 0.2);
  canvas.height = Math.ceil(fontPx * 1.6);
  g.font = font;
  const [r, gg, b] = opts.color ?? [0, 0, 0];
  g.fillStyle = `rgb(${r},${gg},${b})`;
  g.textBaseline = 'alphabetic';
  g.fillText(text, fontPx * 0.1, fontPx * 1.15);
  const mmPerPx = (opts.size * 0.3528) / fontPx;
  const wMm = canvas.width * mmPerPx;
  const hMm = canvas.height * mmPerPx;
  const left = opts.align === 'center' ? x - wMm / 2 : opts.align === 'right' ? x - wMm : x;
  const top = opts.baseline === 'middle' ? y - hMm * 0.55 : y - 1.15 * fontPx * mmPerPx;
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', left, top, wMm, hMm);
  return wMm;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Choose the largest standard scale at which `box` (mm) fits in the drawing area (paper mm). */
export function chooseScale(box: Rect, areaW: number, areaH: number): number {
  for (const s of SCALES) if (box.w / s <= areaW && box.d / s <= areaH) return s;
  return SCALES[SCALES.length - 1];
}

class Sheet {
  doc: jsPDF;
  ox = 0;
  oy = 0;
  denom = 100;
  bx = 0;
  by = 0;
  constructor(doc: jsPDF) {
    this.doc = doc;
  }
  set(box: Rect, area: Rect, denom: number) {
    this.denom = denom;
    this.bx = box.x;
    this.by = box.y;
    // centre the drawing in the area
    this.ox = area.x + (area.w - box.w / denom) / 2;
    this.oy = area.y + (area.d - box.d / denom) / 2;
  }
  X(x: number) {
    return this.ox + (x - this.bx) / this.denom;
  }
  Y(y: number) {
    return this.oy + (y - this.by) / this.denom;
  }
  P(p: Point): [number, number] {
    return [this.X(p.x), this.Y(p.y)];
  }
  poly(pts: Point[], style: 'S' | 'F' | 'FD') {
    if (pts.length < 2) return;
    const [x0, y0] = this.P(pts[0]);
    const deltas: number[][] = [];
    let prev = [x0, y0];
    for (let i = 1; i < pts.length; i++) {
      const c = this.P(pts[i]);
      deltas.push([c[0] - prev[0], c[1] - prev[1]]);
      prev = c;
    }
    this.doc.lines(deltas, x0, y0, [1, 1], style, true);
  }
  line(a: Point, b: Point) {
    this.doc.line(this.X(a.x), this.Y(a.y), this.X(b.x), this.Y(b.y));
  }
}

function wallPolygon(w: Wall): Point[] {
  const d = wallDir(w);
  const n = { x: -d.y, y: d.x };
  const h = w.thicknessMm / 2;
  const a = { x: w.a.x - d.x * h, y: w.a.y - d.y * h };
  const b = { x: w.b.x + d.x * h, y: w.b.y + d.y * h };
  return [
    { x: a.x + n.x * h, y: a.y + n.y * h },
    { x: b.x + n.x * h, y: b.y + n.y * h },
    { x: b.x - n.x * h, y: b.y - n.y * h },
    { x: a.x - n.x * h, y: a.y - n.y * h },
  ];
}

/** Map a point in the opening's local frame (u along wall from centre, v across) to plan coordinates. */
function local(w: Wall, o: Opening, u: number, v: number): Point {
  const d = wallDir(w);
  const n = { x: -d.y, y: d.x };
  const c = { x: w.a.x + d.x * o.offsetMm, y: w.a.y + d.y * o.offsetMm };
  return { x: c.x + d.x * u + n.x * v, y: c.y + d.y * u + n.y * v };
}

function drawOpening(sh: Sheet, w: Wall, o: Opening) {
  const doc = sh.doc;
  const half = o.widthMm / 2;
  const t = w.thicknessMm / 2 + 3;
  doc.setFillColor(255, 255, 255);
  sh.poly([local(w, o, -half, -t), local(w, o, half, -t), local(w, o, half, t), local(w, o, -half, t)], 'F');
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  if (o.type === 'window') {
    for (const v of [-w.thicknessMm / 2, 0, w.thicknessMm / 2]) sh.line(local(w, o, -half, v), local(w, o, half, v));
    sh.line(local(w, o, -half, -w.thicknessMm / 2), local(w, o, -half, w.thicknessMm / 2));
    sh.line(local(w, o, half, -w.thicknessMm / 2), local(w, o, half, w.thicknessMm / 2));
  } else if (o.type === 'door') {
    // Canvas convention: 'left' swing is negative local y in the y-down frame; normal n = (-dy, dx)
    // points to local +v = canvas +y, so side maps directly.
    const side = o.swing === 'left' ? -1 : 1;
    const hingeU = o.hinge === 'start' ? -half : half;
    const leafDir = o.hinge === 'start' ? 1 : -1;
    const base = (side * w.thicknessMm) / 2;
    doc.setLineWidth(0.3);
    sh.line(local(w, o, hingeU, base), local(w, o, hingeU, base + side * o.widthMm));
    doc.setLineWidth(0.12);
    doc.setLineDashPattern([0.8, 0.6], 0);
    const steps = 16;
    const pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      pts.push(local(w, o, hingeU + leafDir * o.widthMm * Math.sin(a), base + side * o.widthMm * Math.cos(a)));
    }
    for (let i = 0; i < pts.length - 1; i++) sh.line(pts[i], pts[i + 1]);
    doc.setLineDashPattern([], 0);
  } else {
    doc.setLineDashPattern([1, 0.8], 0);
    sh.line(local(w, o, -half, 0), local(w, o, half, 0));
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.4);
    sh.line(local(w, o, -half, -w.thicknessMm), local(w, o, -half, w.thicknessMm));
    sh.line(local(w, o, half, -w.thicknessMm), local(w, o, half, w.thicknessMm));
  }
}

function dimension(sh: Sheet, a: Point, b: Point, offsetPaper: number, text: string, color = GREY) {
  const doc = sh.doc;
  const [ax, ay] = sh.P(a);
  const [bx, by] = sh.P(b);
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 2) return;
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  const nx = dy;
  const ny = -dx;
  const a2 = [ax + nx * offsetPaper, ay + ny * offsetPaper];
  const b2 = [bx + nx * offsetPaper, by + ny * offsetPaper];
  doc.setDrawColor(...color);
  doc.setLineWidth(0.12);
  doc.line(ax, ay, a2[0] + nx * 1.2 * Math.sign(offsetPaper || 1), a2[1] + ny * 1.2 * Math.sign(offsetPaper || 1));
  doc.line(bx, by, b2[0] + nx * 1.2 * Math.sign(offsetPaper || 1), b2[1] + ny * 1.2 * Math.sign(offsetPaper || 1));
  doc.setLineWidth(0.18);
  doc.line(a2[0], a2[1], b2[0], b2[1]);
  for (const p of [a2, b2]) doc.line(p[0] - (dx + nx) * 0.9, p[1] - (dy + ny) * 0.9, p[0] + (dx + nx) * 0.9, p[1] + (dy + ny) * 0.9);
  let angle = (-Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < -90 || angle >= 90) angle += angle < 0 ? 180 : -180;
  const mid = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
  doc.setFontSize(6.5);
  doc.setTextColor(...color);
  const tw = doc.getTextWidth(text);
  if (tw > len + 2) return;
  // place the text just outside the line, readable
  const rad = (-angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = uy; // perpendicular "up" for the text baseline
  const vy = -ux;
  doc.text(text, mid[0] - (ux * tw) / 2 + vx * 0.8, mid[1] - (uy * tw) / 2 + vy * 0.8, { angle });
}

function northArrow(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.circle(x, y, 7, 'S');
  doc.setFillColor(...INK);
  doc.triangle(x, y - 6, x + 2.6, y + 3, x, y + 1, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(x, y - 6, x - 2.6, y + 3, x, y + 1, 'FD');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text('N', x, y - 8.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
}

function frame(doc: jsPDF, paper: { w: number; h: number }) {
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.rect(MARGIN / 2, MARGIN / 2, paper.w - MARGIN, paper.h - MARGIN, 'S');
}

function titleBlock(
  doc: jsPDF,
  paper: { w: number; h: number },
  project: Project,
  opts: PdfOptions,
  drawingTitle: string,
  scaleText: string,
  page: number,
  pages: number,
) {
  const w = Math.min(190, paper.w - MARGIN * 2);
  const x = paper.w - MARGIN / 2 - w;
  const y = paper.h - MARGIN / 2 - TITLE_H;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.35);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, TITLE_H, 'FD');
  doc.setLineWidth(0.2);
  const c1 = x + w * 0.5;
  const c2 = x + w * 0.75;
  doc.line(c1, y, c1, y + TITLE_H);
  doc.line(c2, y, c2, y + TITLE_H);
  doc.line(c1, y + TITLE_H / 2, x + w, y + TITLE_H / 2);

  doc.setTextColor(...GREY);
  doc.setFontSize(6);
  doc.text('PROJECT', x + 2, y + 4);
  doc.text('SCALE', c1 + 2, y + 4);
  doc.text('DATE', c2 + 2, y + 4);
  doc.text('REVISION', c1 + 2, y + TITLE_H / 2 + 4);
  doc.text('SHEET', c2 + 2, y + TITLE_H / 2 + 4);

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  if (isLatin1(project.name)) doc.text(doc.splitTextToSize(project.name, w * 0.5 - 4).slice(0, 2), x + 2, y + 9);
  else smartText(doc, project.name, x + 2, y + 9, { size: 9.5, bold: true, color: INK });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(drawingTitle, x + 2, y + 18.5);
  if (opts.preparedBy) {
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    doc.text(`Prepared by ${opts.preparedBy}`, x + 2, y + 23.5);
  }
  doc.setTextColor(...INK);
  doc.setFontSize(9);
  doc.text(scaleText, c1 + 2, y + 10.5);
  doc.text(new Date().toLocaleDateString('en-GB'), c2 + 2, y + 10.5);
  doc.text(`R${opts.revision}`, c1 + 2, y + TITLE_H / 2 + 10);
  doc.text(`${page} of ${pages}`, c2 + 2, y + TITLE_H / 2 + 10);

  // Preliminary marking
  doc.setFillColor(180, 35, 24);
  const bw = 78;
  doc.rect(MARGIN / 2 + 2, paper.h - MARGIN / 2 - 9, bw, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PRELIMINARY - NOT FOR CONSTRUCTION', MARGIN / 2 + 2 + bw / 2, paper.h - MARGIN / 2 - 4.2, { align: 'center' });
  doc.setFont('helvetica', 'normal');
}

function drawPlotContext(sh: Sheet, project: Project, strong: boolean) {
  const doc = sh.doc;
  const unit = project.settings.unit;
  const boundary = project.plot.boundary;
  // roads / neighbours bands
  boundary.forEach((a, i) => {
    const b = boundary[(i + 1) % boundary.length];
    const side = edgeSide(a, b);
    const road = project.plot.roads.find((r) => r.side === side);
    const neighbour = project.plot.neighbours.includes(side);
    if (!road && !neighbour) return;
    const len = dist(a, b) || 1;
    const out = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    // Bands are indicative only; capped so the drawing stays at a useful scale.
    const depth = Math.min(road ? road.widthMm : 2500, 2500);
    const band = [a, b, { x: b.x + out.x * depth, y: b.y + out.y * depth }, { x: a.x + out.x * depth, y: a.y + out.y * depth }];
    doc.setFillColor(...(road ? ([226, 228, 233] as [number, number, number]) : ([243, 244, 240] as [number, number, number])));
    sh.poly(band, 'F');
    // Label at 30% along the edge so it never sits on the edge's own dimension (drawn at the midpoint).
    const mid = { x: a.x + (b.x - a.x) * 0.3 + (out.x * depth) / 2, y: a.y + (b.y - a.y) * 0.3 + (out.y * depth) / 2 };
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    const label = road ? `ROAD (${SIDE_NAMES[side].toUpperCase()}) ${formatLength(road.widthMm, unit)} WIDE` : `NEIGHBOUR (${SIDE_NAMES[side].toUpperCase()})`;
    const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
    const [mx, my] = sh.P(mid);
    doc.text(label, mx, my, { align: 'center', angle: vertical ? 90 : 0, baseline: 'middle' });
  });

  doc.setDrawColor(...INK);
  doc.setLineWidth(strong ? 0.45 : 0.25);
  doc.setLineDashPattern(strong ? [] : [3, 1, 0.6, 1], 0);
  sh.poly(boundary, 'S');
  doc.setLineDashPattern([], 0);

  if (strong) {
    const inset = insetPolygon(boundary, project.plot.setbacks);
    doc.setDrawColor(143, 165, 150);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([2, 1.2], 0);
    if (inset.length >= 3) sh.poly(inset, 'S');
    doc.setLineDashPattern([], 0);
  }

}

/** House outline with the open gap on each side, in the accent colour. */
function drawFootprint(sh: Sheet, project: Project) {
  const f = project.footprint!;
  const doc = sh.doc;
  const OCHRE: [number, number, number] = [184, 134, 11];
  doc.setDrawColor(...OCHRE);
  doc.setLineWidth(0.45);
  doc.setLineDashPattern([2.5, 1.2], 0);
  doc.rect(sh.X(f.x), sh.Y(f.y), f.w / sh.denom, f.d / sh.denom, 'S');
  doc.setLineDashPattern([], 0);
  const unit = project.settings.unit;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...OCHRE);
  doc.text(`HOUSE ${formatLength(f.w, unit)} x ${formatLength(f.d, unit)}`, sh.X(f.x), sh.Y(f.y) - 1.2);
  doc.setFont('helvetica', 'normal');
  for (const c of clearances(f, project.plot.boundary)) {
    if (c.mm < 1) continue;
    dimension(sh, c.from, c.to, 0, formatLength(c.mm, unit), OCHRE);
  }
}

/** Plot edge dimensions — drawn last so room fills never cover them. */
function plotDimensions(sh: Sheet, project: Project) {
  const boundary = project.plot.boundary;
  boundary.forEach((a, i) => {
    const b = boundary[(i + 1) % boundary.length];
    dimension(sh, a, b, -6, formatLength(dist(a, b), project.settings.unit));
  });
}

function drawFloor(sh: Sheet, project: Project, floor: Floor, siteMode: boolean) {
  const doc = sh.doc;
  const unit = project.settings.unit;

  for (const r of floor.rooms) {
    const [cr, cg, cb] = hexToRgb(ROOM_COLORS[r.type]);
    doc.setFillColor(cr, cg, cb);
    const pts = roomPolygon(r);
    if (r.type === 'garden' || r.type === 'pathway') {
      doc.setDrawColor(143, 165, 150);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([1, 0.8], 0);
      sh.poly(pts, 'FD');
      doc.setLineDashPattern([], 0);
    } else sh.poly(pts, 'F');

    if (r.type === 'staircase' && !isPolygonRoom(r)) {
      doc.setDrawColor(...GREY);
      doc.setLineWidth(0.12);
      const up = r.stairUp ?? 'N';
      const vertical = up === 'N' || up === 'S';
      const along = vertical ? r.d : r.w;
      const n = Math.max(1, Math.floor(along / 250));
      for (let i = 1; i < n; i++) {
        const t = (i * along) / n;
        if (vertical) sh.line({ x: r.x, y: r.y + t }, { x: r.x + r.w, y: r.y + t });
        else sh.line({ x: r.x + t, y: r.y }, { x: r.x + t, y: r.y + r.d });
      }
    }
  }

  doc.setFillColor(...INK);
  for (const w of floor.walls) sh.poly(wallPolygon(w), 'F');
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) drawOpening(sh, w, o);
  }

  // Furniture, fittings and outdoor items: light outline; wall-mounted units dashed.
  doc.setLineWidth(0.12);
  for (const it of floor.items ?? []) {
    const c = catalogEntry(it.type);
    const wallUnit = c.tags?.includes('wall-unit');
    if (wallUnit) doc.setLineDashPattern([0.8, 0.6], 0);
    const [ir, ig, ib] = hexToRgb(it.color ?? c.color);
    doc.setDrawColor(...GREY);
    doc.setFillColor(Math.round(255 - (255 - ir) * 0.35), Math.round(255 - (255 - ig) * 0.35), Math.round(255 - (255 - ib) * 0.35));
    sh.poly(itemCorners(it), wallUnit ? 'S' : 'FD');
    if (wallUnit) doc.setLineDashPattern([], 0);
  }

  if (siteMode) {
    doc.setFillColor(...GREY);
    for (const w of project.siteWalls) sh.poly(wallPolygon(w), 'F');
    for (const o of project.siteOpenings) {
      const w = project.siteWalls.find((x) => x.id === o.wallId);
      if (w) drawOpening(sh, w, o);
    }
  }

  // Labels
  for (const r of floor.rooms) {
    const lr = roomLabelRect(r);
    const [cx, cy] = sh.P({ x: lr.x + lr.w / 2, y: lr.y + lr.d / 2 });
    const wPaper = lr.w / sh.denom;
    const hPaper = lr.d / sh.denom;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    let fs = 7.5;
    doc.setFontSize(fs);
    while (fs > 4.5 && doc.getTextWidth(r.name) > wPaper - 1.5) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    if ((isLatin1(r.name) && doc.getTextWidth(r.name) > wPaper - 1) || hPaper < 4) {
      doc.setFont('helvetica', 'normal');
      continue;
    }
    const size = isPolygonRoom(r) ? formatArea(roomArea(r), unit) : formatSize(r.w, r.d, unit).replace('×', 'x');
    if (isLatin1(r.name)) doc.text(r.name, cx, cy - (hPaper > 9 ? 1.2 : -1), { align: 'center' });
    else smartText(doc, r.name, cx, cy - (hPaper > 9 ? 1.2 : -1), { size: fs, bold: true, color: INK, align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(Math.min(6.5, fs));
    if (hPaper > 9 && doc.getTextWidth(size) < wPaper - 1) doc.text(size, cx, cy + 2.6, { align: 'center' });
  }

  // Openings marks
  doc.setFontSize(5.5);
  doc.setTextColor(...GREY);
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w || !o.label) continue;
    const p = local(w, o, 0, -(w.thicknessMm / 2 + 220));
    const [x, y] = sh.P(p);
    doc.text(o.label.split(' ')[0], x, y, { align: 'center', baseline: 'middle' });
  }
}

function legend(doc: jsPDF, x: number, y: number, project: Project, floor?: Floor) {
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.text('LEGEND', x, y);
  doc.setFont('helvetica', 'normal');
  let yy = y + 4;
  const item = (draw: () => void, text: string) => {
    draw();
    doc.setTextColor(...INK);
    doc.setFontSize(6.5);
    doc.text(text, x + 9, yy + 1);
    yy += 4.2;
  };
  item(() => {
    doc.setFillColor(...INK);
    doc.rect(x, yy - 1, 7, 2.2, 'F');
  }, 'Wall (centre-line dimensions)');
  item(() => {
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.2);
    doc.line(x, yy - 0.8, x + 7, yy - 0.8);
    doc.line(x, yy, x + 7, yy);
    doc.line(x, yy + 0.8, x + 7, yy + 0.8);
  }, 'Window');
  item(() => {
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.25);
    doc.line(x + 1, yy + 1.5, x + 1, yy - 1.5);
    doc.setLineDashPattern([0.6, 0.5], 0);
    doc.line(x + 1, yy - 1.5, x + 4, yy + 1.5);
    doc.setLineDashPattern([], 0);
  }, 'Door and swing');
  item(() => {
    doc.setDrawColor(143, 165, 150);
    doc.setLineDashPattern([1.2, 0.8], 0);
    doc.line(x, yy, x + 7, yy);
    doc.setLineDashPattern([], 0);
  }, 'Setback line');
  if (floor) {
    const types = Array.from(new Set(floor.rooms.map((r) => r.type))).slice(0, 10);
    for (const t of types) {
      item(() => {
        doc.setFillColor(...hexToRgb(ROOM_COLORS[t]));
        doc.setDrawColor(...LIGHT);
        doc.rect(x, yy - 1.4, 7, 3, 'FD');
      }, ROOM_TYPE_LABELS[t]);
    }
  }
  doc.setFontSize(6);
  doc.setTextColor(...GREY);
  doc.text(`Units: ${project.settings.unit === 'ft' ? 'feet and inches' : project.settings.unit}`, x, yy + 1.5);
  return yy;
}

function extentsFor(project: Project, floors: Floor[], withSite: boolean): Rect {
  const pts: Point[] = [...project.plot.boundary];
  for (const f of floors) for (const r of f.rooms) pts.push({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.d });
  const box = boundingBox(pts);
  // room for road bands and dimensions
  const pad = withSite ? 3000 : 2600;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, d: box.d + pad * 2 };
}

function scheduleRows(project: Project) {
  const rows: string[][] = [];
  const unit = project.settings.unit;
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);
  for (const f of sorted) {
    for (const o of f.openings) {
      const w = f.walls.find((x) => x.id === o.wallId);
      rows.push([
        o.label || '-',
        o.type === 'door' ? 'Door' : o.type === 'window' ? 'Window' : 'Gate',
        f.name,
        formatLength(o.widthMm, unit),
        formatLength(o.heightMm, unit),
        o.type === 'window' ? formatLength(o.sillMm, unit) : '-',
        w ? `${w.kind}, ${formatLength(w.thicknessMm, unit === 'ft' ? 'in' : unit)}` : '-',
      ]);
    }
  }
  for (const o of project.siteOpenings) {
    rows.push([o.label || '-', 'Gate', 'Site', formatLength(o.widthMm, unit), formatLength(o.heightMm, unit), '-', 'compound wall']);
  }
  return rows;
}

/** Build the PDF document (exported for tests). */
export function buildPdf(project: Project, opts: PdfOptions): jsPDF {
  const paper = PAPER_MM[opts.paper];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: opts.paper });
  doc.setFont('helvetica', 'normal');
  doc.setProperties({ title: `${project.name} — R${opts.revision}`, subject: 'Preliminary house plan', creator: 'Vaasthu House Planner' });
  const sh = new Sheet(doc);
  const floors = [...project.floors].sort((a, b) => a.level - b.level).filter((f) => opts.floorIds.includes(f.id));

  type Page = { title: string; draw: (page: number, pages: number) => void };
  const pages: Page[] = [];
  const legendW = 48;
  const area: Rect = {
    x: MARGIN,
    y: MARGIN + 4,
    w: paper.w - MARGIN * 2 - legendW,
    d: paper.h - MARGIN * 2 - TITLE_H - 8,
  };

  const drawPlanPage = (title: string, floor: Floor | null, site: boolean, page: number, total: number) => {
    const ground = project.floors.find((f) => f.level === 0);
    const ext = extentsFor(project, floor ? [floor] : ground ? [ground] : [], site);
    const denom = opts.scale || chooseScale(ext, area.w, area.d);
    sh.set(ext, area, denom);
    frame(doc, paper);
    drawPlotContext(sh, project, site);
    if (site && ground) drawFloor(sh, project, ground, true);
    if (!site && floor) drawFloor(sh, project, floor, floor.level === 0);
    plotDimensions(sh, project);
    if (site && project.footprint) drawFootprint(sh, project);

    if (floor && floor.walls.length) {
      const wb = boundingBox(floor.walls.flatMap((w) => [w.a, w.b]));
      dimension(sh, { x: wb.x, y: wb.y + wb.d }, { x: wb.x + wb.w, y: wb.y + wb.d }, -7, formatLength(wb.w, project.settings.unit), INK);
      dimension(sh, { x: wb.x + wb.w, y: wb.y + wb.d }, { x: wb.x + wb.w, y: wb.y }, -7, formatLength(wb.d, project.settings.unit), INK);
    }

    northArrow(doc, paper.w - MARGIN - 14, MARGIN + 14);
    const ly = legend(doc, paper.w - MARGIN - legendW + 4, MARGIN + 32, project, floor ?? undefined);
    // scale bar
    const barMm = project.settings.unit === 'ft' || project.settings.unit === 'in' ? 3048 : 5000;
    const barLen = barMm / denom;
    const bx = paper.w - MARGIN - legendW + 4;
    const by = ly + 8;
    if (barLen < legendW - 8) {
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.3);
      doc.line(bx, by, bx + barLen, by);
      doc.line(bx, by - 1, bx, by + 1);
      doc.line(bx + barLen, by - 1, bx + barLen, by + 1);
      doc.setFontSize(6);
      doc.setTextColor(...INK);
      doc.text(formatLength(barMm, project.settings.unit), bx + barLen / 2, by - 1.5, { align: 'center' });
    }
    titleBlock(doc, paper, project, opts, title, `1:${denom} on ${opts.paper.toUpperCase()}`, page, total);
  };

  if (opts.includeSite) pages.push({ title: 'Site plan', draw: (p, n) => drawPlanPage('Site plan', null, true, p, n) });
  for (const f of floors) pages.push({ title: `${f.name} plan`, draw: (p, n) => drawPlanPage(`${f.name} plan`, f, false, p, n) });

  if (opts.includeElevations && project.floors.some((f) => f.walls.length)) {
    const parts = buildParts(project);
    const elevs = (['N', 'E', 'S', 'W'] as Side[]).map((sd) => computeElevation(project, sd, parts));
    // One scale for all four so they compare directly.
    const maxW = Math.max(...elevs.map((e) => (e.h1 - e.h0) * 1000)) + 6000;
    const maxH = Math.max(...elevs.map((e) => e.top * 1000)) + 3000;
    const half = { w: area.w, d: (area.d - 10) / 2 };
    const denom = chooseScale({ x: 0, y: 0, w: maxW, d: maxH }, half.w, half.d);
    const drawElev = (e: Elevation, y0: number) => {
      const wM = e.h1 - e.h0;
      const ox = area.x + (area.w - (wM * 1000) / denom) / 2;
      const groundY = y0 + half.d - 4;
      const X = (h: number) => ox + ((h - e.h0) * 1000) / denom;
      const Y = (v: number) => groundY - (v * 1000) / denom;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(ELEVATION_TITLES[e.side], area.x, y0 + 3);
      doc.setFont('helvetica', 'normal');
      doc.setLineWidth(0.1);
      doc.setDrawColor(43, 47, 58);
      for (const shp of e.shapes) {
        const [r, g, b] = hexToRgb(shp.color);
        doc.setFillColor(r, g, b);
        const pts = shp.pts.map(([h, v]) => [X(h), Y(v)]);
        const deltas = pts.slice(1).map((q, i) => [q[0] - pts[i][0], q[1] - pts[i][1]]);
        doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'FD', true);
      }
      doc.setLineWidth(0.4);
      doc.line(area.x, groundY, area.x + area.w, groundY);
      doc.setLineWidth(0.12);
      doc.setFontSize(6);
      doc.setTextColor(...GREY);
      for (const l of e.levels) {
        doc.setDrawColor(...GREY);
        doc.line(X(e.h1) + 2, Y(l.v), X(e.h1) + 8, Y(l.v));
        doc.text(`+${formatLength(l.v * 1000, project.settings.unit)} ${l.label}`, X(e.h1) + 9, Y(l.v) + 0.8);
      }
      doc.setTextColor(...INK);
      doc.text(`Top +${formatLength(e.top * 1000, project.settings.unit)}`, X(e.h1) + 9, Y(e.top) + 0.8);
      doc.setDrawColor(...GREY);
      doc.line(X(e.h0), groundY + 3, X(e.h1), groundY + 3);
      doc.text(formatLength(wM * 1000, project.settings.unit), (X(e.h0) + X(e.h1)) / 2, groundY + 2.4, { align: 'center' });
    };
    const elevPage = (a: Elevation, b: Elevation, title: string) => (page: number, total: number) => {
      frame(doc, paper);
      drawElev(a, area.y);
      drawElev(b, area.y + half.d + 10);
      doc.setFontSize(6);
      doc.setTextColor(...GREY);
      doc.text('Simplified elevations generated from the 3D model, for discussion only — not for construction.', paper.w - MARGIN - 2, area.y + 2, { align: 'right' });
      titleBlock(doc, paper, project, opts, title, `1:${denom} on ${opts.paper.toUpperCase()}`, page, total);
    };
    pages.push({ title: 'North and south elevations', draw: elevPage(elevs[0], elevs[2], 'North and south elevations') });
    pages.push({ title: 'East and west elevations', draw: elevPage(elevs[1], elevs[3], 'East and west elevations') });
  }

  if (opts.includeVaasthu) {
    pages.push({ title: 'Vaasthu orientation', draw: (p, n) => drawVaasthuPage(p, n) });
  }

  function drawVaasthuPage(page: number, total: number) {
    const report = evaluate(project);
    const ground = [...project.floors].sort((a, b) => a.level - b.level)[0];
    frame(doc, paper);
    const left: Rect = { x: MARGIN + 2, y: MARGIN + 14, w: (paper.w - MARGIN * 2) * 0.5, d: paper.h - MARGIN * 2 - TITLE_H - 22 };
    const g = report.houseGrid;
    const pad = 2500;
    const ext = { x: g.x - pad, y: g.y - pad, w: g.w + pad * 2, d: g.d + pad * 2 };
    const denom = chooseScale(ext, left.w, left.d);
    sh.set(ext, left, denom);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Vaasthu orientation (traditional preferences, advisory only)', MARGIN + 4, MARGIN + 8);
    doc.setFont('helvetica', 'normal');
    if (ground) drawFloor(sh, project, ground, false);
    // 3x3 grid
    const OCHRE: [number, number, number] = [184, 134, 11];
    doc.setDrawColor(...OCHRE);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.2], 0);
    for (const k of [1, 2]) {
      sh.line({ x: g.x + (g.w * k) / 3, y: g.y }, { x: g.x + (g.w * k) / 3, y: g.y + g.d });
      sh.line({ x: g.x, y: g.y + (g.d * k) / 3 }, { x: g.x + g.w, y: g.y + (g.d * k) / 3 });
    }
    doc.setLineDashPattern([], 0);
    doc.rect(sh.X(g.x), sh.Y(g.y), g.w / denom, g.d / denom, 'S');
    doc.setFontSize(8);
    doc.setTextColor(...OCHRE);
    doc.setFont('helvetica', 'bold');
    const grid = [['NW', 'N', 'NE'], ['W', 'C', 'E'], ['SW', 'S', 'SE']];
    grid.forEach((row, r) => row.forEach((z, c) => doc.text(z === 'C' ? 'CENTRE' : z, sh.X(g.x + (g.w * c) / 3) + 1.2, sh.Y(g.y + (g.d * r) / 3) + 3.5)));
    doc.setFont('helvetica', 'normal');
    northArrow(doc, left.x + left.w - 10, left.y + 10);

    // Table
    const tx = MARGIN + 6 + left.w + 6;
    let ty = MARGIN + 16;
    doc.setTextColor(...INK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Advisory score: ${report.score ?? '-'} / 100`, tx, ty);
    doc.setFont('helvetica', 'normal');
    ty += 6;
    const RATE: Record<string, [number, number, number]> = { preferred: [47, 133, 90], acceptable: [183, 121, 31], neutral: [138, 143, 156], avoid: [197, 48, 48] };
    const LABEL: Record<string, string> = { preferred: 'Preferred', acceptable: 'Acceptable', neutral: 'No preference', avoid: 'Avoided' };
    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text('Element', tx, ty);
    doc.text('Zone', tx + 62, ty);
    doc.text('Rating', tx + 92, ty);
    doc.text('Traditionally best', tx + 116, ty);
    ty += 4.5;
    const maxY = paper.h - MARGIN - TITLE_H - 22;
    for (const it of report.items) {
      if (ty > maxY) {
        doc.setTextColor(...GREY);
        doc.text(`…and ${report.items.length - report.items.indexOf(it)} more (see the app)`, tx, ty);
        break;
      }
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(it.name, 60)[0], tx, ty);
      doc.text(ZONE_NAMES[it.zone].en, tx + 62, ty);
      doc.setTextColor(...RATE[it.rating]);
      doc.text(LABEL[it.rating], tx + 92, ty);
      doc.setTextColor(...GREY);
      doc.text(doc.splitTextToSize(it.preferredZones.map((z) => ZONE_NAMES[z].en).join(', ') || '-', 60)[0], tx + 116, ty);
      ty += 4.2;
    }
    if (report.centreIssues.length) {
      ty += 2;
      doc.setTextColor(...RATE.avoid);
      doc.text(`On the centre (Brahmasthan): ${report.centreIssues.map((c) => c.name).join(', ')}`, tx, ty);
      ty += 4.2;
    }
    ty += 3;
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    const note = doc.splitTextToSize(
      'These are commonly cited traditional directional preferences, configurable per project. They are not structural, health or legal requirements and never override building regulations, structural safety, ventilation, sanitation or setbacks. Zones are a 3x3 grid over the house outline; sump, septic tank, borewell and garden use the plot grid.' +
        (report.entrance?.guessed ? ' No door was marked as the main entrance, so one was assumed.' : ''),
      paper.w - tx - MARGIN - 4,
    );
    doc.text(note, tx, Math.min(ty, maxY + 6));
    titleBlock(doc, paper, project, opts, 'Vaasthu orientation', `1:${denom} on ${opts.paper.toUpperCase()}`, page, total);
  }

  if (opts.includeSchedule) {
    const rows = scheduleRows(project);
    const rowH = 5;
    const top = MARGIN + 30;
    const perPage = Math.max(5, Math.floor((paper.h - top - TITLE_H - MARGIN * 2) / rowH));
    const chunks: string[][][] = [];
    for (let i = 0; i < Math.max(rows.length, 1); i += perPage) chunks.push(rows.slice(i, i + perPage));
    chunks.forEach((chunk, ci) => {
      pages.push({
        title: chunks.length > 1 ? `Schedules (${ci + 1}/${chunks.length})` : 'Schedules & area statement',
        draw: (p, n) => {
          frame(doc, paper);
          const x0 = MARGIN + 4;
          doc.setTextColor(...INK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text('Door, window and gate schedule', x0, MARGIN + 10);
          doc.setFont('helvetica', 'normal');
          const cols = ['Mark', 'Type', 'Floor', 'Width', 'Height', 'Sill', 'Wall'];
          const widths = [50, 16, 28, 18, 18, 14, 36];
          let y = MARGIN + 20;
          doc.setFontSize(7.5);
          doc.setTextColor(...GREY);
          let x = x0;
          cols.forEach((c, i) => {
            doc.text(c, x, y);
            x += widths[i];
          });
          doc.setDrawColor(...LIGHT);
          doc.line(x0, y + 1.5, x0 + widths.reduce((a, b) => a + b, 0), y + 1.5);
          y += rowH + 1;
          doc.setTextColor(...INK);
          if (chunk.length === 0) doc.text('No doors, windows or gates yet.', x0, y);
          for (const r of chunk) {
            x = x0;
            r.forEach((cell, i) => {
              doc.text(doc.splitTextToSize(cell, widths[i] - 2)[0], x, y);
              x += widths[i];
            });
            y += rowH;
          }

          if (ci === 0) {
            const ax = x0 + 190;
            const unit = project.settings.unit;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Area statement', ax, MARGIN + 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            let ay = MARGIN + 20;
            const line = (k: string, v: string) => {
              doc.setTextColor(...GREY);
              doc.text(k, ax, ay);
              doc.setTextColor(...INK);
              doc.text(v, ax + 70, ay, { align: 'right' });
              ay += 5;
            };
            const box = boundingBox(project.plot.boundary);
            line('Plot size', `${formatLength(box.w, unit)} x ${formatLength(box.d, unit)}`);
            line('Plot area', formatArea(plotArea(project), unit));
            line('Ground coverage', `${groundCoveragePercent(project).toFixed(1)}%`);
            if (project.footprint) {
              const f = project.footprint;
              line('House outline', `${formatLength(f.w, unit)} x ${formatLength(f.d, unit)} (${formatArea(f.w * f.d, unit)})`);
              line('Open land around the house', formatArea(openLandArea(project), unit));
              for (const c of clearances(f, project.plot.boundary)) line(`Gap to ${SIDE_NAMES[c.side].toLowerCase()} boundary`, formatLength(c.mm, unit));
            }
            (['N', 'E', 'S', 'W'] as const).forEach((s) => line(`Setback ${SIDE_NAMES[s].toLowerCase()}`, formatLength(project.plot.setbacks[s], unit)));
            ay += 2;
            for (const f of [...project.floors].sort((a, b) => a.level - b.level)) {
              const a = floorAreas(f);
              line(`${f.name}: enclosed rooms`, formatArea(a.enclosedMm2, unit));
              if (a.porticoStairMm2) line(`${f.name}: portico & stairs`, formatArea(a.porticoStairMm2, unit));
              if (a.outdoorMm2) line(`${f.name}: open areas`, formatArea(a.outdoorMm2, unit));
            }
            ay += 4;
            doc.setFontSize(6.5);
            doc.setTextColor(...GREY);
            const notes = [
              'Notes',
              '1. All dimensions are to wall centre-lines unless noted. Verify on site.',
              '2. Areas are computed from room rectangles and are not certified built-up areas.',
              '3. Setbacks, coverage and height limits are the values entered by the user;',
              '   confirm them with the local planning authority before applying for approval.',
              '4. Structural, electrical and plumbing design by qualified professionals only.',
            ];
            notes.forEach((t) => {
              doc.text(t, ax, ay);
              ay += 3.8;
            });
          }
          titleBlock(doc, paper, project, opts, 'Schedules & area statement', '-', p, n);
        },
      });
    });
  }

  if (pages.length === 0) throw new Error('Choose at least one page to export.');
  pages.forEach((pg, i) => {
    if (i > 0) doc.addPage(opts.paper, 'landscape');
    pg.draw(i + 1, pages.length);
  });
  return doc;
}

export function exportPdf(project: Project, opts: PdfOptions, filename: string): void {
  buildPdf(project, opts).save(filename);
}

