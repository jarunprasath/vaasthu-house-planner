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
  showSixteen: boolean;
  /** Language for Vaasthu explanations. */
  lang: 'en' | 'ta';
  /** Right panel tab when nothing is selected. */
  panelTab: 'overview' | 'vaasthu';
  /** 2D plan or 3D model in the centre. */
  viewMode: '2d' | '3d';
  theme: 'light' | 'dark';
  leftOpen: boolean;
  rightOpen: boolean;
  /** Request the canvas to fit the plot into view (incremented to trigger). */
  fitRequest: number;
  dialog: null | 'projects' | 'plot' | 'export' | 'help' | 'compound' | 'vaasthuRules' | 'finishes';

  setTool: (t: Tool) => void;
  setRoomType: (t: RoomType) => void;
  setView: (v: ViewTransform) => void;
  toggle: (key: 'showGrid' | 'showDimensions' | 'showZones' | 'showSetbacks' | 'showFloorBelow' | 'showSixteen') => void;
  setLang: (l: 'en' | 'ta') => void;
  setPanelTab: (t: 'overview' | 'vaasthu') => void;
  setViewMode: (m: '2d' | '3d') => void;
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
      showSixteen: false,
      lang: 'en',
      panelTab: 'overview',
      viewMode: '2d',
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
      setLang: (lang) => set({ lang }),
      setPanelTab: (panelTab) => set({ panelTab }),
      setViewMode: (viewMode) => set({ viewMode }),
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
        showSixteen: s.showSixteen,
        lang: s.lang,
        theme: s.theme,
      }),
    },
  ),
);
