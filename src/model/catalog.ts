/**
 * Furniture, fixture and outdoor item catalogue.
 *
 * Sizes are typical Indian market sizes in millimetres (width along the front × depth × height),
 * meant as starting points — always edit them to the actual product you choose.
 */
import { newId } from './factory';
import type { Item } from './types';

export type ItemGroup = 'Living' | 'Bedroom' | 'Dining' | 'Kitchen' | 'Bathroom' | 'Pooja & study' | 'Outdoor';

/** 2D plan symbol style. */
export type Symbol =
  | 'sofa'
  | 'bed'
  | 'table'
  | 'dining'
  | 'cabinet'
  | 'wardrobe'
  | 'sink'
  | 'hob'
  | 'fridge'
  | 'wc'
  | 'wcIndian'
  | 'basin'
  | 'shower'
  | 'tub'
  | 'car'
  | 'bike'
  | 'tree'
  | 'shrub'
  | 'circle'
  | 'box';

export interface CatalogEntry {
  id: string;
  label: string;
  group: ItemGroup;
  w: number;
  d: number;
  h: number;
  /** Mounting height above the floor for wall units (mm). */
  elevation?: number;
  color: string;
  symbol: Symbol;
  /** Shown in the Phase-3 checks: needs water / drainage, is a heat source, etc. */
  tags?: ('water' | 'drain' | 'heat' | 'cooking' | 'wc' | 'appliance' | 'counter' | 'wall-unit' | 'outdoor')[];
}

export const CATALOG: CatalogEntry[] = [
  // Living
  { id: 'sofa3', label: 'Sofa, 3-seater', group: 'Living', w: 2100, d: 900, h: 800, color: '#8a7a6a', symbol: 'sofa' },
  { id: 'sofa2', label: 'Sofa, 2-seater', group: 'Living', w: 1500, d: 900, h: 800, color: '#8a7a6a', symbol: 'sofa' },
  { id: 'armchair', label: 'Armchair', group: 'Living', w: 850, d: 850, h: 800, color: '#9b8a76', symbol: 'sofa' },
  { id: 'coffee_table', label: 'Coffee table', group: 'Living', w: 1100, d: 600, h: 420, color: '#7b5537', symbol: 'table' },
  { id: 'tv_unit', label: 'TV unit', group: 'Living', w: 1800, d: 450, h: 500, color: '#5f4632', symbol: 'cabinet' },
  { id: 'shoe_rack', label: 'Shoe rack', group: 'Living', w: 900, d: 350, h: 900, color: '#6f5440', symbol: 'cabinet' },
  { id: 'bookshelf', label: 'Bookshelf', group: 'Living', w: 900, d: 350, h: 1800, color: '#6f5440', symbol: 'cabinet' },
  // Bedroom
  { id: 'bed_king', label: 'Bed, king (6′×6′-8″)', group: 'Bedroom', w: 1830, d: 2030, h: 450, color: '#b9a48c', symbol: 'bed' },
  { id: 'bed_queen', label: 'Bed, queen (5′×6′-8″)', group: 'Bedroom', w: 1525, d: 2030, h: 450, color: '#b9a48c', symbol: 'bed' },
  { id: 'bed_single', label: 'Bed, single (3′×6′-6″)', group: 'Bedroom', w: 915, d: 1980, h: 450, color: '#b9a48c', symbol: 'bed' },
  { id: 'wardrobe', label: 'Wardrobe', group: 'Bedroom', w: 1800, d: 600, h: 2100, color: '#7a5d44', symbol: 'wardrobe' },
  { id: 'dresser', label: 'Dresser', group: 'Bedroom', w: 900, d: 450, h: 750, color: '#7a5d44', symbol: 'cabinet' },
  { id: 'side_table', label: 'Side table', group: 'Bedroom', w: 450, d: 400, h: 550, color: '#7a5d44', symbol: 'cabinet' },
  // Dining
  { id: 'dining4', label: 'Dining table, 4 seats', group: 'Dining', w: 1200, d: 1700, h: 750, color: '#7b5537', symbol: 'dining' },
  { id: 'dining6', label: 'Dining table, 6 seats', group: 'Dining', w: 1800, d: 1700, h: 750, color: '#7b5537', symbol: 'dining' },
  // Kitchen
  { id: 'base_cabinet', label: 'Base cabinet with counter', group: 'Kitchen', w: 600, d: 600, h: 850, color: '#d9d4c7', symbol: 'cabinet', tags: ['counter'] },
  { id: 'sink_unit', label: 'Sink unit', group: 'Kitchen', w: 900, d: 600, h: 850, color: '#d9d4c7', symbol: 'sink', tags: ['counter', 'water', 'drain'] },
  { id: 'hob', label: 'Hob / stove counter', group: 'Kitchen', w: 750, d: 600, h: 850, color: '#d9d4c7', symbol: 'hob', tags: ['counter', 'heat', 'cooking'] },
  { id: 'chimney', label: 'Chimney (hood)', group: 'Kitchen', w: 900, d: 500, h: 550, elevation: 1550, color: '#8a8d92', symbol: 'box', tags: ['wall-unit', 'appliance'] },
  { id: 'wall_cabinet', label: 'Wall cabinet', group: 'Kitchen', w: 600, d: 350, h: 700, elevation: 1450, color: '#e6e1d4', symbol: 'cabinet', tags: ['wall-unit'] },
  { id: 'fridge', label: 'Refrigerator', group: 'Kitchen', w: 700, d: 700, h: 1750, color: '#c9ccd1', symbol: 'fridge', tags: ['appliance'] },
  { id: 'dishwasher', label: 'Dishwasher', group: 'Kitchen', w: 600, d: 600, h: 850, color: '#b8bcc2', symbol: 'cabinet', tags: ['appliance', 'water', 'drain', 'counter'] },
  { id: 'tall_unit', label: 'Tall pantry unit', group: 'Kitchen', w: 600, d: 600, h: 2100, color: '#d9d4c7', symbol: 'wardrobe' },
  { id: 'island', label: 'Kitchen island', group: 'Kitchen', w: 1800, d: 900, h: 900, color: '#d9d4c7', symbol: 'cabinet', tags: ['counter'] },
  // Bathroom
  { id: 'wc_western', label: 'Western toilet (EWC)', group: 'Bathroom', w: 380, d: 700, h: 780, color: '#f4f4f2', symbol: 'wc', tags: ['wc', 'water', 'drain'] },
  { id: 'wc_indian', label: 'Indian toilet (IWC)', group: 'Bathroom', w: 450, d: 600, h: 150, color: '#f4f4f2', symbol: 'wcIndian', tags: ['wc', 'water', 'drain'] },
  { id: 'washbasin', label: 'Washbasin', group: 'Bathroom', w: 500, d: 420, h: 850, color: '#f4f4f2', symbol: 'basin', tags: ['water', 'drain'] },
  { id: 'shower', label: 'Shower area (900×900)', group: 'Bathroom', w: 900, d: 900, h: 2000, color: '#cfe3ea', symbol: 'shower', tags: ['water', 'drain'] },
  { id: 'bathtub', label: 'Bathtub', group: 'Bathroom', w: 1700, d: 750, h: 550, color: '#f4f4f2', symbol: 'tub', tags: ['water', 'drain'] },
  { id: 'mirror', label: 'Mirror', group: 'Bathroom', w: 600, d: 30, h: 800, elevation: 1200, color: '#bcd6e4', symbol: 'box', tags: ['wall-unit'] },
  { id: 'geyser', label: 'Geyser (water heater)', group: 'Bathroom', w: 450, d: 400, h: 450, elevation: 1800, color: '#f0efe9', symbol: 'circle', tags: ['wall-unit', 'appliance', 'water'] },
  { id: 'exhaust_fan', label: 'Exhaust fan', group: 'Bathroom', w: 300, d: 120, h: 300, elevation: 2000, color: '#e2e2de', symbol: 'circle', tags: ['wall-unit', 'appliance'] },
  { id: 'floor_drain', label: 'Floor drain (nahani trap)', group: 'Bathroom', w: 150, d: 150, h: 10, color: '#8a8d92', symbol: 'circle', tags: ['drain'] },
  { id: 'bath_storage', label: 'Bathroom storage cabinet', group: 'Bathroom', w: 600, d: 300, h: 700, elevation: 1200, color: '#e6e1d4', symbol: 'cabinet', tags: ['wall-unit'] },
  // Pooja & study
  { id: 'mandir', label: 'Pooja mandir', group: 'Pooja & study', w: 900, d: 450, h: 1500, color: '#c89b4a', symbol: 'cabinet' },
  { id: 'study_desk', label: 'Study desk', group: 'Pooja & study', w: 1200, d: 600, h: 750, color: '#7b5537', symbol: 'table' },
  { id: 'chair', label: 'Chair', group: 'Pooja & study', w: 500, d: 500, h: 900, color: '#5f4632', symbol: 'box' },
  // Outdoor
  { id: 'car_hatch', label: 'Car, hatchback', group: 'Outdoor', w: 1700, d: 3800, h: 1500, color: '#a4b4c6', symbol: 'car', tags: ['outdoor'] },
  { id: 'car_sedan', label: 'Car, sedan / SUV', group: 'Outdoor', w: 1800, d: 4500, h: 1600, color: '#7f8c99', symbol: 'car', tags: ['outdoor'] },
  { id: 'two_wheeler', label: 'Two-wheeler', group: 'Outdoor', w: 750, d: 1900, h: 1100, color: '#3f4650', symbol: 'bike', tags: ['outdoor'] },
  { id: 'tree', label: 'Tree', group: 'Outdoor', w: 3000, d: 3000, h: 6000, color: '#5d8d4a', symbol: 'tree', tags: ['outdoor'] },
  { id: 'coconut', label: 'Coconut palm', group: 'Outdoor', w: 3500, d: 3500, h: 9000, color: '#5f8f3e', symbol: 'tree', tags: ['outdoor'] },
  { id: 'shrub', label: 'Shrub / flower bed', group: 'Outdoor', w: 900, d: 900, h: 800, color: '#6aa058', symbol: 'shrub', tags: ['outdoor'] },
  { id: 'tulsi', label: 'Tulsi maadam', group: 'Outdoor', w: 600, d: 600, h: 900, color: '#c98a5b', symbol: 'box', tags: ['outdoor'] },
  { id: 'bench', label: 'Garden bench', group: 'Outdoor', w: 1500, d: 600, h: 450, color: '#7b5537', symbol: 'table', tags: ['outdoor'] },
  { id: 'swing', label: 'Swing (oonjal)', group: 'Outdoor', w: 1800, d: 1200, h: 2000, color: '#7b5537', symbol: 'box', tags: ['outdoor'] },
  { id: 'garden_light', label: 'Garden light', group: 'Outdoor', w: 200, d: 200, h: 3000, color: '#3f4650', symbol: 'circle', tags: ['outdoor'] },
  { id: 'rwh_pit', label: 'Rainwater harvesting pit', group: 'Outdoor', w: 1200, d: 1200, h: 100, color: '#8a8d92', symbol: 'circle', tags: ['outdoor', 'drain'] },
];

export const ITEM_GROUPS: ItemGroup[] = ['Living', 'Bedroom', 'Dining', 'Kitchen', 'Bathroom', 'Pooja & study', 'Outdoor'];

export function catalogEntry(type: string): CatalogEntry {
  return CATALOG.find((c) => c.id === type) ?? { id: type, label: type, group: 'Living', w: 600, d: 600, h: 600, color: '#999999', symbol: 'box' };
}

export function createItem(type: string, x: number, y: number, rotation = 0, overrides: Partial<Item> = {}): Item {
  const c = catalogEntry(type);
  return { id: newId(), type, x, y, w: c.w, d: c.d, h: c.h, rotation, elevationMm: c.elevation, locked: false, ...overrides };
}

/** Footprint corners of an item in plan coordinates (mm), honouring rotation. */
export function itemCorners(it: Item): { x: number; y: number }[] {
  const a = (it.rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    [-it.w / 2, -it.d / 2],
    [it.w / 2, -it.d / 2],
    [it.w / 2, it.d / 2],
    [-it.w / 2, it.d / 2],
  ].map(([u, v]) => ({ x: it.x + u * cos - v * sin, y: it.y + u * sin + v * cos }));
}

/** Axis-aligned bounds of an item (mm). */
export function itemBounds(it: Item): { x: number; y: number; w: number; d: number } {
  const c = itemCorners(it);
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

/** Point in front of an item (its "front" faces +v in the local frame), `dist` mm from its front edge. */
export function itemFront(it: Item, dist = 0): { x: number; y: number } {
  const a = (it.rotation * Math.PI) / 180;
  const v = it.d / 2 + dist;
  return { x: it.x - v * Math.sin(a), y: it.y + v * Math.cos(a) };
}

/** Simple 3D primitives in the item's local frame (metres; x across, y up from base, z towards the front). */
export interface Prim {
  shape: 'box' | 'cyl' | 'sphere';
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  opacity?: number;
}

export function itemPrims(it: Item): Prim[] {
  const c = catalogEntry(it.type);
  const W = it.w / 1000;
  const D = it.d / 1000;
  const H = it.h / 1000;
  const col = it.color ?? c.color;
  const top = it.topColor ?? '#3a3a3c';
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color = col, opacity?: number): Prim => ({ shape: 'box', x, y, z, sx, sy, sz, color, opacity });
  switch (c.symbol) {
    case 'sofa':
      return [box(0, H * 0.25, 0.05 * D, W, H * 0.5, D * 0.9), box(0, H * 0.6, -D * 0.4, W, H * 0.8, D * 0.2), box(-W / 2 + 0.08, H * 0.4, 0, 0.16, H * 0.6, D), box(W / 2 - 0.08, H * 0.4, 0, 0.16, H * 0.6, D)];
    case 'bed':
      return [box(0, H * 0.35, 0, W, H * 0.7, D, '#6f5440'), box(0, H * 0.85, 0.02, W * 0.96, H * 0.3, D * 0.94, '#f1ece2'), box(0, 0.5, -D / 2 + 0.03, W, 1.0, 0.06, '#6f5440'), box(-W * 0.24, H + 0.05, -D / 2 + 0.3, W * 0.4, 0.1, 0.35, '#ffffff'), box(W * 0.24, H + 0.05, -D / 2 + 0.3, W * 0.4, 0.1, 0.35, '#ffffff')];
    case 'table':
      return [box(0, H - 0.02, 0, W, 0.04, D), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box((sx * (W - 0.08)) / 2, (H - 0.04) / 2, (sz * (D - 0.08)) / 2, 0.05, H - 0.04, 0.05)))];
    case 'dining': {
      const tableD = Math.max(0.8, D - 0.9);
      const seats = W >= 1.6 ? 3 : 2;
      const chairs: Prim[] = [];
      for (let i = 0; i < seats; i++) {
        const x = -W / 2 + (W / seats) * (i + 0.5);
        chairs.push(box(x, 0.23, -tableD / 2 - 0.25, 0.42, 0.46, 0.42, '#5f4632'), box(x, 0.23, tableD / 2 + 0.25, 0.42, 0.46, 0.42, '#5f4632'));
      }
      return [box(0, H - 0.02, 0, W, 0.04, tableD), box(0, (H - 0.04) / 2, 0, W * 0.15, H - 0.04, tableD * 0.15), ...chairs];
    }
    case 'cabinet':
      return c.tags?.includes('counter')
        ? [box(0, (H - 0.04) / 2, 0, W, H - 0.04, D), box(0, H - 0.02, 0.01, W, 0.04, D + 0.02, top)]
        : [box(0, H / 2, 0, W, H, D)];
    case 'wardrobe':
      return [box(0, H / 2, 0, W, H, D), box(0, H / 2, D / 2 + 0.005, 0.01, H * 0.9, 0.01, '#3a2b20')];
    case 'sink':
      return [box(0, (H - 0.04) / 2, 0, W, H - 0.04, D), box(0, H - 0.02, 0.01, W, 0.04, D + 0.02, top), box(0, H + 0.001, 0.05, W * 0.55, 0.005, D * 0.55, '#b9c3cc')];
    case 'hob':
      return [box(0, (H - 0.04) / 2, 0, W, H - 0.04, D), box(0, H - 0.02, 0.01, W, 0.04, D + 0.02, top), box(0, H + 0.01, 0, W * 0.85, 0.02, D * 0.75, '#1d1d1f')];
    case 'fridge':
      return [box(0, H / 2, 0, W, H, D), box(W * 0.35, H * 0.55, D / 2 + 0.01, 0.03, H * 0.3, 0.02, '#6a6d72')];
    case 'wc':
      return [box(0, 0.2, 0.08, W * 0.9, 0.4, D * 0.6), box(0, 0.6, -D / 2 + 0.1, W, 0.4, 0.2)];
    case 'wcIndian':
      return [box(0, H / 2, 0, W, H, D)];
    case 'basin':
      return [box(0, H - 0.08, 0, W, 0.16, D), box(0, (H - 0.16) / 2, -D / 4, 0.14, H - 0.16, 0.14)];
    case 'shower':
      return [box(0, 0.025, 0, W, 0.05, D, '#e8eef0'), box(W / 2, 1.0, 0, 0.01, 2.0, D, '#cfe3ea', 0.35), box(0, 1.0, D / 2, W, 2.0, 0.01, '#cfe3ea', 0.35)];
    case 'tub':
      return [box(0, H / 2, 0, W, H, D)];
    case 'car':
      return [box(0, 0.45, 0, W, 0.6, D, col), box(0, 1.0, -D * 0.05, W * 0.92, 0.55, D * 0.5, '#2f3a46')];
    case 'bike':
      return [box(0, 0.55, 0, 0.2, 0.7, D * 0.9, col), box(0, 1.0, -D * 0.25, 0.7, 0.08, 0.08, '#1d1d1f')];
    case 'tree': {
      const trunkH = c.id === 'coconut' ? H * 0.85 : H * 0.4;
      return [
        { shape: 'cyl', x: 0, y: trunkH / 2, z: 0, sx: 0.25, sy: trunkH, sz: 0.25, color: '#7a5a3c' },
        { shape: 'sphere', x: 0, y: trunkH + (H - trunkH) / 2, z: 0, sx: W, sy: Math.max(1.2, H - trunkH), sz: D, color: col },
      ];
    }
    case 'shrub':
      return [{ shape: 'sphere', x: 0, y: H / 2, z: 0, sx: W, sy: H, sz: D, color: col }];
    case 'circle':
      return [{ shape: 'cyl', x: 0, y: H / 2, z: 0, sx: W, sy: H, sz: D, color: col }];
    default:
      return [box(0, H / 2, 0, W, H, D)];
  }
}
