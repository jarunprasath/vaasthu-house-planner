import { create } from 'zustand';
import type { Point } from '../model/types';

/** Pointer position in model coordinates — kept separate so pointer moves don't re-render the canvas. */
export const useCursorStore = create<{ p: Point | null; set: (p: Point | null) => void }>()((set) => ({
  p: null,
  set: (p) => set({ p }),
}));
