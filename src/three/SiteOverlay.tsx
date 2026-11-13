import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { SIDE_NAMES } from '../model/factory';
import { clearances } from '../model/footprint';
import { dist, edgeSide, insetPolygon } from '../model/geometry';
import { formatLength } from '../model/units';
import type { Point, Project } from '../model/types';
import { PLINTH_MM } from './buildModel';

/** Plan point (mm) → 3D position (m) at height h (m). */
const P = (p: Point, h = 0.03): [number, number, number] => [p.x / 1000, h, p.y / 1000];

const TONES = {
  ink: { bg: '#ffffff', fg: '#1f2a5a', border: '#c9cdd8', bold: false },
  ochre: { bg: '#b8860b', fg: '#ffffff', border: '#b8860b', bold: true },
  muted: { bg: '#f4f5f2', fg: '#4b5577', border: '#d0d4dc', bold: false },
  sage: { bg: '#ffffff', fg: '#4d6b57', border: '#8fa596', bold: false },
} as const;

const textureCache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>();

/** Text drawn into a canvas texture once and cached; avoids DOM overlays inside the 3D canvas. */
function labelTexture(text: string, tone: keyof typeof TONES) {
  const key = `${tone}|${text}`;
  const hit = textureCache.get(key);
  if (hit) return hit;
  const t = TONES[tone];
  const scale = 4;
  const font = `${t.bold ? '700' : '400'} ${13 * scale}px "Atkinson Hyperlegible", system-ui, sans-serif`;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width + 14 * scale);
  const h = 24 * scale;
  c.width = w;
  c.height = h;
  ctx.font = font;
  ctx.fillStyle = t.bg;
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(scale, scale, w - 2 * scale, h - 2 * scale, 4 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = t.fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 7 * scale, h / 2 + scale);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const out = { tex, aspect: w / h };
  textureCache.set(key, out);
  return out;
}

function Label({ at, text, tone = 'ink', size = 0.85 }: { at: [number, number, number]; text: string; tone?: keyof typeof TONES; size?: number }) {
  const { tex, aspect } = useMemo(() => labelTexture(text, tone), [text, tone]);
  return (
    <sprite position={at} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}

/**
 * Site context in 3D: plot boundary with corner posts and edge lengths, setback line, labelled roads
 * and neighbours, north arrow, and the house outline with its gaps to each boundary. When no walls
 * stand inside the outline yet, it is shown as a translucent block so its position can be judged.
 */
export function SiteOverlay({ project, showLabels }: { project: Project; showLabels: boolean }) {
  const unit = project.settings.unit;
  const b = project.plot.boundary;
  const closed = [...b, b[0]].map((p) => P(p, 0.04));
  const inset = insetPolygon(b, project.plot.setbacks);
  const insetPts = inset.length >= 3 ? [...inset, inset[0]].map((p) => P(p, 0.05)) : [];
  const fp = project.footprint;
  const ground = [...project.floors].sort((a, c) => a.level - c.level)[0];
  const outlineHasWalls =
    !!fp &&
    !!ground?.walls.some((w) => w.a.x >= fp.x - 1 && w.a.x <= fp.x + fp.w + 1 && w.a.y >= fp.y - 1 && w.a.y <= fp.y + fp.d + 1);
  const xs = b.map((p) => p.x);
  const ys = b.map((p) => p.y);
  const north = { x: Math.max(...xs) - 1800, y: Math.min(...ys) - 2600 };

  return (
    <group>
      {/* plot boundary and corner posts */}
      <Line points={closed} color="#1f2a5a" lineWidth={3} />
      {b.map((p, i) => (
        <mesh key={i} position={P(p, 0.45)} castShadow>
          <boxGeometry args={[0.15, 0.9, 0.15]} />
          <meshStandardMaterial color="#1f2a5a" />
        </mesh>
      ))}

      {/* setback line */}
      {insetPts.length > 0 && <Line points={insetPts} color="#5f7f6a" lineWidth={2} dashed dashSize={0.6} gapSize={0.4} />}

      {/* house outline on the ground, plus a massing block until walls are drawn */}
      {fp && (
        <>
          <Line
            points={[
              { x: fp.x, y: fp.y },
              { x: fp.x + fp.w, y: fp.y },
              { x: fp.x + fp.w, y: fp.y + fp.d },
              { x: fp.x, y: fp.y + fp.d },
              { x: fp.x, y: fp.y },
            ].map((p) => P(p, 0.06))}
            color="#b8860b"
            lineWidth={3}
            dashed
            dashSize={0.8}
            gapSize={0.4}
          />
          {!outlineHasWalls && (
            <mesh position={[(fp.x + fp.w / 2) / 1000, (PLINTH_MM + (ground?.heightMm ?? 3048)) / 2000, (fp.y + fp.d / 2) / 1000]} castShadow receiveShadow>
              <boxGeometry args={[fp.w / 1000, (PLINTH_MM + (ground?.heightMm ?? 3048)) / 1000, fp.d / 1000]} />
              <meshStandardMaterial color="#e2b44c" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          )}
          {clearances(fp, b)
            .filter((c) => c.mm > 1)
            .map((c) => (
              <group key={c.side}>
                <Line points={[P(c.from, 0.08), P(c.to, 0.08)]} color="#b8860b" lineWidth={2} />
                {showLabels && (
                  <Label at={P({ x: (c.from.x + c.to.x) / 2, y: (c.from.y + c.to.y) / 2 }, 0.3)} text={`${SIDE_NAMES[c.side]} gap ${formatLength(c.mm, unit)}`} tone="ochre" />
                )}
              </group>
            ))}
          {showLabels && (
            <Label
              at={[(fp.x + fp.w / 2) / 1000, (PLINTH_MM + (ground?.heightMm ?? 3048)) / 1000 + 2.6, (fp.y + fp.d / 2) / 1000]}
              text={`House ${formatLength(fp.w, unit)} × ${formatLength(fp.d, unit)}`}
              tone="ochre"
            />
          )}
        </>
      )}

      {/* edge lengths, roads and neighbours */}
      {showLabels &&
        b.map((a, i) => {
          const c = b[(i + 1) % b.length];
          const side = edgeSide(a, c);
          const len = dist(a, c) || 1;
          const out = { x: (c.y - a.y) / len, y: -(c.x - a.x) / len };
          const mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
          const road = project.plot.roads.find((r) => r.side === side);
          const neighbour = project.plot.neighbours.includes(side);
          const setback = project.plot.setbacks[side];
          const inward = { x: -out.x, y: -out.y };
          return (
            <group key={i}>
              <Label at={P({ x: mid.x + out.x * 900, y: mid.y + out.y * 900 }, 0.3)} text={formatLength(len, unit)} />
              {road && (
                <Label
                  at={P({ x: mid.x + out.x * Math.min(road.widthMm, 9000) * 0.5, y: mid.y + out.y * Math.min(road.widthMm, 9000) * 0.5 }, 0.3)}
                  text={`${SIDE_NAMES[side]} road, ${formatLength(road.widthMm, unit)} wide`}
                  tone="muted"
                />
              )}
              {neighbour && !road && (
                <Label at={P({ x: mid.x + out.x * 3000, y: mid.y + out.y * 3000 }, 0.3)} text={`Neighbour (${SIDE_NAMES[side].toLowerCase()})`} tone="muted" />
              )}
              {setback > 0 && (
                <Label
                  at={P({ x: mid.x + (c.x - a.x) * 0.3 + inward.x * setback * 0.5, y: mid.y + (c.y - a.y) * 0.3 + inward.y * setback * 0.5 }, 0.3)}
                  text={`Setback ${formatLength(setback, unit)}`}
                  tone="sage"
                />
              )}
            </group>
          );
        })}

      {/* neighbouring property bands (low, so the plot reads as a separate parcel) */}
      {b.map((a, i) => {
        const c = b[(i + 1) % b.length];
        const side = edgeSide(a, c);
        if (!project.plot.neighbours.includes(side) || project.plot.roads.some((r) => r.side === side)) return null;
        const len = dist(a, c) || 1;
        const dir = { x: (c.x - a.x) / len, y: (c.y - a.y) / len };
        const out = { x: dir.y, y: -dir.x };
        const depth = 6000;
        const m = { x: (a.x + c.x) / 2 + (out.x * depth) / 2, y: (a.y + c.y) / 2 + (out.y * depth) / 2 };
        return (
          <mesh key={`n${i}`} position={P(m, 0.01)} rotation={[-Math.PI / 2, 0, -Math.atan2(dir.y, dir.x)]} receiveShadow>
            <planeGeometry args={[len / 1000, depth / 1000]} />
            <meshStandardMaterial color="#cfd3c7" />
          </mesh>
        );
      })}

      {/* north arrow on the ground */}
      <group position={P(north, 0.05)}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.4, 32]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          {/* shape +y maps to world −z (north) after the −90° rotation about x */}
          <shapeGeometry args={[arrowShape()]} />
          <meshStandardMaterial color="#b8860b" />
        </mesh>
        {showLabels && <Label at={[0, 0.4, -2]} text="North" tone="ochre" />}
      </group>
    </group>
  );
}

function arrowShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 1.2);
  s.lineTo(0.55, -0.8);
  s.lineTo(0, -0.35);
  s.lineTo(-0.55, -0.8);
  s.closePath();
  return s;
}
