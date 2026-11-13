/** Canvas colours (Konva cannot read CSS variables). Mirrors the tokens in index.css. */
export interface CanvasPalette {
  paper: string;
  plotFill: string;
  plotStroke: string;
  grid: string;
  gridMajor: string;
  setback: string;
  wall: string;
  wallInterior: string;
  compound: string;
  ink: string;
  muted: string;
  selection: string;
  road: string;
  neighbour: string;
  zone: string;
  dim: string;
  ghost: string;
  error: string;
}

export const LIGHT: CanvasPalette = {
  paper: '#f6f7f4',
  plotFill: '#ffffff',
  plotStroke: '#1f2a5a',
  grid: '#e7ebe8',
  gridMajor: '#cfd9d2',
  setback: '#8fa596',
  wall: '#1f2a5a',
  wallInterior: '#3f4a78',
  compound: '#6d7488',
  ink: '#1f2a5a',
  muted: '#6d7488',
  selection: '#b8860b',
  road: '#d9dbe0',
  neighbour: '#eceee8',
  zone: '#b8860b',
  dim: '#4b5577',
  ghost: '#9aa3bd',
  error: '#b42318',
};

export const DARK: CanvasPalette = {
  paper: '#121621',
  plotFill: '#171c29',
  plotStroke: '#c9cfe6',
  grid: '#1f2534',
  gridMajor: '#2b3446',
  setback: '#6f8576',
  wall: '#d9def0',
  wallInterior: '#aab2cf',
  compound: '#8e95ab',
  ink: '#e4e7f3',
  muted: '#8e95ab',
  selection: '#e2b44c',
  road: '#2a3040',
  neighbour: '#1d2230',
  zone: '#e2b44c',
  dim: '#b5bcd3',
  ghost: '#4b5577',
  error: '#f97066',
};

/** Room fills are light; in dark mode they are drawn at reduced opacity over the dark plot. */
export const DARK_ROOM_OPACITY = 0.22;
