/** Paper and scale constants, kept separate so the UI can use them without loading jsPDF. */
export type PaperSize = 'a4' | 'a3' | 'a2';
export const PAPER_MM: Record<PaperSize, { w: number; h: number }> = {
  a4: { w: 297, h: 210 },
  a3: { w: 420, h: 297 },
  a2: { w: 594, h: 420 },
};
/** Standard architectural scales (1:n). */
export const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 1000];

