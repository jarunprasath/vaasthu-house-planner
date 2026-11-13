/** Plan symbols for furniture, fixtures and outdoor items (drawn in the item's local frame, mm). */
import { Arc, Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { catalogEntry } from '../model/catalog';
import type { Item } from '../model/types';
import type { CanvasPalette } from './palette';
import { px } from './shapes';

export function ItemSymbol({ item, ink, fill, scale }: { item: Item; ink: string; fill: string; scale: number }) {
  const c = catalogEntry(item.type);
  const W = item.w;
  const D = item.d;
  const x0 = -W / 2;
  const y0 = -D / 2;
  const sw = 1;
  const common = { stroke: ink, strokeWidth: sw, strokeScaleEnabled: false, listening: false } as const;
  const wallUnit = c.tags?.includes('wall-unit');
  const body = <Rect x={x0} y={y0} width={W} height={D} fill={fill} opacity={wallUnit ? 0.35 : 0.9} {...common} dash={wallUnit ? [px(5, scale), px(4, scale)] : undefined} />;
  switch (c.symbol) {
    case 'sofa': {
      const back = Math.min(D * 0.22, 200);
      const arm = Math.min(W * 0.1, 180);
      return (
        <>
          {body}
          <Line points={[x0, y0 + back, x0 + W, y0 + back]} {...common} />
          <Line points={[x0 + arm, y0 + back, x0 + arm, y0 + D]} {...common} />
          <Line points={[x0 + W - arm, y0 + back, x0 + W - arm, y0 + D]} {...common} />
        </>
      );
    }
    case 'bed': {
      const pillowD = Math.min(400, D * 0.2);
      return (
        <>
          {body}
          <Rect x={x0 + W * 0.06} y={y0 + 80} width={W * 0.4} height={pillowD} cornerRadius={60} {...common} />
          <Rect x={x0 + W * 0.54} y={y0 + 80} width={W * 0.4} height={pillowD} cornerRadius={60} {...common} />
          <Line points={[x0, y0 + D * 0.38, x0 + W, y0 + D * 0.38]} {...common} />
          <Line points={[x0, y0 + D * 0.38, x0 + W * 0.3, y0 + D * 0.5]} {...common} />
        </>
      );
    }
    case 'table':
      return (
        <>
          {body}
          <Rect x={x0 + 40} y={y0 + 40} width={W - 80} height={D - 80} {...common} opacity={0.5} />
        </>
      );
    case 'dining': {
      const tableD = Math.max(800, D - 900);
      const seats = W >= 1600 ? 3 : 2;
      const chairs = [];
      for (let i = 0; i < seats; i++) {
        const cx = x0 + (W / seats) * (i + 0.5);
        chairs.push(<Rect key={`a${i}`} x={cx - 210} y={-tableD / 2 - 450} width={420} height={420} cornerRadius={50} fill={fill} {...common} />);
        chairs.push(<Rect key={`b${i}`} x={cx - 210} y={tableD / 2 + 30} width={420} height={420} cornerRadius={50} fill={fill} {...common} />);
      }
      return (
        <>
          {chairs}
          <Rect x={x0} y={-tableD / 2} width={W} height={tableD} fill={fill} {...common} />
        </>
      );
    }
    case 'wardrobe':
      return (
        <>
          {body}
          <Line points={[0, y0, 0, y0 + D]} {...common} />
          <Line points={[x0, y0 + D - 60, x0 + W, y0 + D - 60]} {...common} dash={[px(4, scale), px(3, scale)]} />
        </>
      );
    case 'cabinet':
      return (
        <>
          {body}
          {c.tags?.includes('counter') && <Line points={[x0, y0 + D - 40, x0 + W, y0 + D - 40]} {...common} opacity={0.5} />}
          {!c.tags?.includes('counter') && !wallUnit && <Line points={[x0, y0, x0 + W, y0 + D]} {...common} opacity={0.35} />}
        </>
      );
    case 'sink':
      return (
        <>
          {body}
          <Rect x={-W * 0.28} y={y0 + D * 0.2} width={W * 0.56} height={D * 0.6} cornerRadius={60} {...common} />
          <Circle x={0} y={y0 + D * 0.5} radius={30} {...common} />
          <Line points={[0, y0 + 30, 0, y0 + D * 0.2]} {...common} />
        </>
      );
    case 'hob':
      return (
        <>
          {body}
          {[-1, 1].map((sx) => (
            <Circle key={sx} x={sx * W * 0.22} y={0} radius={Math.min(W, D) * 0.17} {...common} />
          ))}
        </>
      );
    case 'fridge':
      return (
        <>
          {body}
          <Line points={[x0, y0 + D - 80, x0 + W, y0 + D - 80]} {...common} />
          <Text text="F" x={-px(5, scale)} y={-px(7, scale)} fontSize={px(13, scale)} fill={ink} listening={false} />
        </>
      );
    case 'wc':
      return (
        <>
          <Rect x={x0} y={y0} width={W} height={D * 0.28} fill={fill} {...common} />
          <Ellipse x={0} y={y0 + D * 0.28 + D * 0.34} radiusX={W / 2} radiusY={D * 0.34} fill={fill} {...common} />
          <Ellipse x={0} y={y0 + D * 0.28 + D * 0.36} radiusX={W * 0.3} radiusY={D * 0.22} {...common} />
        </>
      );
    case 'wcIndian':
      return (
        <>
          {body}
          <Ellipse x={0} y={y0 + D * 0.42} radiusX={W * 0.28} radiusY={D * 0.3} {...common} />
          <Rect x={x0 + W * 0.08} y={y0 + D * 0.72} width={W * 0.3} height={D * 0.18} {...common} />
          <Rect x={x0 + W * 0.62} y={y0 + D * 0.72} width={W * 0.3} height={D * 0.18} {...common} />
        </>
      );
    case 'basin':
      return (
        <>
          {body}
          <Ellipse x={0} y={y0 + D * 0.55} radiusX={W * 0.36} radiusY={D * 0.3} {...common} />
        </>
      );
    case 'shower':
      return (
        <>
          {body}
          <Line points={[x0, y0, x0 + W, y0 + D]} {...common} opacity={0.5} />
          <Line points={[x0 + W, y0, x0, y0 + D]} {...common} opacity={0.5} />
          <Circle x={0} y={0} radius={60} {...common} />
        </>
      );
    case 'tub':
      return (
        <>
          {body}
          <Rect x={x0 + 80} y={y0 + 80} width={W - 160} height={D - 160} cornerRadius={Math.min(W, D) * 0.3} {...common} />
        </>
      );
    case 'car':
      return (
        <>
          <Rect x={x0} y={y0} width={W} height={D} cornerRadius={Math.min(W, D) * 0.18} fill={fill} {...common} opacity={0.7} />
          <Rect x={x0 + W * 0.1} y={y0 + D * 0.28} width={W * 0.8} height={D * 0.4} cornerRadius={120} {...common} />
          <Line points={[x0 + W * 0.1, y0 + D * 0.38, x0 + W * 0.9, y0 + D * 0.38]} {...common} />
        </>
      );
    case 'bike':
      return (
        <>
          <Ellipse x={0} y={0} radiusX={W * 0.18} radiusY={D / 2} fill={fill} {...common} />
          <Line points={[x0, y0 + D * 0.25, x0 + W, y0 + D * 0.25]} {...common} />
        </>
      );
    case 'tree':
      return (
        <>
          <Circle x={0} y={0} radius={Math.min(W, D) / 2} fill={fill} opacity={0.45} {...common} />
          {Array.from({ length: 8 }, (_, i) => (
            <Line key={i} points={[0, 0, (Math.cos((i * Math.PI) / 4) * W) / 2.3, (Math.sin((i * Math.PI) / 4) * D) / 2.3]} {...common} opacity={0.5} />
          ))}
          <Circle x={0} y={0} radius={Math.min(W, D) * 0.06} fill={ink} {...common} />
        </>
      );
    case 'shrub':
      return <Circle x={0} y={0} radius={Math.min(W, D) / 2} fill={fill} opacity={0.6} {...common} dash={[px(3, scale), px(2, scale)]} />;
    case 'circle':
      return wallUnit ? (
        <Ellipse x={0} y={0} radiusX={W / 2} radiusY={D / 2} {...common} dash={[px(4, scale), px(3, scale)]} />
      ) : (
        <Ellipse x={0} y={0} radiusX={W / 2} radiusY={D / 2} fill={fill} opacity={0.8} {...common} />
      );
    default:
      return body;
  }
}

/** A placed item: symbol, selection outline and (for the selected item) a rotate handle. */
export function ItemShape({
  item,
  palette,
  scale,
  selected,
  dark,
  draggable,
  onSelect,
  onDragEnd,
  onRotate,
  dx = 0,
  dy = 0,
}: {
  item: Item;
  palette: CanvasPalette;
  scale: number;
  selected: boolean;
  dark: boolean;
  draggable: boolean;
  onSelect?: () => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onRotate?: (deg: number) => void;
  dx?: number;
  dy?: number;
}) {
  const c = catalogEntry(item.type);
  const fill = item.color ?? c.color;
  return (
    <Group
      x={item.x + dx}
      y={item.y + dy}
      rotation={item.rotation}
      draggable={draggable}
      name="item"
      onMouseDown={(e) => {
        if (!onSelect) return;
        e.cancelBubble = true;
        onSelect();
      }}
      onTouchStart={(e) => {
        if (!onSelect) return;
        e.cancelBubble = true;
        onSelect();
      }}
      onDragEnd={onDragEnd}
    >
      {/* hit area */}
      <Rect x={-item.w / 2} y={-item.d / 2} width={item.w} height={item.d} fill="transparent" />
      <Group opacity={dark ? 0.85 : 1}>
        <ItemSymbol item={item} ink={palette.ink} fill={fill} scale={scale} />
      </Group>
      {/* front marker: a small tick at the front edge */}
      <Line points={[-px(5, scale), item.d / 2, 0, item.d / 2 + px(5, scale), px(5, scale), item.d / 2]} stroke={palette.muted} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
      {selected && (
        <>
          <Rect
            x={-item.w / 2}
            y={-item.d / 2}
            width={item.w}
            height={item.d}
            stroke={palette.selection}
            strokeWidth={2}
            strokeScaleEnabled={false}
            listening={false}
          />
          {onRotate && (
            <Group
              x={0}
              y={-item.d / 2 - px(22, scale)}
              onMouseDown={(e) => {
                e.cancelBubble = true;
                onRotate(90);
              }}
              onTouchStart={(e) => {
                e.cancelBubble = true;
                onRotate(90);
              }}
              name="item-rotate"
            >
              <Circle radius={px(9, scale)} fill={palette.plotFill} stroke={palette.selection} strokeWidth={1.5} strokeScaleEnabled={false} />
              <Arc innerRadius={px(4, scale)} outerRadius={px(5.5, scale)} angle={270} rotation={-90} fill={palette.selection} listening={false} />
            </Group>
          )}
        </>
      )}
    </Group>
  );
}
