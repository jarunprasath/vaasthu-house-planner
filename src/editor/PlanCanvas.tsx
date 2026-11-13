import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { createRoom, createWall } from '../model/factory';
import {
  boundingBox,
  dist,
  distanceToSegment,
  edgeSide,
  insetPolygon,
  normRect,
  projectT,
  snap,
  snapPoint,
  wallLength,
  ZONE_GRID,
} from '../model/geometry';
import { formatLength, gridStepMm } from '../model/units';
import type { Point, Wall } from '../model/types';
import { clearances, houseContents } from '../model/footprint';
import { evaluate } from '../vaasthu/engine';

const SIXTEEN = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const RATING_COLOR = { preferred: '#2f855a', acceptable: '#b7791f', neutral: '#8a8f9c', avoid: '#c53030' } as const;
import { activeFloor, useProjectStore } from '../store/projectStore';
import { useCursorStore } from '../store/cursorStore';
import { useUiStore } from '../store/uiStore';
import { DARK, LIGHT } from './palette';
import { DimensionLine, OpeningShape, px, RoomLabel, roomFill, StairArrow, WallShape } from './shapes';

const MIN_ROOM_MM = 300;

export function PlanCanvas({ stageRef }: { stageRef: React.RefObject<Konva.Stage | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const commit = useProjectStore((s) => s.commit);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const updateWall = useProjectStore((s) => s.updateWall);
  const updateOpening = useProjectStore((s) => s.updateOpening);
  const addRoom = useProjectStore((s) => s.addRoom);
  const addWall = useProjectStore((s) => s.addWall);
  const addOpening = useProjectStore((s) => s.addOpening);
  const updateFootprint = useProjectStore((s) => s.updateFootprint);
  const moveHouse = useProjectStore((s) => s.moveHouse);

  const ui = useUiStore();
  const { view, tool } = ui;
  const palette = ui.theme === 'dark' ? DARK : LIGHT;
  const dark = ui.theme === 'dark';
  const unit = project.settings.unit;
  const snapMm = project.settings.snapMm;
  const setCursor = useCursorStore((s) => s.set);

  const floor = activeFloor({ project, activeFloorId });
  const floorBelow = useMemo(
    () => project.floors.filter((f) => f.level < floor.level).sort((a, b) => b.level - a.level)[0],
    [project.floors, floor.level],
  );
  const isGround = floor.level === 0;

  // House outline: while it is being dragged, rooms and walls inside it are drawn shifted by the drag.
  const fp = project.footprint;
  const [houseDrag, setHouseDrag] = useState<{ dx: number; dy: number } | null>(null);
  const houseInside = useMemo(() => (fp ? houseContents(project, fp) : null), [project, fp]);
  const shiftOf = (id: string, kind: 'room' | 'wall') =>
    houseDrag && houseInside && (kind === 'room' ? houseInside.rooms : houseInside.walls).has(id) ? houseDrag : null;
  const liveWall = (w: Wall): Wall => {
    const o = shiftOf(w.id, 'wall');
    return o ? { ...w, a: { x: w.a.x + o.dx, y: w.a.y + o.dy }, b: { x: w.b.x + o.dx, y: w.b.y + o.dy } } : w;
  };
  const liveFp = fp && houseDrag ? { ...fp, x: fp.x + houseDrag.dx, y: fp.y + houseDrag.dy } : fp;
  const footprintRectRef = useRef<Konva.Rect>(null);

  // Drafting state
  const [draftRect, setDraftRect] = useState<{ a: Point; b: Point } | null>(null);
  const [wallChain, setWallChain] = useState<{ start: Point; current: Point } | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point | null } | null>(null);
  const [measureHover, setMeasureHover] = useState<Point | null>(null);
  const [hoverWall, setHoverWall] = useState<{ wall: Wall; site: boolean; offset: number } | null>(null);
  const panRef = useRef<{ start: Point; view: { x: number; y: number } } | null>(null);
  const pinchRef = useRef<{ dist: number; center: Point; view: typeof view } | null>(null);
  const shiftRef = useRef(false);

  const transformerRef = useRef<Konva.Transformer>(null);
  const roomRectRefs = useRef(new Map<string, Konva.Rect>());

  // ---------- size & fit ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const box = boundingBox(project.plot.boundary);
    if (box.w <= 0 || box.d <= 0 || size.w < 50) return;
    const margin = Math.min(90, size.w * 0.08 + 20);
    const scale = Math.min((size.w - margin * 2) / box.w, (size.h - margin * 2) / box.d);
    ui.setView({
      scale,
      x: (size.w - box.w * scale) / 2 - box.x * scale,
      y: (size.h - box.d * scale) / 2 - box.y * scale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.plot.boundary, size.w, size.h]);

  useEffect(() => {
    fit();
    // Fit on load / explicit request / first real size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.fitRequest, project.id, size.w > 50]);

  // ---------- keyboard: shift + escape ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
      if (e.key === 'Escape') {
        setDraftRect(null);
        setWallChain(null);
        setMeasure(null);
      }
    };
    const up = (e: KeyboardEvent) => (shiftRef.current = e.shiftKey);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    setDraftRect(null);
    setWallChain(null);
    setHoverWall(null);
    if (tool !== 'measure') setMeasure(null);
  }, [tool, activeFloorId]);

  // ---------- transformer attach ----------
  const selectedRoom = selection?.kind === 'room' ? floor.rooms.find((r) => r.id === selection.id) : undefined;
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    let node: Konva.Rect | null | undefined =
      selectedRoom && !selectedRoom.locked && tool === 'select' ? roomRectRefs.current.get(selectedRoom.id) : undefined;
    if (selection?.kind === 'footprint' && fp && !fp.locked && tool === 'select') node = footprintRectRef.current;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedRoom, selection, fp, tool, project]);

  // ---------- coordinate helpers ----------
  const toWorld = useCallback(
    (p: Point): Point => ({ x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale }),
    [view],
  );
  const snapped = (p: Point) => snapPoint(p, snapMm);

  const nearestWall = (p: Point): { wall: Wall; site: boolean; offset: number } | null => {
    const tolerance = 14 / view.scale;
    const candidates: { wall: Wall; site: boolean }[] =
      tool === 'gate'
        ? project.siteWalls.map((w) => ({ wall: w, site: true }))
        : floor.walls.map((w) => ({ wall: w, site: false }));
    let best: { wall: Wall; site: boolean; d: number } | null = null;
    for (const c of candidates) {
      const d = distanceToSegment(p, c.wall.a, c.wall.b);
      if (d <= Math.max(tolerance, c.wall.thicknessMm / 2) && (!best || d < best.d)) best = { ...c, d };
    }
    if (!best) return null;
    const len = wallLength(best.wall);
    const offset = Math.min(Math.max(snap(projectT(p, best.wall.a, best.wall.b) * len, snapMm), 0), len);
    return { wall: best.wall, site: best.site, offset };
  };

  // ---------- stage events ----------
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!p) return;
    const factor = Math.exp(-e.evt.deltaY * 0.0015);
    const scale = Math.min(Math.max(view.scale * factor, 0.004), 2);
    const world = toWorld(p);
    ui.setView({ scale, x: p.x - world.x * scale, y: p.y - world.y * scale });
  };

  const isEmptyTarget = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) =>
    e.target === e.target.getStage() || e.target.name() === 'background';

  const onPointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const evt = e.evt as MouseEvent & TouchEvent;
    if (evt.touches && evt.touches.length === 2) return; // pinch handled separately
    const st = stageRef.current;
    const screen = st?.getPointerPosition();
    if (!screen) return;
    const p = toWorld(screen);
    const middle = (evt as MouseEvent).button === 1;

    if (tool === 'pan' || middle || (tool === 'select' && isEmptyTarget(e))) {
      if (tool === 'select' && isEmptyTarget(e) && !middle) select(null);
      panRef.current = { start: screen, view: { x: view.x, y: view.y } };
      return;
    }
    if (tool === 'room') {
      const s = snapped(p);
      setDraftRect({ a: s, b: s });
      return;
    }
    if (tool === 'wall') {
      const s = snapped(p);
      if (!wallChain) {
        setWallChain({ start: s, current: s });
      } else {
        const end = orthoEnd(wallChain.start, s);
        if (dist(wallChain.start, end) > 50) {
          addWall(
            createWall(
              wallChain.start,
              end,
              'exterior',
              project.settings.defaultExteriorWallMm,
              project.settings.defaultWallHeightMm,
            ),
          );
          setWallChain({ start: end, current: end });
        }
      }
      return;
    }
    if (tool === 'door' || tool === 'window' || tool === 'gate') {
      const hit = nearestWall(p);
      if (hit) {
        addOpening(tool, hit.wall.id, hit.offset, hit.site);
        ui.setTool('select');
      }
      return;
    }
    if (tool === 'measure') {
      const s = snapped(p);
      if (!measure || measure.b) setMeasure({ a: s, b: null });
      else setMeasure({ a: measure.a, b: s });
    }
  };

  const orthoEnd = (a: Point, b: Point): Point => {
    if (shiftRef.current) return b;
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  };

  const onPointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const evt = e.evt as TouchEvent;
    if (evt.touches && evt.touches.length === 2) {
      handlePinch(evt);
      return;
    }
    const st = stageRef.current;
    const screen = st?.getPointerPosition();
    if (!screen) return;
    const p = toWorld(screen);
    setCursor(p);
    if (panRef.current) {
      const pr = panRef.current;
      ui.setView({ scale: view.scale, x: pr.view.x + screen.x - pr.start.x, y: pr.view.y + screen.y - pr.start.y });
      return;
    }
    if (draftRect) setDraftRect({ a: draftRect.a, b: snapped(p) });
    else if (wallChain) setWallChain({ start: wallChain.start, current: orthoEnd(wallChain.start, snapped(p)) });
    if (tool === 'door' || tool === 'window' || tool === 'gate') setHoverWall(nearestWall(p));
    if (tool === 'measure') setMeasureHover(snapped(p));
  };
  const onPointerUp = () => {
    panRef.current = null;
    pinchRef.current = null;
    if (draftRect) {
      const r = normRect(draftRect.a, draftRect.b);
      setDraftRect(null);
      if (r.w >= MIN_ROOM_MM && r.d >= MIN_ROOM_MM) {
        const room = createRoom(ui.roomType, r.x, r.y, r.w, r.d);
        if (room.type === 'staircase') room.stairUp = 'N';
        addRoom(room);
        ui.setTool('select');
      }
    }
  };

  const onDblClick = () => {
    if (tool === 'wall') setWallChain(null);
  };

  const handlePinch = (evt: TouchEvent) => {
    evt.preventDefault();
    const st = stageRef.current;
    if (!st) return;
    const rect = st.container().getBoundingClientRect();
    const t1 = { x: evt.touches[0].clientX - rect.left, y: evt.touches[0].clientY - rect.top };
    const t2 = { x: evt.touches[1].clientX - rect.left, y: evt.touches[1].clientY - rect.top };
    const center = { x: (t1.x + t2.x) / 2, y: (t1.y + t2.y) / 2 };
    const d = dist(t1, t2);
    panRef.current = null;
    if (!pinchRef.current) {
      pinchRef.current = { dist: d, center, view };
      return;
    }
    const start = pinchRef.current;
    const scale = Math.min(Math.max(start.view.scale * (d / start.dist), 0.004), 2);
    const world = { x: (start.center.x - start.view.x) / start.view.scale, y: (start.center.y - start.view.y) / start.view.scale };
    ui.setView({ scale, x: center.x - world.x * scale, y: center.y - world.y * scale });
  };

  // ---------- derived drawing data ----------
  const boundary = project.plot.boundary;
  const box = useMemo(() => boundingBox(boundary), [boundary]);
  const inset = useMemo(() => insetPolygon(boundary, project.plot.setbacks), [boundary, project.plot.setbacks]);
  const flat = (pts: Point[]) => pts.flatMap((p) => [p.x, p.y]);

  const gridLines = useMemo(() => {
    if (!ui.showGrid) return [];
    const step = gridStepMm(unit);
    const minor = step * view.scale < 8 ? step * 5 : step;
    const margin = minor * 4;
    const lines: { pts: number[]; major: boolean }[] = [];
    const x0 = Math.floor((box.x - margin) / minor) * minor;
    const y0 = Math.floor((box.y - margin) / minor) * minor;
    for (let x = x0; x <= box.x + box.w + margin; x += minor)
      lines.push({ pts: [x, box.y - margin, x, box.y + box.d + margin], major: Math.round(x / minor) % 5 === 0 });
    for (let y = y0; y <= box.y + box.d + margin; y += minor)
      lines.push({ pts: [box.x - margin, y, box.x + box.w + margin, y], major: Math.round(y / minor) % 5 === 0 });
    return lines;
  }, [ui.showGrid, unit, view.scale, box]);

  const edges = boundary.map((a, i) => {
    const b = boundary[(i + 1) % boundary.length];
    return { a, b, side: edgeSide(a, b) };
  });

  const buildingBox = useMemo(() => {
    const pts = floor.walls.flatMap((w) => [w.a, w.b]);
    return pts.length ? boundingBox(pts) : null;
  }, [floor.walls]);

  const vaasthu = useMemo(() => (ui.showZones || ui.showSixteen ? evaluate(project) : null), [project, ui.showZones, ui.showSixteen]);
  const vg = vaasthu?.houseGrid ?? box;

  const s = view.scale;
  const fsLabel = px(12, s);

  // ---------- render ----------
  const cursorStyle =
    tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : tool === 'measure' ? 'crosshair' : 'crosshair';

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ cursor: cursorStyle, background: palette.paper, touchAction: 'none' }}>
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        onWheel={onWheel}
        onMouseDown={onPointerDown}
        onTouchStart={onPointerDown}
        onMouseMove={onPointerMove}
        onTouchMove={onPointerMove}
        onMouseUp={onPointerUp}
        onTouchEnd={onPointerUp}
        onMouseLeave={() => {
          setCursor(null);
          onPointerUp();
        }}
        onDblClick={onDblClick}
        onDblTap={onDblClick}
      >
        {/* ---------- site layer ---------- */}
        <Layer listening={false}>
          <Group x={view.x} y={view.y} scaleX={s} scaleY={s}>
            {/* roads & neighbours drawn as bands outside the plot edges */}
            {edges.map((e, i) => {
              const road = project.plot.roads.find((r) => r.side === e.side);
              const neighbour = project.plot.neighbours.includes(e.side);
              if (!road && !neighbour) return null;
              const len = dist(e.a, e.b) || 1;
              const dir = { x: (e.b.x - e.a.x) / len, y: (e.b.y - e.a.y) / len };
              const out = { x: dir.y, y: -dir.x };
              const depth = road ? Math.min(road.widthMm, 6000) : 2500;
              const gap = 0;
              const p = [
                e.a,
                e.b,
                { x: e.b.x + out.x * depth, y: e.b.y + out.y * depth },
                { x: e.a.x + out.x * depth, y: e.a.y + out.y * depth },
              ].map((q) => ({ x: q.x + out.x * gap, y: q.y + out.y * gap }));
              const mid = { x: (e.a.x + e.b.x) / 2 + (out.x * depth) / 2, y: (e.a.y + e.b.y) / 2 + (out.y * depth) / 2 };
              const vertical = Math.abs(dir.y) > Math.abs(dir.x);
              const label = road ? `Road, ${formatLength(road.widthMm, unit)} wide` : 'Neighbouring property';
              const tw = fsLabel * label.length * 0.62;
              return (
                <Group key={i}>
                  <Line points={flat(p)} closed fill={road ? palette.road : palette.neighbour} opacity={road ? 1 : 0.9} />
                  {!road && (
                    <Line points={flat(p)} closed stroke={palette.muted} strokeWidth={0.6} strokeScaleEnabled={false} dash={[4, 4]} opacity={0.5} />
                  )}
                  <Group x={mid.x} y={mid.y} rotation={vertical ? -90 : 0}>
                    <Text
                      text={label}
                      x={-tw / 2}
                      y={-fsLabel / 2}
                      width={tw}
                      align="center"
                      fontSize={fsLabel}
                      fill={palette.muted}
                    />
                  </Group>
                </Group>
              );
            })}

            <Line points={flat(boundary)} closed fill={palette.plotFill} name="background" />

            {gridLines.map((g, i) => (
              <Line key={i} points={g.pts} stroke={g.major ? palette.gridMajor : palette.grid} strokeWidth={g.major ? 1 : 0.6} strokeScaleEnabled={false} />
            ))}

            {ui.showSetbacks && inset.length >= 3 && (
              <Line points={flat(inset)} closed stroke={palette.setback} strokeWidth={1.5} strokeScaleEnabled={false} dash={[10, 6]} />
            )}

            <Line points={flat(boundary)} closed stroke={palette.plotStroke} strokeWidth={2} strokeScaleEnabled={false} />

            {ui.showDimensions && (
              <>
                {edges.map((e, i) => (
                  <DimensionLine key={i} a={e.a} b={e.b} offset={-22} unit={unit} scale={s} color={palette.dim} />
                ))}
                {ui.showSetbacks &&
                  edges.map((e, i) => {
                    const sb = project.plot.setbacks[e.side];
                    if (!sb) return null;
                    const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
                    const len = dist(e.a, e.b) || 1;
                    const inward = { x: -(e.b.y - e.a.y) / len, y: (e.b.x - e.a.x) / len };
                    const along = { x: (e.b.x - e.a.x) / len, y: (e.b.y - e.a.y) / len };
                    const base = { x: mid.x + along.x * len * 0.18, y: mid.y + along.y * len * 0.18 };
                    return (
                      <DimensionLine
                        key={`sb${i}`}
                        a={base}
                        b={{ x: base.x + inward.x * sb, y: base.y + inward.y * sb }}
                        offset={0}
                        unit={unit}
                        scale={s}
                        color={palette.setback}
                      />
                    );
                  })}
              </>
            )}

            {/* floor below, ghosted */}
            {ui.showFloorBelow && floorBelow && (
              <Group opacity={0.5}>
                {floorBelow.walls.map((w) => (
                  <WallShape key={w.id} wall={w} palette={palette} selected={false} scale={s} dimmed />
                ))}
              </Group>
            )}
          </Group>
        </Layer>

        {/* ---------- design layer ---------- */}
        <Layer>
          <Group x={view.x} y={view.y} scaleX={s} scaleY={s}>
            {/* ---------- house outline ---------- */}
            {liveFp && fp && (
              <Group
                x={liveFp.x}
                y={liveFp.y}
                draggable={tool === 'select' && !fp.locked}
                onMouseDown={(e) => {
                  if (tool !== 'select') return;
                  e.cancelBubble = true;
                  select({ kind: 'footprint', id: 'footprint' });
                }}
                onTouchStart={(e) => {
                  if (tool !== 'select') return;
                  e.cancelBubble = true;
                  select({ kind: 'footprint', id: 'footprint' });
                }}
                onDragMove={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const n = e.target;
                  const dx = snap(n.x() - fp.x, snapMm);
                  const dy = snap(n.y() - fp.y, snapMm);
                  n.position({ x: fp.x + dx, y: fp.y + dy });
                  setHouseDrag({ dx, dy });
                }}
                onDragEnd={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const n = e.target;
                  const dx = snap(n.x() - fp.x, snapMm);
                  const dy = snap(n.y() - fp.y, snapMm);
                  setHouseDrag(null);
                  moveHouse(dx, dy);
                }}
                name="footprint"
              >
                <Rect
                  ref={footprintRectRef}
                  width={liveFp.w}
                  height={liveFp.d}
                  fill={palette.selection}
                  opacity={selection?.kind === 'footprint' ? 0.1 : 0.05}
                  onTransformEnd={(e) => {
                    const n = e.target as Konva.Rect;
                    const nx = snap(fp.x + n.x(), snapMm);
                    const ny = snap(fp.y + n.y(), snapMm);
                    const right = snap(fp.x + n.x() + n.width() * n.scaleX(), snapMm);
                    const bottom = snap(fp.y + n.y() + n.height() * n.scaleY(), snapMm);
                    n.scaleX(1);
                    n.scaleY(1);
                    n.position({ x: 0, y: 0 });
                    updateFootprint({ x: nx, y: ny, w: Math.max(1000, right - nx), d: Math.max(1000, bottom - ny) });
                  }}
                />
                <Rect
                  width={liveFp.w}
                  height={liveFp.d}
                  stroke={palette.selection}
                  strokeWidth={selection?.kind === 'footprint' ? 3 : 2}
                  strokeScaleEnabled={false}
                  dash={[12, 6]}
                  listening={false}
                />
              </Group>
            )}

            {floor.rooms.map((r) => {
              const sel = selection?.kind === 'room' && selection.id === r.id;
              const { fill, opacity } = roomFill(r, dark);
              const canDrag = tool === 'select' && !r.locked;
              return (
                <Group
                  key={r.id}
                  x={r.x + (shiftOf(r.id, 'room')?.dx ?? 0)}
                  y={r.y + (shiftOf(r.id, 'room')?.dy ?? 0)}
                  draggable={canDrag}
                  onMouseDown={(e) => {
                    if (tool !== 'select') return;
                    e.cancelBubble = true;
                    select({ kind: 'room', id: r.id });
                  }}
                  onTouchStart={(e) => {
                    if (tool !== 'select') return;
                    e.cancelBubble = true;
                    select({ kind: 'room', id: r.id });
                  }}
                  onDragMove={(e) => {
                    const n = e.target;
                    n.x(snap(n.x(), snapMm));
                    n.y(snap(n.y(), snapMm));
                  }}
                  onDragEnd={(e) => {
                    const n = e.target;
                    updateRoom(r.id, { x: n.x(), y: n.y() });
                  }}
                  name="room"
                >
                  <Rect
                    ref={(node) => {
                      if (node) roomRectRefs.current.set(r.id, node);
                      else roomRectRefs.current.delete(r.id);
                    }}
                    width={r.w}
                    height={r.d}
                    fill={fill}
                    opacity={opacity}
                    stroke={sel ? palette.selection : r.type === 'garden' || r.type === 'pathway' ? palette.setback : undefined}
                    strokeWidth={sel ? 2.5 : 1}
                    strokeScaleEnabled={false}
                    dash={r.type === 'pathway' || r.type === 'garden' ? [6, 4] : undefined}
                    onTransformEnd={(e) => {
                      const n = e.target as Konva.Rect;
                      const sx = n.scaleX();
                      const sy = n.scaleY();
                      const nx = snap(r.x + n.x(), snapMm);
                      const ny = snap(r.y + n.y(), snapMm);
                      const right = snap(r.x + n.x() + n.width() * sx, snapMm);
                      const bottom = snap(r.y + n.y() + n.height() * sy, snapMm);
                      n.scaleX(1);
                      n.scaleY(1);
                      n.x(0);
                      n.y(0);
                      updateRoom(r.id, {
                        x: nx,
                        y: ny,
                        w: Math.max(MIN_ROOM_MM, right - nx),
                        d: Math.max(MIN_ROOM_MM, bottom - ny),
                      });
                    }}
                  />
                  {r.type === 'staircase' && <StairArrow room={r} color={palette.ink} scale={s} />}
                  <RoomLabel room={r} unit={unit} scale={s} color={palette.ink} />
                  {r.locked && <Text text="🔒" x={px(4, s)} y={px(3, s)} fontSize={px(11, s)} listening={false} />}
                </Group>
              );
            })}

            {isGround &&
              project.siteWalls.map((w) => (
                <WallShape
                  key={w.id}
                  wall={w}
                  palette={palette}
                  scale={s}
                  selected={selection?.kind === 'siteWall' && selection.id === w.id}
                  onSelect={tool === 'select' ? () => select({ kind: 'siteWall', id: w.id }) : undefined}
                />
              ))}

            {floor.walls.map((w) => {
              const sel = selection?.kind === 'wall' && selection.id === w.id;
              return (
                <WallShape
                  key={w.id}
                  wall={liveWall(w)}
                  palette={palette}
                  scale={s}
                  selected={sel}
                  onSelect={tool === 'select' ? () => select({ kind: 'wall', id: w.id }) : undefined}
                  draggable={tool === 'select' && sel && !w.locked}
                  onDragEnd={(e) => {
                    const n = e.target;
                    const dx = snap(n.x(), snapMm);
                    const dy = snap(n.y(), snapMm);
                    n.position({ x: 0, y: 0 });
                    if (dx || dy) updateWall(w.id, { a: { x: w.a.x + dx, y: w.a.y + dy }, b: { x: w.b.x + dx, y: w.b.y + dy } });
                  }}
                />
              );
            })}

            {[
              ...floor.openings.map((o) => ({ o, wall: floor.walls.find((w) => w.id === o.wallId), site: false })),
              ...(isGround
                ? project.siteOpenings.map((o) => ({ o, wall: project.siteWalls.find((w) => w.id === o.wallId), site: true }))
                : []),
            ].map(({ o, wall: hostWall, site }) => {
              if (!hostWall) return null;
              const wall = site ? hostWall : liveWall(hostWall);
              const kind = site ? 'siteOpening' : 'opening';
              const sel = selection?.kind === kind && selection.id === o.id;
              const len = wallLength(wall);
              return (
                <OpeningShape
                  key={o.id}
                  opening={o}
                  wall={wall}
                  palette={palette}
                  scale={s}
                  selected={sel}
                  onSelect={tool === 'select' ? () => select({ kind, id: o.id }) : undefined}
                  draggable={tool === 'select' && !o.locked}
                  onDragMove={(e) => {
                    const n = e.target;
                    const t = projectT({ x: n.x(), y: n.y() }, wall.a, wall.b);
                    const off = Math.min(Math.max(snap(t * len, snapMm), o.widthMm / 2), len - o.widthMm / 2);
                    n.position({ x: wall.a.x + ((wall.b.x - wall.a.x) / len) * off, y: wall.a.y + ((wall.b.y - wall.a.y) / len) * off });
                  }}
                  onDragEnd={(e) => {
                    const n = e.target;
                    const off = projectT({ x: n.x(), y: n.y() }, wall.a, wall.b) * len;
                    updateOpening(o.id, { offsetMm: off }, site);
                  }}
                />
              );
            })}

            {/* house size tab (drag handle) and clearances to the plot boundary */}
            {liveFp && fp && (
              <>
                <Group
                  x={liveFp.x}
                  y={liveFp.y - px(24, s)}
                  draggable={tool === 'select' && !fp.locked}
                  onMouseDown={(e) => {
                    if (tool !== 'select') return;
                    e.cancelBubble = true;
                    select({ kind: 'footprint', id: 'footprint' });
                  }}
                  onDragMove={(e) => {
                    const n = e.target;
                    const dx = snap(n.x() - fp.x, snapMm);
                    const dy = snap(n.y() + px(24, s) - fp.y, snapMm);
                    n.position({ x: fp.x + dx, y: fp.y + dy - px(24, s) });
                    setHouseDrag({ dx, dy });
                  }}
                  onDragEnd={(e) => {
                    const n = e.target;
                    const dx = snap(n.x() - fp.x, snapMm);
                    const dy = snap(n.y() + px(24, s) - fp.y, snapMm);
                    setHouseDrag(null);
                    moveHouse(dx, dy);
                  }}
                  name="footprint-tab"
                >
                  {(() => {
                    const label = `House ${formatLength(liveFp.w, unit)} × ${formatLength(liveFp.d, unit)}${fp.locked ? '  (locked)' : ''}`;
                    const fs = px(12, s);
                    const w = fs * label.length * 0.56 + px(16, s);
                    return (
                      <>
                        <Rect width={w} height={px(20, s)} fill={palette.selection} cornerRadius={px(3, s)} />
                        <Text text={label} x={px(8, s)} y={px(4, s)} fontSize={fs} fontStyle="bold" fill={palette.plotFill} listening={false} />
                      </>
                    );
                  })()}
                </Group>
                {ui.showDimensions &&
                  clearances(liveFp, project.plot.boundary).map((c) => (
                    <Group key={c.side} listening={false}>
                      <DimensionLine
                        a={c.from}
                        b={c.to}
                        offset={0}
                        unit={unit}
                        scale={s}
                        color={palette.selection}
                      />
                    </Group>
                  ))}
              </>
            )}

            {/* Vaasthu rating markers on the active floor */}
            {ui.showZones &&
              vaasthu?.items
                .filter((i) => i.floorId === floor.id)
                .map((i) => {
                  const r = i.elementKind === 'room' ? floor.rooms.find((x) => x.id === i.elementId) : null;
                  const o = i.elementKind === 'opening' ? floor.openings.find((x) => x.id === i.elementId) : null;
                  const w = o ? floor.walls.find((x) => x.id === o.wallId) : null;
                  const pt = r
                    ? { x: r.x + r.w - px(10, s), y: r.y + px(10, s) }
                    : o && w
                      ? { x: w.a.x + ((w.b.x - w.a.x) / wallLength(w)) * o.offsetMm, y: w.a.y + ((w.b.y - w.a.y) / wallLength(w)) * o.offsetMm }
                      : null;
                  if (!pt) return null;
                  const mark = i.rating === 'preferred' ? '✓' : i.rating === 'avoid' ? '!' : i.rating === 'acceptable' ? '~' : '·';
                  return (
                    <Group key={i.key} x={pt.x} y={pt.y} listening={false}>
                      <Circle radius={px(8, s)} fill={RATING_COLOR[i.rating]} stroke={palette.plotFill} strokeWidth={1.5} strokeScaleEnabled={false} />
                      <Text text={mark} x={-px(8, s)} y={-px(6, s)} width={px(16, s)} align="center" fontSize={px(11, s)} fontStyle="bold" fill="#ffffff" />
                    </Group>
                  );
                })}
            {ui.showZones &&
              vaasthu?.centreIssues
                .filter((c) => c.floorId === floor.id)
                .map((c) => {
                  const r = floor.rooms.find((x) => x.id === c.elementId);
                  return r ? (
                    <Rect key={`c${c.elementId}`} x={r.x} y={r.y} width={r.w} height={r.d} stroke={RATING_COLOR.avoid} strokeWidth={2.5} strokeScaleEnabled={false} dash={[4, 3]} listening={false} />
                  ) : null;
                })}

            {/* building extents */}
            {ui.showDimensions && buildingBox && !fp && (
              <>
                <DimensionLine
                  a={{ x: buildingBox.x, y: buildingBox.y + buildingBox.d }}
                  b={{ x: buildingBox.x + buildingBox.w, y: buildingBox.y + buildingBox.d }}
                  offset={-28}
                  unit={unit}
                  scale={s}
                  color={palette.dim}
                />
                <DimensionLine
                  a={{ x: buildingBox.x + buildingBox.w, y: buildingBox.y + buildingBox.d }}
                  b={{ x: buildingBox.x + buildingBox.w, y: buildingBox.y }}
                  offset={-28}
                  unit={unit}
                  scale={s}
                  color={palette.dim}
                />
              </>
            )}

            {/* wall endpoint handles */}
            {selection?.kind === 'wall' &&
              tool === 'select' &&
              (() => {
                const w = floor.walls.find((x) => x.id === selection.id);
                if (!w || w.locked) return null;
                return (['a', 'b'] as const).map((end) => (
                  <Circle
                    key={end}
                    x={w[end].x}
                    y={w[end].y}
                    radius={7 / s}
                    fill={palette.plotFill}
                    stroke={palette.selection}
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    draggable
                    onMouseDown={(e) => (e.cancelBubble = true)}
                    onDragMove={(e) => {
                      const n = e.target;
                      n.x(snap(n.x(), snapMm));
                      n.y(snap(n.y(), snapMm));
                    }}
                    onDragEnd={(e) => updateWall(w.id, { [end]: { x: e.target.x(), y: e.target.y() } })}
                  />
                ));
              })()}

            {/* plot vertex editing */}
            {tool === 'plot' && (
              <>
                {edges.map((e, i) => {
                  const mid = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
                  return (
                    <Group
                      key={`m${i}`}
                      x={mid.x}
                      y={mid.y}
                      onMouseDown={(ev) => {
                        ev.cancelBubble = true;
                        commit((d) => {
                          d.plot.boundary.splice(i + 1, 0, mid);
                        });
                      }}
                    >
                      <Circle radius={6 / s} fill={palette.plotFill} stroke={palette.setback} strokeWidth={1.5} strokeScaleEnabled={false} />
                      <Text text="+" x={-4 / s} y={-6 / s} fontSize={px(12, s)} fill={palette.setback} />
                    </Group>
                  );
                })}
                {boundary.map((p, i) => (
                  <Circle
                    key={`v${i}`}
                    x={p.x}
                    y={p.y}
                    radius={8 / s}
                    fill={palette.selection}
                    stroke={palette.plotFill}
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    draggable
                    onMouseDown={(e) => (e.cancelBubble = true)}
                    onDragMove={(e) => {
                      const n = e.target;
                      n.x(snap(n.x(), snapMm));
                      n.y(snap(n.y(), snapMm));
                    }}
                    onDragEnd={(e) =>
                      commit((d) => {
                        d.plot.boundary[i] = { x: e.target.x(), y: e.target.y() };
                      })
                    }
                    onDblClick={() =>
                      boundary.length > 3 &&
                      commit((d) => {
                        d.plot.boundary.splice(i, 1);
                      })
                    }
                  />
                ))}
              </>
            )}

            {/* drafting previews */}
            {draftRect &&
              (() => {
                const r = normRect(draftRect.a, draftRect.b);
                return (
                  <>
                    <Rect x={r.x} y={r.y} width={r.w} height={r.d} fill={palette.selection} opacity={0.15} stroke={palette.selection} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
                    <DimensionLine a={{ x: r.x, y: r.y }} b={{ x: r.x + r.w, y: r.y }} offset={14} unit={unit} scale={s} color={palette.selection} />
                    <DimensionLine a={{ x: r.x + r.w, y: r.y }} b={{ x: r.x + r.w, y: r.y + r.d }} offset={14} unit={unit} scale={s} color={palette.selection} />
                  </>
                );
              })()}
            {wallChain && (
              <>
                <Line
                  points={[wallChain.start.x, wallChain.start.y, wallChain.current.x, wallChain.current.y]}
                  stroke={palette.selection}
                  strokeWidth={project.settings.defaultExteriorWallMm}
                  opacity={0.5}
                  lineCap="square"
                  listening={false}
                />
                <DimensionLine a={wallChain.start} b={wallChain.current} offset={18} unit={unit} scale={s} color={palette.selection} />
              </>
            )}
            {hoverWall && (
              <Circle
                x={hoverWall.wall.a.x + ((hoverWall.wall.b.x - hoverWall.wall.a.x) / wallLength(hoverWall.wall)) * hoverWall.offset}
                y={hoverWall.wall.a.y + ((hoverWall.wall.b.y - hoverWall.wall.a.y) / wallLength(hoverWall.wall)) * hoverWall.offset}
                radius={6 / s}
                fill={palette.selection}
                listening={false}
              />
            )}
            {measure && (measure.b || measureHover) && (
              <>
                <Line
                  points={[measure.a.x, measure.a.y, (measure.b ?? measureHover)!.x, (measure.b ?? measureHover)!.y]}
                  stroke={palette.error}
                  strokeWidth={1.5}
                  strokeScaleEnabled={false}
                  dash={[6, 4]}
                  listening={false}
                />
                <DimensionLine a={measure.a} b={(measure.b ?? measureHover)!} offset={12} unit={unit} scale={s} color={palette.error} />
              </>
            )}
            {measure && <Circle x={measure.a.x} y={measure.a.y} radius={4 / s} fill={palette.error} listening={false} />}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              keepRatio={false}
              ignoreStroke
              flipEnabled={false}
              anchorSize={9}
              anchorStroke={palette.selection}
              borderStroke={palette.selection}
              anchorFill={palette.plotFill}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
            />
          </Group>
        </Layer>
        {/* ---------- Vaasthu grid on top of the rooms (not interactive) ---------- */}
        {(ui.showZones || ui.showSixteen) && (
          <Layer listening={false}>
            <Group x={view.x} y={view.y} scaleX={s} scaleY={s}>
            {ui.showZones && (
              <Group>
                {[1, 2].map((k) => (
                  <Group key={k}>
                    <Line points={[vg.x + (vg.w * k) / 3, vg.y, vg.x + (vg.w * k) / 3, vg.y + vg.d]} stroke={palette.zone} strokeWidth={1.2} strokeScaleEnabled={false} dash={[8, 6]} opacity={0.75} />
                    <Line points={[vg.x, vg.y + (vg.d * k) / 3, vg.x + vg.w, vg.y + (vg.d * k) / 3]} stroke={palette.zone} strokeWidth={1.2} strokeScaleEnabled={false} dash={[8, 6]} opacity={0.75} />
                  </Group>
                ))}
                <Rect x={vg.x + vg.w / 3} y={vg.y + vg.d / 3} width={vg.w / 3} height={vg.d / 3} fill={palette.zone} opacity={0.06} />
                {ZONE_GRID.flatMap((row, r) =>
                  row.map((z, c) => (
                    <Text
                      key={z}
                      text={z === 'C' ? 'Centre' : z}
                      x={vg.x + (vg.w * c) / 3 + px(5, s)}
                      y={vg.y + (vg.d * r) / 3 + px(4, s)}
                      fontSize={px(12, s)}
                      fontStyle="bold"
                      fill={palette.zone}
                      opacity={0.9}
                    />
                  )),
                )}
              </Group>
            )}
            {ui.showSixteen &&
              SIXTEEN.map((label, i) => {
                const cx = vg.x + vg.w / 2;
                const cy = vg.y + vg.d / 2;
                const R = Math.max(vg.w, vg.d) * 0.62;
                const boundaryAngle = ((i * 22.5 + 11.25) * Math.PI) / 180; // sector edges
                const labelAngle = (i * 22.5 * Math.PI) / 180;
                return (
                  <Group key={label}>
                    <Line
                      points={[cx, cy, cx + Math.sin(boundaryAngle) * R, cy - Math.cos(boundaryAngle) * R]}
                      stroke={palette.zone}
                      strokeWidth={0.8}
                      strokeScaleEnabled={false}
                      opacity={0.55}
                    />
                    <Text
                      text={label}
                      x={cx + Math.sin(labelAngle) * R * 0.97 - px(14, s)}
                      y={cy - Math.cos(labelAngle) * R * 0.97 - px(6, s)}
                      width={px(28, s)}
                      align="center"
                      fontSize={px(10, s)}
                      fontStyle="bold"
                      fill={palette.zone}
                    />
                  </Group>
                );
              })}

            </Group>
          </Layer>
        )}
      </Stage>

      <Compass />
      <ToolHint />
    </div>
  );
}

/** Fixed compass rose — the plan is always drawn with north at the top. */
function Compass() {
  const roads = useProjectStore((s) => s.project.plot.roads);
  const facing = roads.map((r) => r.side);
  return (
    <div className="pointer-events-none absolute right-4 top-4 select-none text-ink" aria-label="Compass: north is up">
      <svg width="84" height="84" viewBox="-42 -42 84 84" role="img" aria-hidden="true">
        <circle r="34" fill="var(--panel)" stroke="var(--line)" strokeWidth="1.5" />
        <circle r="26" fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i * Math.PI) / 8;
          const r1 = i % 2 === 0 ? 22 : 25;
          return <line key={i} x1={Math.sin(a) * r1} y1={-Math.cos(a) * r1} x2={Math.sin(a) * 29} y2={-Math.cos(a) * 29} stroke="var(--muted)" strokeWidth="1" />;
        })}
        <path d="M0 -24 L6 0 L0 -4 L-6 0 Z" fill="var(--ochre)" />
        <path d="M0 24 L6 0 L0 4 L-6 0 Z" fill="var(--muted)" opacity="0.5" />
        <text y="-29" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)" dy="-1">N</text>
        <text x="37" y="4" textAnchor="middle" fontSize="9" fill="var(--muted)">E</text>
        <text y="40" textAnchor="middle" fontSize="9" fill="var(--muted)">S</text>
        <text x="-37" y="4" textAnchor="middle" fontSize="9" fill="var(--muted)">W</text>
      </svg>
      {facing.length > 0 && <p className="mt-1 text-center text-xs text-muted">Road: {facing.join(' + ')}</p>}
    </div>
  );
}

const HINTS: Partial<Record<string, string>> = {
  room: 'Drag to draw a room. It snaps to the grid.',
  wall: 'Click to start a wall, click again to end it and continue. Double-click or Esc to stop. Hold Shift for any angle.',
  door: 'Click on a wall to place a door.',
  window: 'Click on a wall to place a window.',
  gate: 'Click on the compound wall to place a gate.',
  measure: 'Click two points to measure. Esc clears.',
  plot: 'Drag the corner points to reshape the plot. Click + to add a corner, double-click a corner to remove it.',
  pan: 'Drag to move around. Scroll or pinch to zoom.',
};

function ToolHint() {
  const tool = useUiStore((s) => s.tool);
  const hint = HINTS[tool];
  if (!hint) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-md border border-line bg-panel/95 px-3 py-1.5 text-sm text-ink-soft shadow-sm">
      {hint}
    </div>
  );
}
