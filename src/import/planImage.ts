/**
 * Importing a house-plan drawing (picture or PDF) as an underlay.
 *
 * The analysis functions work on plain {width, height, data} pixel buffers so they can be tested
 * without a browser. Loading files and drawing canvases needs the DOM.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Which way north points on the drawing as it appears on the sheet. */
export type NorthOnDrawing = 'up' | 'down' | 'left' | 'right';

/** Clockwise rotation (degrees) that turns the drawing so north points up. */
export function rotationFor(north: NorthOnDrawing): 0 | 90 | 180 | 270 {
  return { up: 0, down: 180, left: 90, right: 270 }[north] as 0 | 90 | 180 | 270;
}

function darkMask(px: Pixels, threshold = 110): Uint8Array {
  const m = new Uint8Array(px.width * px.height);
  for (let i = 0; i < m.length; i++) {
    const r = px.data[i * 4];
    const g = px.data[i * 4 + 1];
    const b = px.data[i * 4 + 2];
    const a = px.data[i * 4 + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    m[i] = a > 128 && lum < threshold ? 1 : 0;
  }
  return m;
}

/** Morphological erosion (k = radius in pixels) on a binary mask, via separable min filters. */
function erode(m: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 0) return m;
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    let run = 0;
    const row = y * w;
    // count consecutive ones; a pixel survives if the window [x-k, x+k] is all ones
    const ones = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      run = m[row + x] ? run + 1 : 0;
      ones[x] = run;
    }
    for (let x = 0; x < w; x++) {
      const end = Math.min(w - 1, x + k);
      tmp[row + x] = x - k >= 0 && ones[end] >= end - (x - k) + 1 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    const ones = new Int32Array(h);
    for (let y = 0; y < h; y++) {
      run = tmp[y * w + x] ? run + 1 : 0;
      ones[y] = run;
    }
    for (let y = 0; y < h; y++) {
      const end = Math.min(h - 1, y + k);
      out[y * w + x] = y - k >= 0 && ones[end] >= end - (y - k) + 1 ? 1 : 0;
    }
  }
  return out;
}

function dilate(m: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 0) return m;
  const inv = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1;
  // dilation = complement of erosion of the complement (edges treated as background)
  const padded = erode(inv, w, h, k);
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = x < k || y < k || x >= w - k || y >= h - k;
      out[y * w + x] = edge ? (m[y * w + x] ? 1 : 0) : padded[y * w + x] ? 0 : 1;
    }
  return out;
}

/** Thick dark strokes only: thin lines (dimensions, text, hatching) are removed by an opening. */
export function thickMask(px: Pixels, radius: number): Uint8Array {
  const m = darkMask(px);
  return dilate(erode(m, px.width, px.height, radius), px.width, px.height, radius);
}

/**
 * Guess the outer extent of the walls: the bounding box of the thick dark strokes.
 * `radius` should be a little under half the drawn wall thickness in pixels.
 */
export function detectExtents(px: Pixels, radius = Math.max(2, Math.round(Math.max(px.width, px.height) / 400))): PxRect | null {
  const m = thickMask(px, radius);
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < px.height; y++)
    for (let x = 0; x < px.width; x++)
      if (m[y * px.width + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export interface MmRect {
  x: number;
  y: number;
  w: number;
  d: number;
}

/**
 * Find wall rectangles in an already cropped, north-up drawing that covers `w`×`d` mm.
 * Thick dark regions are sampled on a grid (about 50 mm cells), thin lines removed, and the result
 * covered greedily with rectangles. Pieces smaller than ~200 mm are dropped.
 */
export function detectWallRects(px: Pixels, wMm: number, dMm: number, cellMm = 50): MmRect[] {
  const cols = Math.max(1, Math.round(wMm / cellMm));
  const rows = Math.max(1, Math.round(dMm / cellMm));
  const dark = darkMask(px);
  const grid = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c / cols) * px.width);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) / cols) * px.width));
      const y0 = Math.floor((r / rows) * px.height);
      const y1 = Math.max(y0 + 1, Math.floor(((r + 1) / rows) * px.height));
      let n = 0;
      let on = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          n++;
          on += dark[y * px.width + x];
        }
      grid[r * cols + c] = on / n > 0.5 ? 1 : 0;
    }
  }
  // Remove anything thinner than ~2 cells (≈100 mm): text, dimension and stair lines.
  const clean = dilate(erode(grid, cols, rows, 1), cols, rows, 1);
  const used = new Uint8Array(cols * rows);
  const rects: MmRect[] = [];
  const cw = wMm / cols;
  const ch = dMm / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!clean[i] || used[i]) continue;
      let w = 0;
      while (c + w < cols && clean[r * cols + c + w] && !used[r * cols + c + w]) w++;
      let h = 1;
      outer: while (r + h < rows) {
        for (let k = 0; k < w; k++) if (!clean[(r + h) * cols + c + k] || used[(r + h) * cols + c + k]) break outer;
        h++;
      }
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y * cols + x] = 1;
      const rect = { x: c * cw, y: r * ch, w: w * cw, d: h * ch };
      if (Math.max(rect.w, rect.d) >= 200) rects.push(rect);
    }
  }
  return rects;
}

// --------------------------------------------------------------------------------------------
// Browser helpers
// --------------------------------------------------------------------------------------------

export const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf';

/** Render a picture file, or one page of a PDF, onto a canvas (long side about `maxSide` px). */
export async function fileToCanvas(file: Blob, page = 1, maxSide = 2400): Promise<{ canvas: HTMLCanvasElement; pages: number }> {
  if (file.type === 'application/pdf' || (file as File).name?.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
    const base = p.getViewport({ scale: 1 });
    const scale = maxSide / Math.max(base.width, base.height);
    const viewport = p.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvas, viewport }).promise;
    return { canvas, pages: doc.numPages };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This file could not be read as a picture.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { canvas, pages: 1 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasPixels(c: HTMLCanvasElement): Pixels {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Crop, then rotate clockwise and optionally mirror, returning a new canvas (long side ≤ maxSide). */
export function cropRotate(src: HTMLCanvasElement, crop: PxRect, rotation: 0 | 90 | 180 | 270, mirror: boolean, maxSide = 2000): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(crop.w, crop.h));
  const cw = Math.max(1, Math.round(crop.w * scale));
  const ch = Math.max(1, Math.round(crop.h * scale));
  const swap = rotation === 90 || rotation === 270;
  const out = document.createElement('canvas');
  out.width = swap ? ch : cw;
  out.height = swap ? cw : ch;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(src, crop.x, crop.y, crop.w, crop.h, -cw / 2, -ch / 2, cw, ch);
  return out;
}

/** PNG for line drawings; JPEG when the PNG would be large (e.g. photos). */
export function canvasToDataUrl(c: HTMLCanvasElement): string {
  const png = c.toDataURL('image/png');
  return png.length > 1_500_000 ? c.toDataURL('image/jpeg', 0.88) : png;
}
