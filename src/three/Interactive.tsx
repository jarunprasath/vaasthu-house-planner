/**
 * 3D building blocks with interaction: textured part meshes, furniture items, and first-person walking.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { itemPrims } from '../model/catalog';
import type { Item } from '../model/types';
import type { BoxPart } from './buildModel';
import { makeTexture } from './textures';

export interface Offset {
  dx: number;
  dz: number;
}

export function PartMesh({
  p,
  selected,
  wallOpacity,
  textures,
  offset,
  onClick,
  onPointerDown,
}: {
  p: BoxPart;
  selected: boolean;
  wallOpacity: number;
  textures: boolean;
  offset?: Offset | null;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const isWallish = p.kind === 'wall' || p.kind === 'parapet' || p.kind === 'trim';
  const seeThrough = p.kind === 'glass' || (isWallish && wallOpacity < 1);
  const map = useMemo(() => {
    if (!textures || !p.texture) return null;
    const flat = p.kind === 'floor' || p.kind === 'site' || p.kind === 'slab' || p.kind === 'lid';
    return makeTexture(p.texture, p.color, p.sx, flat ? p.sz : p.sy);
  }, [textures, p.texture, p.color, p.sx, p.sy, p.sz, p.kind]);
  return (
    <mesh
      position={[p.x + (offset?.dx ?? 0), p.y, p.z + (offset?.dz ?? 0)]}
      rotation={[0, p.ry, 0]}
      castShadow={p.kind !== 'glass' && p.kind !== 'site'}
      receiveShadow
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <boxGeometry args={[p.sx, p.sy, p.sz]} />
      <meshStandardMaterial
        color={selected ? '#e2b44c' : map ? '#ffffff' : p.color}
        map={selected ? null : map}
        emissive={selected ? '#7a5a10' : '#000000'}
        transparent={seeThrough}
        opacity={p.kind === 'glass' ? 0.45 : isWallish ? wallOpacity : 1}
        roughness={p.kind === 'glass' ? 0.1 : 0.85}
        metalness={p.kind === 'gate' ? 0.4 : 0}
        depthWrite={!seeThrough}
      />
    </mesh>
  );
}

export function ItemMesh({
  it,
  baseMm,
  selected,
  offset,
  onClick,
  onPointerDown,
}: {
  it: Item;
  baseMm: number;
  selected: boolean;
  offset?: Offset | null;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const prims = useMemo(() => itemPrims(it), [it]);
  return (
    <group
      position={[it.x / 1000 + (offset?.dx ?? 0), (baseMm + (it.elevationMm ?? 0)) / 1000, it.y / 1000 + (offset?.dz ?? 0)]}
      rotation={[0, (-it.rotation * Math.PI) / 180, 0]}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {prims.map((pr, i) => (
        <mesh key={i} position={[pr.x, pr.y, pr.z]} castShadow receiveShadow scale={pr.shape === 'box' ? 1 : [pr.sx, pr.sy, pr.sz]}>
          {pr.shape === 'box' && <boxGeometry args={[pr.sx, pr.sy, pr.sz]} />}
          {pr.shape === 'cyl' && <cylinderGeometry args={[0.5, 0.5, 1, 20]} />}
          {pr.shape === 'sphere' && <sphereGeometry args={[0.5, 20, 14]} />}
          <meshStandardMaterial
            color={selected ? '#e2b44c' : pr.color}
            emissive={selected ? '#7a5a10' : '#000000'}
            transparent={pr.opacity !== undefined}
            opacity={pr.opacity ?? 1}
            roughness={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Keys currently held for walking; shared with the on-screen buttons. */
export type WalkKey = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight';
export type WalkKeys = Set<WalkKey>;

const KEYMAP: Record<string, WalkKey> = {
  w: 'forward',
  ArrowUp: 'forward',
  s: 'back',
  ArrowDown: 'back',
  a: 'left',
  d: 'right',
  ArrowLeft: 'turnLeft',
  ArrowRight: 'turnRight',
  q: 'turnLeft',
  e: 'turnRight',
};

/**
 * First-person walking: arrow keys / WASD to move and turn, drag to look around. No collision with
 * walls — you can walk through them.
 */
export function WalkControls({ start, yaw0, eyeY, keys }: { start: [number, number]; yaw0: number; eyeY: number; keys: React.MutableRefObject<WalkKeys> }) {
  const { camera, gl } = useThree();
  const yaw = useRef(yaw0);
  const pitch = useRef(0);

  useEffect(() => {
    camera.position.set(start[0], eyeY, start[1]);
    yaw.current = yaw0;
    pitch.current = 0;
  }, [start, yaw0, eyeY, camera]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key] ?? KEYMAP[e.key.toLowerCase()];
      if (k && !(e.target as HTMLElement).closest('input, select, textarea')) {
        keys.current.add(k);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYMAP[e.key] ?? KEYMAP[e.key.toLowerCase()];
      if (k) keys.current.delete(k);
    };
    let dragging: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => (dragging = { x: e.clientX, y: e.clientY });
    const pm = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (e.clientX - dragging.x) * 0.005;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (e.clientY - dragging.y) * 0.004));
      dragging = { x: e.clientX, y: e.clientY };
    };
    const pu = () => (dragging = null);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    gl.domElement.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      gl.domElement.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      keys.current.clear();
    };
  }, [gl, keys]);

  useFrame((_, dt) => {
    const k = keys.current;
    const speed = 1.6 * Math.min(dt, 0.1);
    if (k.has('turnLeft')) yaw.current += 1.4 * Math.min(dt, 0.1);
    if (k.has('turnRight')) yaw.current -= 1.4 * Math.min(dt, 0.1);
    const fx = -Math.sin(yaw.current);
    const fz = -Math.cos(yaw.current);
    let mx = 0;
    let mz = 0;
    if (k.has('forward')) (mx += fx), (mz += fz);
    if (k.has('back')) (mx -= fx), (mz -= fz);
    if (k.has('left')) (mx += fz), (mz -= fx);
    if (k.has('right')) (mx -= fz), (mz += fx);
    camera.position.x += mx * speed;
    camera.position.z += mz * speed;
    camera.position.y = eyeY;
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
  });
  return null;
}

/** Turn a pointer position into a point on a horizontal plane. */
export function pointOnPlane(e: PointerEvent, dom: HTMLElement, camera: THREE.Camera, planeY: number): THREE.Vector3 | null {
  const r = dom.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const out = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), out);
}
