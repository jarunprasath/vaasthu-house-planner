/**
 * Procedural textures drawn on a canvas — no image files to download, works offline.
 * They suggest the material (tile joints, wood grain, marble veins…) rather than match a product.
 */
import * as THREE from 'three';

import type { TextureKind, TextureSpec } from './textureSpec';
export { finishTexture, type TextureKind, type TextureSpec } from './textureSpec';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return `#${c.getHexString()}`;
}

function draw(kind: TextureKind, color: string): HTMLCanvasElement {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const r = rng(color.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), kind.length));
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const speckle = (n: number, size: number, light: number, alpha: number) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(color, (r() - 0.5) * light);
      g.globalAlpha = alpha;
      g.fillRect(r() * S, r() * S, size, size);
    }
    g.globalAlpha = 1;
  };
  switch (kind) {
    case 'tile':
      speckle(500, 2, 0.08, 0.35);
      g.strokeStyle = shade(color, -0.18);
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, S - 3, S - 3);
      break;
    case 'wood':
      for (let p = 0; p < 4; p++) {
        const y = (p * S) / 4;
        g.fillStyle = shade(color, (r() - 0.5) * 0.12);
        g.fillRect(0, y, S, S / 4);
        g.strokeStyle = shade(color, -0.12);
        g.globalAlpha = 0.35;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          const yy = y + r() * (S / 4);
          g.moveTo(0, yy);
          g.bezierCurveTo(S / 3, yy + (r() - 0.5) * 8, (2 * S) / 3, yy + (r() - 0.5) * 8, S, yy);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = shade(color, -0.25);
        g.fillRect(0, y, S, 2);
        g.fillRect(((p * 97) % 4) * (S / 4) + 40, y, 2, S / 4);
      }
      break;
    case 'marble':
      speckle(300, 3, 0.05, 0.3);
      g.strokeStyle = shade(color, -0.22);
      for (let v = 0; v < 5; v++) {
        g.globalAlpha = 0.25 + r() * 0.3;
        g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath();
        let x = r() * S;
        let y = 0;
        g.moveTo(x, y);
        while (y < S) {
          x += (r() - 0.5) * 30;
          y += 10 + r() * 20;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'granite':
      speckle(4000, 2, 0.5, 0.55);
      speckle(300, 3, 0.7, 0.6);
      g.strokeStyle = shade(color, -0.2);
      g.lineWidth = 2;
      g.strokeRect(1, 1, S - 2, S - 2);
      break;
    case 'noise':
      speckle(3000, 2, 0.12, 0.35);
      break;
    case 'grass':
      for (let i = 0; i < 2500; i++) {
        g.strokeStyle = shade(color, (r() - 0.5) * 0.25);
        g.globalAlpha = 0.6;
        const x = r() * S;
        const y = r() * S;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'paving':
      speckle(800, 2, 0.1, 0.35);
      g.strokeStyle = shade(color, -0.2);
      g.lineWidth = 2;
      for (let row = 0; row < 4; row++) {
        const y = (row * S) / 4;
        g.strokeRect(0, y, S, S / 4);
        const off = row % 2 ? S / 4 : 0;
        for (let x = off; x < S; x += S / 2) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + S / 4);
          g.stroke();
        }
      }
      break;
    case 'brick':
      g.fillStyle = shade(color, -0.1);
      g.fillRect(0, 0, S, S);
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? 32 : 0;
        for (let x = -off; x < S; x += 64) {
          g.fillStyle = shade(color, (r() - 0.5) * 0.12);
          g.fillRect(x + 2, row * 32 + 2, 60, 28);
        }
      }
      break;
    case 'roofTile':
      for (let row = 0; row < 8; row++) {
        for (let x = 0; x < S; x += 32) {
          const grd = g.createLinearGradient(0, row * 32, 0, row * 32 + 32);
          grd.addColorStop(0, shade(color, 0.08));
          grd.addColorStop(1, shade(color, -0.15));
          g.fillStyle = grd;
          g.beginPath();
          g.ellipse(x + 16 + (row % 2) * 16, row * 32 + 16, 17, 16, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    case 'paint':
      speckle(1500, 2, 0.05, 0.25);
      break;
  }
  return c;
}

const baseCache = new Map<string, THREE.CanvasTexture>();

/** A texture for this kind and colour, repeated to suit a surface of `uM` × `vM` metres. */
export function makeTexture(spec: TextureSpec, color: string, uM: number, vM: number): THREE.Texture {
  const key = `${spec.kind}|${color}`;
  let base = baseCache.get(key);
  if (!base) {
    base = new THREE.CanvasTexture(draw(spec.kind, color));
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 8;
    baseCache.set(key, base);
  }
  const t = base.clone();
  t.repeat.set(Math.max(0.05, uM / spec.tileM), Math.max(0.05, vM / spec.tileM));
  t.needsUpdate = true;
  return t;
}
