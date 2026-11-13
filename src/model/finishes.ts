/**
 * Finish and paint catalogue. Colours are flat approximations for on-screen preview, not supplier
 * colour matches — confirm real samples before buying.
 */
export interface FloorFinish {
  id: string;
  label: string;
  color: string;
}

export const FLOOR_FINISHES: FloorFinish[] = [
  { id: 'vitrified_ivory', label: 'Vitrified tile, ivory', color: '#ece4d4' },
  { id: 'vitrified_grey', label: 'Vitrified tile, grey', color: '#c4c5c2' },
  { id: 'ceramic_beige', label: 'Ceramic tile, beige', color: '#dfcdae' },
  { id: 'marble_white', label: 'Marble, white', color: '#f0efe9' },
  { id: 'granite_black', label: 'Granite, black', color: '#38393c' },
  { id: 'granite_tan', label: 'Granite, tan brown', color: '#a88c6c' },
  { id: 'wood_oak', label: 'Wooden flooring, oak', color: '#b5845a' },
  { id: 'athangudi_red', label: 'Athangudi tile, red', color: '#a5442f' },
  { id: 'terracotta', label: 'Terracotta', color: '#b6643f' },
  { id: 'kota_stone', label: 'Kota stone', color: '#7f8a7b' },
  { id: 'concrete', label: 'Concrete', color: '#a5a5a1' },
  { id: 'antiskid_blue', label: 'Anti-slip bathroom tile, blue-grey', color: '#9cb0bc' },
];

export const PAINT_SWATCHES: { name: string; color: string }[] = [
  { name: 'Lime white', color: '#f3f4ee' },
  { name: 'Ivory', color: '#f2ead8' },
  { name: 'Cream', color: '#eee0bf' },
  { name: 'Sandstone', color: '#d6c09c' },
  { name: 'Peach', color: '#f1cfb6' },
  { name: 'Mint', color: '#d3e8d4' },
  { name: 'Sky blue', color: '#cbe0ee' },
  { name: 'Lavender', color: '#dcd6ec' },
  { name: 'Mustard', color: '#d3a538' },
  { name: 'Terracotta', color: '#b6643f' },
  { name: 'Teal', color: '#3e7f86' },
  { name: 'Light grey', color: '#c3c6c9' },
  { name: 'Charcoal', color: '#4a4d52' },
];

export const ROOF_COLOURS: { name: string; color: string }[] = [
  { name: 'Concrete grey', color: '#9b9b97' },
  { name: 'Heat-reflective white', color: '#e8e8e3' },
  { name: 'Clay roof tiles', color: '#a4523a' },
  { name: 'Slate grey', color: '#5d6168' },
];

/** Default floor finish suggestion by room type, applied only when a room has none. */
export function defaultFinishFor(type: string): string | undefined {
  if (type === 'bathroom' || type === 'toilet') return 'antiskid_blue';
  if (type === 'pooja') return 'marble_white';
  if (type === 'portico' || type === 'parking' || type === 'utility') return 'kota_stone';
  if (type === 'staircase') return 'granite_tan';
  if (type === 'balcony' || type === 'terrace' || type === 'sitout') return 'terracotta';
  return undefined;
}

export function floorFinish(id: string | undefined): FloorFinish {
  return FLOOR_FINISHES.find((f) => f.id === id) ?? FLOOR_FINISHES[0];
}
