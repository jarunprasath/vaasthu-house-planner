/**
 * Parametric building model — the single source of truth for every view and export.
 *
 * Conventions
 * - Every length is in MILLIMETRES.
 * - Plan coordinates: origin at the plot's north-west reference corner,
 *   x increases to the EAST, y increases to the SOUTH (north is "up" on screen and on paper).
 * - Rooms are rectangles measured to wall centre-lines.
 */

export const SCHEMA_VERSION = 1;

export type Id = string;

export interface Point {
  x: number;
  y: number;
}

export type Side = 'N' | 'S' | 'E' | 'W';
export const SIDES: Side[] = ['N', 'E', 'S', 'W'];

export type DisplayUnit = 'ft' | 'in' | 'm' | 'cm';

export interface Road {
  side: Side;
  /** Road width, informational (mm). */
  widthMm: number;
}

export interface Plot {
  /** Boundary polygon, clockwise, in plan coordinates (mm). */
  boundary: Point[];
  roads: Road[];
  neighbours: Side[];
  setbacks: Record<Side, number>;
  /** Ground level above the reference road level (mm). */
  elevationMm: number;
  /** Average ground slope in percent, and the side the ground falls towards. */
  slopePercent: number;
  slopeTowards: Side;
  maxFloors: number;
  maxHeightMm: number;
  /** Maximum ground coverage in percent of plot area (0 = no limit). */
  maxCoveragePercent: number;
}

export type RoomType =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'store'
  | 'bedroom'
  | 'master_bedroom'
  | 'bathroom'
  | 'toilet'
  | 'pooja'
  | 'foyer'
  | 'passage'
  | 'utility'
  | 'study'
  | 'portico'
  | 'sitout'
  | 'balcony'
  | 'terrace'
  | 'courtyard'
  | 'staircase'
  | 'parking'
  | 'garden'
  | 'pathway'
  | 'sump'
  | 'septic_tank'
  | 'overhead_tank'
  | 'borewell'
  | 'other';

export interface Room {
  id: Id;
  name: string;
  type: RoomType;
  /** Top-left (north-west) corner, mm. */
  x: number;
  y: number;
  /** East-west size (mm). */
  w: number;
  /** North-south size (mm). */
  d: number;
  locked: boolean;
  /** For staircases: the direction a person walks UP the flight. */
  stairUp?: Side;
  /** Floor finish id (see finishes.ts); falls back to the project default. */
  floorFinish?: string;
  /**
   * Irregular room outline (clockwise, mm). When present, x/y/w/d are its bounding box.
   */
  points?: Point[];
}

export type WallKind = 'exterior' | 'interior' | 'compound';
export type WallMaterial = 'brick' | 'aac_block' | 'concrete_block' | 'stone' | 'rcc';

export interface Wall {
  id: Id;
  a: Point;
  b: Point;
  thicknessMm: number;
  heightMm: number;
  kind: WallKind;
  material: WallMaterial;
  locked: boolean;
}

export type OpeningType = 'door' | 'window' | 'gate';

export interface Opening {
  id: Id;
  wallId: Id;
  type: OpeningType;
  /** Distance from wall start (a) to the opening centre, along the wall (mm). */
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number;
  /** Door hinge side looking from a→b, and which side of the wall it swings into. */
  hinge: 'start' | 'end';
  swing: 'left' | 'right';
  label: string;
  locked: boolean;
  /** The house's main entrance door (used by the Vaasthu checks). */
  isMain?: boolean;
}

export interface Floor {
  id: Id;
  name: string;
  /** 0 = ground floor. */
  level: number;
  /** Floor-to-floor height (mm). */
  heightMm: number;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  /** Furniture, fixtures and outdoor items. */
  items: Item[];
}

/** A piece of furniture, a fixture or an outdoor item, placed by its centre. */
export interface Item {
  id: Id;
  /** Catalogue id (see catalog.ts). */
  type: string;
  /** Centre (mm). */
  x: number;
  y: number;
  /** Size before rotation: width (along its front), depth, height (mm). */
  w: number;
  d: number;
  h: number;
  /** Rotation in degrees, clockwise; 0 = the item's front faces south (towards the bottom of the plan). */
  rotation: number;
  /** Height of the item's base above the floor (wall-mounted units). */
  elevationMm?: number;
  color?: string;
  /** Counter-top colour for kitchen units. */
  topColor?: string;
  label?: string;
  locked: boolean;
}

export interface ProjectSettings {
  unit: DisplayUnit;
  /** Snap step in mm (0 = off). */
  snapMm: number;
  defaultExteriorWallMm: number;
  defaultInteriorWallMm: number;
  defaultWallHeightMm: number;
}

export interface Project {
  schemaVersion: number;
  id: Id;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  plot: Plot;
  floors: Floor[];
  /** Compound wall around the plot (ground level). */
  siteWalls: Wall[];
  /** Gates hosted on site walls. */
  siteOpenings: Opening[];
  /**
   * The house outline on the plot (the building's overall size), or null if not set.
   * It can be sized and moved independently; moving it carries the rooms and walls inside it.
   */
  footprint: Footprint | null;
  vaasthu: VaasthuSettings;
  finishes: Finishes;
  roof: RoofSettings;
  /** Imported plan drawings shown under the plan (one per floor at most). */
  underlays: Underlay[];
  /** Exterior style: sunshades over openings, floor bands. */
  exterior: ExteriorSettings;
}

export type ElevationStyle = 'custom' | 'modern' | 'traditional' | 'contemporary' | 'villa';

export interface ExteriorSettings {
  style: ElevationStyle;
  /** Depth of the sunshade (chajja) over windows and doors in outside walls; 0 = none. */
  sunshadeMm: number;
  /** Horizontal band along the outside walls at each floor slab. */
  bands: boolean;
  bandColor: string;
}

export interface Underlay {
  id: Id;
  floorId: Id;
  name: string;
  /** Cropped, north-up picture as a data URL. */
  dataUrl: string;
  /** Where the picture sits on the plot (mm, north-west corner and size). */
  x: number;
  y: number;
  w: number;
  d: number;
  /** 0–1 */
  opacity: number;
  showIn3d: boolean;
}

export type ZoneRating = 'preferred' | 'acceptable' | 'avoid' | 'neutral';
export type ZoneId = 'NW' | 'N' | 'NE' | 'W' | 'C' | 'E' | 'SW' | 'S' | 'SE';

export interface VaasthuRule {
  /** What the rule applies to: a room type, or 'entrance'. */
  target: RoomType | 'entrance';
  enabled: boolean;
  /** Relative importance (1–3) in the advisory score. */
  weight: number;
  zones: Record<ZoneId, ZoneRating>;
}

export interface VaasthuSettings {
  /** Rules can be edited per project; defaults come from vaasthu/rules.ts. */
  rules: VaasthuRule[];
  /** Keep the centre (Brahmasthan) free of toilets, stairs, kitchen and heavy storage. */
  keepCentreOpen: boolean;
}

export interface Finishes {
  exteriorWall: string;
  interiorWall: string;
  roof: string;
  /** Default floor finish id for rooms without their own. */
  floor: string;
  /** Saved named themes. */
  themes: { name: string; exteriorWall: string; interiorWall: string; roof: string; floor: string }[];
}

export type RoofType = 'flat' | 'gable';
export interface RoofSettings {
  type: RoofType;
  /** Parapet height above the roof slab for flat roofs (0 = none). */
  parapetMm: number;
  slabMm: number;
  /** Gable roof pitch in degrees. */
  pitchDeg: number;
  /** Gable ridge runs east–west or north–south. */
  ridge: 'EW' | 'NS';
}

export interface Footprint {
  /** North-west corner (mm). */
  x: number;
  y: number;
  /** East-west size (mm). */
  w: number;
  /** North-south size (mm). */
  d: number;
  locked: boolean;
}

/** Room types that are open / outdoor and are reported separately from enclosed built-up area. */
export const OUTDOOR_ROOM_TYPES: RoomType[] = [
  'sitout',
  'balcony',
  'terrace',
  'courtyard',
  'parking',
  'garden',
  'pathway',
  'sump',
  'septic_tank',
  'overhead_tank',
  'borewell',
];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: 'Living room',
  dining: 'Dining',
  kitchen: 'Kitchen',
  store: 'Store room',
  bedroom: 'Bedroom',
  master_bedroom: 'Master bedroom',
  bathroom: 'Bathroom',
  toilet: 'Toilet',
  pooja: 'Pooja room',
  foyer: 'Foyer',
  passage: 'Passage',
  utility: 'Utility / wash',
  study: 'Study',
  portico: 'Portico',
  sitout: 'Sit-out',
  balcony: 'Balcony',
  terrace: 'Terrace',
  courtyard: 'Courtyard',
  staircase: 'Staircase',
  parking: 'Parking',
  garden: 'Garden',
  pathway: 'Pathway',
  sump: 'Underground sump',
  septic_tank: 'Septic tank',
  overhead_tank: 'Overhead tank',
  borewell: 'Borewell',
  other: 'Other',
};

export const WALL_MATERIAL_LABELS: Record<WallMaterial, string> = {
  brick: 'Brick',
  aac_block: 'AAC block',
  concrete_block: 'Concrete block',
  stone: 'Stone',
  rcc: 'RCC',
};

/** Fill colours used on screen and in the PDF (light, print-friendly). */
export const ROOM_COLORS: Record<RoomType, string> = {
  living: '#fde7c8',
  dining: '#fbe2b8',
  kitchen: '#f9d0c4',
  store: '#e8ddd3',
  bedroom: '#d6e6f7',
  master_bedroom: '#c8dcf3',
  bathroom: '#cdeef0',
  toilet: '#cdeef0',
  pooja: '#fff1a8',
  foyer: '#efe6d8',
  passage: '#eeeeee',
  utility: '#e2e8d8',
  study: '#e3dcf3',
  portico: '#e6e1d6',
  sitout: '#ece6da',
  balcony: '#e4efe0',
  terrace: '#e9eee5',
  courtyard: '#dcefd6',
  staircase: '#dedede',
  parking: '#e1e1e1',
  garden: '#cfe8c4',
  pathway: '#ebe5dc',
  sump: '#bfe0ee',
  septic_tank: '#d9cfc2',
  overhead_tank: '#a9d3ec',
  borewell: '#9cc6e0',
  other: '#f0f0f0',
};
