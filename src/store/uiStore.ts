import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoomType } from '../model/types';

export type Tool = 'select' | 'pan' | 'room' | 'wall' | 'door' | 'window' | 'gate' | 'measure' | 'plot';

export interface ViewTransform {
  /** Screen pixels per millimetre. */
  scale: number;
  /** Screen position of the model origin. */
  x: number;
  y: number;
}

interface UiState {
  tool: Tool;
  roomType: RoomType;
  view: ViewTransform;
  showGrid: boolean;
  showDimensions: boolean;
  showZones: boolean;
  showSetbacks: boolean;
  showFloorBelow: boolean;
  theme: 'light' | 'dark';
  leftOpen: boolean;
  rightOpen: boolean;
  /** Request the canvas to fit the plot into view (incremented to trigger). */
  fitRequest: number;
  dialog: null | 'projects' | 'plot' | 'export' | 'help' | 'compound';

  setTool: (t: Tool) => void;
  setRoomType: (t: RoomType) => void;
  setView: (v: ViewTransform) => void;
  toggle: (key: 'showGrid' | 'showDimensions' | 'showZones' | 'showSetbacks' | 'showFloorBelow') => void;
  setTheme: (t: 'light' | 'dark') => void;
  setPanels: (p: Partial<Pick<UiState, 'leftOpen' | 'rightOpen'>>) => void;
  requestFit: () => void;
  openDialog: (d: UiState['dialog']) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      tool: 'select',
      roomType: 'bedroom',
      view: { scale: 0.05, x: 40, y: 40 },
      showGrid: true,
      showDimensions: true,
      showZones: false,
      showSetbacks: true,
      showFloorBelow: true,
      theme:
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      leftOpen: true,
      rightOpen: true,
      fitRequest: 0,
      dialog: null,

      setTool: (tool) => set({ tool }),
      setRoomType: (roomType) => set({ roomType }),
      setView: (view) => set({ view }),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<UiState>),
      setTheme: (theme) => set({ theme }),
      setPanels: (p) => set(p),
      requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
      openDialog: (dialog) => set({ dialog }),
    }),
    {
      name: 'vhp-ui',
      partialize: (s) => ({
        showGrid: s.showGrid,
        showDimensions: s.showDimensions,
        showZones: s.showZones,
        showSetbacks: s.showSetbacks,
        showFloorBelow: s.showFloorBelow,
        theme: s.theme,
      }),
    },
  ),
);
