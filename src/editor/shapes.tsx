import { Arc, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { dist, wallDir, wallLength } from '../model/geometry';
import { formatArea, formatLength, formatSize } from '../model/units';
import { ROOM_COLORS, ROOM_TYPE_LABELS } from '../model/types';
import type { DisplayUnit, Opening, Point, Room, Wall } from '../model/types';
import type { CanvasPalette } from './palette';
import { DARK_ROOM_OPACITY } from './palette';

/** Font size in model units that renders at `px` screen pixels. */
export const px = (pxSize: number, scale: number) => pxSize / scale;

export function DimensionLine({
  a,
  b,
  offset,
  unit,
  scale,
  color,
}: {
  a: Point;
  b: Point;
  /** Perpendicular offset in screen pixels (positive = left of a→b). */
  offset: number;
  unit: DisplayUnit;
  scale: number;
  color: string;
}) {
  const len = dist(a, b);
  if (len < 1) return null;
  const dx = (b.x - a.x) / len;
  const dy = (b.y - a.y) / len;
  const nx = dy;
  const ny = -dx;
  const o = offset / scale;
  const a2 = { x: a.x + nx * o, y: a.y + ny * o };
  const b2 = { x: b.x + nx * o, y: b.y + ny * o };
  const tick = 5 / scale;
  const label = formatLength(len, unit);
  const fs = px(11, scale);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const readable = angle > 90 || angle <= -90 ? angle + 180 : angle;
  const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
  const textW = fs * label.length * 0.6;
  return (
    <Group listening={false}>
      <Line points={[a.x, a.y, a2.x + nx * tick, a2.y + ny * tick]} stroke={color} strokeWidth={0.75} strokeScaleEnabled={false} opacity={0.6} />
      <Line points={[b.x, b.y, b2.x + nx * tick, b2.y + ny * tick]} stroke={color} strokeWidth={0.75} strokeScaleEnabled={false} opacity={0.6} />
      <Line points={[a2.x, a2.y, b2.x, b2.y]} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
      {[a2, b2].map((p, i) => (
        <Line
          key={i}
          points={[p.x - (dx + nx) * tick, p.y - (dy + ny) * tick, p.x + (dx + nx) * tick, p.y + (dy + ny) * tick]}
          stroke={color}
          strokeWidth={1.25}
          strokeScaleEnabled={false}
        />
      ))}
      <Group x={mid.x} y={mid.y} rotation={readable}>
        <Text
          text={label}
          fontSize={fs}
          fontFamily="Atkinson Hyperlegible, sans-serif"
          fill={color}
          x={-textW / 2}
          y={-fs * 1.3}
          width={textW}
          align="center"
        />
      </Group>
    </Group>
  );
}

export function RoomLabel({
  room,
  unit,
  scale,
  color,
  areaMm2,
  sizeText,
}: {
  room: Room;
  unit: DisplayUnit;
  scale: number;
  color: string;
  areaMm2?: number;
  /** Replaces the W × D line (e.g. for irregular rooms). */
  sizeText?: string;
}) {
  // Try the full name at 12px, then at 10px, then the short type name; hide if nothing fits.
  const candidates: [string, number][] = [
    [room.name, 12],
    [room.name, 10],
    [ROOM_TYPE_LABELS[room.type], 10],
  ];
  const pick = candidates.find(([text, size]) => {
    const f = px(size, scale);
    return room.w > f * text.length * 0.56 + px(6, scale) && room.d > f * 1.4;
  });
  if (!pick) return null;
  const [name, basePx] = pick;
  const fs = px(basePx, scale);
  const small = px(Math.min(10.5, basePx - 0.5), scale);
  const size = sizeText ?? formatSize(room.w, room.d, unit);
  const fitsSize = room.w > small * size.length * 0.52 && room.d > fs * 3.2;
  const fitsArea = room.d > fs * 4.6;
  const lines = 1 + (fitsSize ? 1 : 0) + (fitsArea ? 1 : 0);
  const h = fs * 1.25 + (lines - 1) * small * 1.3;
  const top = room.d / 2 - h / 2;
  return (
    <Group listening={false}>
      <Text
        text={name}
        x={0}
        y={top}
        width={room.w}
        align="center"
        fontSize={fs}
        fontStyle="bold"
        fontFamily="Atkinson Hyperlegible, sans-serif"
        fill={color}
        wrap="none"
        ellipsis
      />
      {fitsSize && (
        <Text
          text={size}
          x={0}
          y={top + fs * 1.25}
          width={room.w}
          align="center"
          fontSize={small}
          fontFamily="Atkinson Hyperlegible, sans-serif"
          fill={color}
          opacity={0.8}
        />
      )}
      {fitsArea && (
        <Text
          text={formatArea(areaMm2 ?? room.w * room.d, unit)}
          x={0}
          y={top + fs * 1.25 + small * 1.3}
          width={room.w}
          align="center"
          fontSize={small}
          fontFamily="Atkinson Hyperlegible, sans-serif"
          fill={color}
          opacity={0.65}
        />
      )}
    </Group>
  );
}

export function StairArrow({ room, color, scale }: { room: Room; color: string; scale: number }) {
  // Treads across the flight, plus an arrow showing the walking direction up.
  const up = room.stairUp ?? 'N';
  const vertical = up === 'N' || up === 'S';
  const lenAlong = vertical ? room.d : room.w;
  const tread = 250; // ~10" tread spacing for drawing
  const n = Math.max(1, Math.floor(lenAlong / tread));
  const lines = [];
  for (let i = 1; i < n; i++) {
    const t = (i * lenAlong) / n;
    lines.push(
      vertical ? (
        <Line key={i} points={[0, t, room.w, t]} stroke={color} strokeWidth={0.75} strokeScaleEnabled={false} opacity={0.55} />
      ) : (
        <Line key={i} points={[t, 0, t, room.d]} stroke={color} strokeWidth={0.75} strokeScaleEnabled={false} opacity={0.55} />
      ),
    );
  }
  const c = { x: room.w / 2, y: room.d / 2 };
  const half = (vertical ? room.d : room.w) * 0.38;
  const dir = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[up];
  const start = { x: c.x - dir[0] * half, y: c.y - dir[1] * half };
  const end = { x: c.x + dir[0] * half, y: c.y + dir[1] * half };
  const head = 8 / scale;
  return (
    <Group listening={false}>
      {lines}
      <Line points={[start.x, start.y, end.x, end.y]} stroke={color} strokeWidth={1.5} strokeScaleEnabled={false} />
      <Line
        points={[
          end.x - dir[0] * head - dir[1] * head * 0.6,
          end.y - dir[1] * head - dir[0] * head * 0.6,
          end.x,
          end.y,
          end.x - dir[0] * head + dir[1] * head * 0.6,
          end.y - dir[1] * head + dir[0] * head * 0.6,
        ]}
        stroke={color}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
      />
      <Text
        text="UP"
        x={start.x - 20 / scale}
        y={start.y + (dir[1] >= 0 ? -16 : 4) / scale}
        width={40 / scale}
        align="center"
        fontSize={px(10, scale)}
        fontStyle="bold"
        fill={color}
      />
    </Group>
  );
}

export function roomFill(room: Room, dark: boolean): { fill: string; opacity: number } {
  return { fill: ROOM_COLORS[room.type], opacity: dark ? DARK_ROOM_OPACITY : 1 };
}

export function WallShape({
  wall,
  palette,
  selected,
  scale,
  onSelect,
  draggable,
  onDragEnd,
  dimmed,
}: {
  wall: Wall;
  palette: CanvasPalette;
  selected: boolean;
  scale: number;
  onSelect?: () => void;
  draggable?: boolean;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  dimmed?: boolean;
}) {
  const color =
    wall.kind === 'compound' ? palette.compound : wall.kind === 'interior' ? palette.wallInterior : palette.wall;
  return (
    <Line
      points={[wall.a.x, wall.a.y, wall.b.x, wall.b.y]}
      stroke={selected ? palette.selection : dimmed ? palette.ghost : color}
      strokeWidth={wall.thicknessMm}
      lineCap="square"
      hitStrokeWidth={Math.max(wall.thicknessMm, 12 / scale)}
      opacity={dimmed ? 0.35 : 1}
      listening={!!onSelect}
      onMouseDown={onSelect ? (e) => ((e.cancelBubble = true), onSelect()) : undefined}
      onTouchStart={onSelect ? (e) => ((e.cancelBubble = true), onSelect()) : undefined}
      draggable={draggable}
      onDragEnd={onDragEnd}
      name="wall"
    />
  );
}

/** Door, window or gate symbol, drawn in the wall's local frame (x along the wall). */
export function OpeningShape({
  opening,
  wall,
  palette,
  selected,
  scale,
  onSelect,
  draggable,
  onDragMove,
  onDragEnd,
}: {
  opening: Opening;
  wall: Wall;
  palette: CanvasPalette;
  selected: boolean;
  scale: number;
  onSelect?: () => void;
  draggable?: boolean;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}) {
  const d = wallDir(wall);
  const angle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  const len = wallLength(wall);
  const off = Math.min(Math.max(opening.offsetMm, 0), len);
  const pos = { x: wall.a.x + d.x * off, y: wall.a.y + d.y * off };
  const w = opening.widthMm;
  const t = wall.thicknessMm;
  const color = selected ? palette.selection : palette.ink;
  const sw = selected ? 2 : 1.2;
  // Swing side: 'left' of a→b is negative local y in our y-down frame.
  const side = opening.swing === 'left' ? -1 : 1;
  const hingeX = opening.hinge === 'start' ? -w / 2 : w / 2;
  const leafDir = opening.hinge === 'start' ? 1 : -1;

  return (
    <Group
      x={pos.x}
      y={pos.y}
      rotation={angle}
      draggable={draggable}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onMouseDown={onSelect ? (e) => ((e.cancelBubble = true), onSelect()) : undefined}
      onTouchStart={onSelect ? (e) => ((e.cancelBubble = true), onSelect()) : undefined}
      name="opening"
    >
      {/* gap in the wall */}
      <Rect x={-w / 2} y={-t / 2 - 2} width={w} height={t + 4} fill={palette.plotFill} />
      {opening.type === 'window' && (
        <>
          <Line points={[-w / 2, -t / 2, w / 2, -t / 2]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} />
          <Line points={[-w / 2, 0, w / 2, 0]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} />
          <Line points={[-w / 2, t / 2, w / 2, t / 2]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} />
          <Line points={[-w / 2, -t / 2, -w / 2, t / 2]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} />
          <Line points={[w / 2, -t / 2, w / 2, t / 2]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} />
        </>
      )}
      {opening.type === 'door' && (
        <>
          <Line
            points={[hingeX, (side * t) / 2, hingeX, side * (t / 2 + w)]}
            stroke={color}
            strokeWidth={sw * 1.4}
            strokeScaleEnabled={false}
          />
          <Arc
            x={hingeX}
            y={(side * t) / 2}
            innerRadius={w}
            outerRadius={w}
            angle={90}
            rotation={side > 0 ? (leafDir > 0 ? 0 : 90) : leafDir > 0 ? 270 : 180}
            stroke={color}
            strokeWidth={sw * 0.8}
            strokeScaleEnabled={false}
            dash={[4 / scale, 3 / scale]}
          />
        </>
      )}
      {opening.type === 'gate' && (
        <>
          <Line points={[-w / 2, 0, w / 2, 0]} stroke={color} strokeWidth={sw} strokeScaleEnabled={false} dash={[6 / scale, 4 / scale]} />
          <Line points={[-w / 2, -t, -w / 2, t]} stroke={color} strokeWidth={sw * 1.5} strokeScaleEnabled={false} />
          <Line points={[w / 2, -t, w / 2, t]} stroke={color} strokeWidth={sw * 1.5} strokeScaleEnabled={false} />
        </>
      )}
      {/* generous invisible hit area */}
      <Rect x={-w / 2} y={-Math.max(t, 14 / scale)} width={w} height={Math.max(t, 14 / scale) * 2} fill="transparent" />
      {opening.label && scale * w > 34 && (
        <Text
          text={opening.label.split(' ')[0]}
          x={-w / 2}
          y={-t / 2 - px(13, scale)}
          width={w}
          align="center"
          fontSize={px(9, scale)}
          fill={palette.muted}
          listening={false}
        />
      )}
    </Group>
  );
}
