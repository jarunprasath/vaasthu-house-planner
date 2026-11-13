const PATHS: Record<string, string> = {
  select: 'M5 3l13 7-6 1.5L9.5 18z',
  pan: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  room: 'M4 5h16v14H4zM4 12h7v7',
  wall: 'M3 17L17 3l4 4L7 21z',
  door: 'M5 20V4M5 4a15 15 0 0 1 15 15M5 20h15',
  window: 'M4 6h16v12H4zM4 12h16M12 6v12',
  gate: 'M3 20V8M21 20V8M3 10h18M3 16h18M8 10v6M13 10v6M18 10v6',
  measure: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  plot: 'M4 6l7-3 9 4-2 13H5zM4 6l1 14',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  export: 'M12 3v12M7 10l5 5 5-5M4 19h16',
  folder: 'M3 6h6l2 2h10v11H3z',
  sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  help: 'M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  rebuild: 'M4 4h7v7H4zM13 13h7v7h-7zM11 7h6v6M13 17H7v-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  panel: 'M3 4h18v16H3zM15 4v16',
  compound: 'M3 4h18v16H3zM7 4v3M12 4v3M17 4v3M7 17v3M12 17v3M17 17v3',
};

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
