import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { boundingBox, edgeSide, dist } from '../model/geometry';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { buildParts, type BoxPart, type GablePart, type Part } from './buildModel';

type Preset = 'iso' | 'top' | 'north' | 'east' | 'south' | 'west';

/** Sun direction for a time of day, roughly for a low-latitude northern site (e.g. Tamil Nadu). */
export function sunDirection(hour: number): THREE.Vector3 {
  const t = Math.min(Math.max((hour - 6) / 12, 0), 1);
  const az = ((90 + t * 180) * Math.PI) / 180; // east → south → west, clockwise from north
  const el = ((10 + 65 * Math.sin(Math.PI * t)) * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
}

function Gable({ p, opacity, onPick }: { p: GablePart; opacity: number; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const geom = useMemo(() => {
    const ew = p.ridge === 'EW';
    const span = ew ? p.z1 - p.z0 : p.x1 - p.x0;
    const length = ew ? p.x1 - p.x0 : p.z1 - p.z0;
    const shape = new THREE.Shape();
    const sgn = ew ? -1 : 1;
    shape.moveTo(0, 0);
    shape.lineTo(sgn * span, 0);
    shape.lineTo((sgn * span) / 2, p.rise);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  }, [p]);
  return (
    <mesh geometry={geom} position={[p.x0, p.base, p.z0]} rotation={[0, p.ridge === 'EW' ? Math.PI / 2 : 0, 0]} castShadow receiveShadow onClick={onPick}>
      <meshStandardMaterial color={p.color} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Scene({
  parts,
  maxLevel,
  wallOpacity,
  hour,
  preset,
  presetTick,
  showRoof,
}: {
  showRoof: boolean;
  parts: Part[];
  maxLevel: number;
  wallOpacity: number;
  hour: number;
  preset: Preset;
  presetTick: number;
}) {
  const project = useProjectStore((s) => s.project);
  const selection = useProjectStore((s) => s.selection);
  const select = useProjectStore((s) => s.select);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);
  const dark = useUiStore((s) => s.theme === 'dark');
  const controls = useRef<OrbitControlsImpl | null>(null);
  const { camera } = useThree();

  const box = boundingBox(project.plot.boundary);
  const cx = (box.x + box.w / 2) / 1000;
  const cz = (box.y + box.d / 2) / 1000;
  const radius = Math.max(box.w, box.d) / 1000;

  // Camera presets
  useEffect(() => {
    const r = radius * 1.25;
    const pos: Record<Preset, [number, number, number]> = {
      iso: [cx + r * 0.75, r * 0.85, cz + r * 0.95],
      top: [cx, r * 1.7, cz + 0.01],
      north: [cx, r * 0.35, cz - r * 1.3],
      south: [cx, r * 0.35, cz + r * 1.3],
      east: [cx + r * 1.3, r * 0.35, cz],
      west: [cx - r * 1.3, r * 0.35, cz],
    };
    camera.position.set(...pos[preset]);
    controls.current?.target.set(cx, 1.5, cz);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetTick, cx, cz, radius]);

  const sun = sunDirection(hour);
  const sunPos = sun.clone().multiplyScalar(radius * 2).add(new THREE.Vector3(cx, 0, cz));

  const ground = useMemo(() => {
    const shape = new THREE.Shape(project.plot.boundary.map((p) => new THREE.Vector2(p.x / 1000, -p.y / 1000)));
    return new THREE.ShapeGeometry(shape);
  }, [project.plot.boundary]);

  const roads = project.plot.boundary.flatMap((a, i) => {
    const b = project.plot.boundary[(i + 1) % project.plot.boundary.length];
    const side = edgeSide(a, b);
    const road = project.plot.roads.find((r) => r.side === side);
    if (!road) return [];
    const len = dist(a, b);
    const out = { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    const depth = Math.min(road.widthMm, 9000);
    const mid = { x: (a.x + b.x) / 2 + (out.x * depth) / 2, y: (a.y + b.y) / 2 + (out.y * depth) / 2 };
    return [
      {
        key: side,
        x: mid.x / 1000,
        z: mid.y / 1000,
        sx: (len + 4000) / 1000,
        sz: depth / 1000,
        ry: -Math.atan2(b.y - a.y, b.x - a.x),
      },
    ];
  });

  const isSelected = (p: BoxPart) => !!p.ref && !!selection && selection.id === p.ref.id;
  const onPick = (p: Part) => (e: ThreeEvent<MouseEvent>) => {
    if (p.shape !== 'box' || !p.ref) return;
    if (e.delta > 4) return; // the pointer was dragged to orbit
    e.stopPropagation();
    setActiveFloor(p.ref.floorId);
    select({ kind: p.ref.kind, id: p.ref.id });
  };

  const roofKinds = ['slab', 'parapet', 'roof', 'tank'];
  // "Remove roof" lifts off the highest slab shown (and anything standing on it) so rooms can be seen.
  const shown = parts.filter((p) => p.floorLevel <= maxLevel);
  const topSlab = shown.filter((p) => p.kind === 'slab').reduce((m, p) => Math.max(m, p.floorLevel), -1);
  const visible = shown.filter((p) => showRoof || !(roofKinds.includes(p.kind) && p.floorLevel >= topSlab));

  return (
    <>
      <color attach="background" args={[dark ? '#121621' : '#e9eef2']} />
      <hemisphereLight args={[dark ? '#8090b0' : '#ffffff', dark ? '#202430' : '#c9c1ad', 0.75]} />
      <directionalLight
        position={sunPos.toArray()}
        intensity={2.1 * Math.max(0.25, sun.y)}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius}
        shadow-camera-right={radius}
        shadow-camera-top={radius}
        shadow-camera-bottom={-radius}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 5}
        shadow-bias={-0.0004}
      >
        <object3D attach="target" position={[cx, 0, cz]} />
      </directionalLight>

      {/* surroundings, plot and roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} receiveShadow>
        <planeGeometry args={[radius * 8, radius * 8]} />
        <meshStandardMaterial color={dark ? '#1b2130' : '#d7dbd3'} />
      </mesh>
      <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color={dark ? '#344132' : '#c5d6b0'} />
      </mesh>
      {roads.map((r) => (
        <mesh key={r.key} position={[r.x, 0.005, r.z]} rotation={[-Math.PI / 2, 0, r.ry]} receiveShadow>
          <planeGeometry args={[r.sx, r.sz]} />
          <meshStandardMaterial color={dark ? '#3a3f4b' : '#7c8189'} />
        </mesh>
      ))}

      {visible.map((p, i) =>
        p.shape === 'gable' ? (
          <Gable key={`g${i}`} p={p} opacity={1} />
        ) : (
          <mesh
            key={i}
            position={[p.x, p.y, p.z]}
            rotation={[0, p.ry, 0]}
            castShadow={p.kind !== 'glass' && p.kind !== 'site'}
            receiveShadow
            onClick={onPick(p)}
          >
            <boxGeometry args={[p.sx, p.sy, p.sz]} />
            <meshStandardMaterial
              color={isSelected(p) ? '#e2b44c' : p.color}
              emissive={isSelected(p) ? '#7a5a10' : '#000000'}
              transparent={p.kind === 'glass' || ((p.kind === 'wall' || p.kind === 'parapet') && wallOpacity < 1)}
              opacity={p.kind === 'glass' ? 0.45 : p.kind === 'wall' || p.kind === 'parapet' ? wallOpacity : 1}
              roughness={p.kind === 'glass' ? 0.1 : 0.85}
              metalness={p.kind === 'gate' ? 0.4 : 0}
              depthWrite={!(p.kind === 'glass' || ((p.kind === 'wall' || p.kind === 'parapet') && wallOpacity < 1))}
            />
          </mesh>
        ),
      )}

      <OrbitControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={2} maxDistance={radius * 6} />
    </>
  );
}

export default function View3D() {
  const project = useProjectStore((s) => s.project);
  const parts = useMemo(() => buildParts(project), [project]);
  const levels = useMemo(() => [...project.floors].sort((a, b) => a.level - b.level), [project.floors]);
  const maxAvailable = levels[levels.length - 1]?.level ?? 0;
  const [maxLevel, setMaxLevel] = useState(maxAvailable);
  const [wallOpacity, setWallOpacity] = useState(1);
  const [showRoof, setShowRoof] = useState(true);
  const [hour, setHour] = useState(10);
  const [preset, setPreset] = useState<Preset>('iso');
  const [tick, setTick] = useState(0);
  const glRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => setMaxLevel(maxAvailable), [maxAvailable]);

  const snapshot = () => {
    const c = glRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${project.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'house'}_3d.png`;
    a.click();
  };

  const btn = 'rounded-md border border-line bg-panel/95 px-2 py-1 text-xs text-ink hover:border-ink-soft';
  return (
    <div className="absolute inset-0" data-testid="view-3d">
      <Canvas
        shadows
        camera={{ fov: 45, near: 0.1, far: 2000, position: [30, 25, 30] }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => (glRef.current = gl.domElement)}
      >
        <Scene parts={parts} showRoof={showRoof} maxLevel={maxLevel} wallOpacity={wallOpacity} hour={hour} preset={preset} presetTick={tick} />
      </Canvas>

      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end gap-2">
        <div className="rounded-md border border-line bg-panel/95 p-2 text-xs shadow-sm">
          <p className="mb-1 text-muted">View</p>
          <div className="flex flex-wrap gap-1">
            {(['iso', 'top', 'north', 'east', 'south', 'west'] as Preset[]).map((p) => (
              <button
                key={p}
                className={btn}
                aria-pressed={preset === p}
                onClick={() => {
                  setPreset(p);
                  setTick((t) => t + 1);
                }}
              >
                {{ iso: '3D', top: 'Top', north: 'From north', east: 'From east', south: 'From south', west: 'From west' }[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-line bg-panel/95 p-2 text-xs shadow-sm">
          <label className="mb-1 block text-muted" htmlFor="floors3d">
            Show floors up to
          </label>
          <select id="floors3d" className="rounded border border-line bg-panel px-1 py-0.5" value={maxLevel} onChange={(e) => setMaxLevel(Number(e.target.value))}>
            {levels.map((f) => (
              <option key={f.id} value={f.level}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-md border border-line bg-panel/95 p-2 text-xs shadow-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="accent-[var(--ochre)]" checked={wallOpacity < 1} onChange={(e) => setWallOpacity(e.target.checked ? 0.3 : 1)} />
            See-through walls
          </label>
          <label className="mt-1 flex items-center gap-1.5">
            <input type="checkbox" className="accent-[var(--ochre)]" checked={!showRoof} onChange={(e) => setShowRoof(!e.target.checked)} />
            Remove roof to look inside
          </label>
        </div>
        <div className="rounded-md border border-line bg-panel/95 p-2 text-xs shadow-sm">
          <label className="mb-1 block text-muted" htmlFor="sun3d">
            Sun at {String(Math.floor(hour)).padStart(2, '0')}:{hour % 1 ? '30' : '00'} (approximate)
          </label>
          <input id="sun3d" type="range" min={6} max={18} step={0.5} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-40 accent-[var(--ochre)]" />
        </div>
        <button className={`${btn} ml-auto`} onClick={snapshot}>
          Save image
        </button>
      </div>
      <p className="pointer-events-none absolute left-3 top-14 text-xs text-muted">Drag to orbit, right-drag to pan, scroll to zoom. Click a part to select it.</p>
    </div>
  );
}
