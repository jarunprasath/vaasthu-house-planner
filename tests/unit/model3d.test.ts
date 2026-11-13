import { describe, expect, it } from 'vitest';
import { createOpening, createWall } from '../../src/model/factory';
import { createSampleProject } from '../../src/templates/sample60x58';
import { buildParts, floorElevations, PLINTH_MM, wallPieces } from '../../src/three/buildModel';

describe('3D model builder', () => {
  const wall = createWall({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'exterior', 230, 3000);

  it('cuts a window into a wall: sides, below the sill and above the lintel', () => {
    const win = createOpening('window', wall.id, 2000); // 1219 wide, sill 914, height 1219
    const pieces = wallPieces(wall, [win]);
    expect(pieces).toHaveLength(4);
    const below = pieces.find((p) => p.v0 === 0 && p.v1 < 3000)!;
    expect(below.v1).toBeCloseTo(win.sillMm);
    const above = pieces.find((p) => p.v0 > 0)!;
    expect(above.v0).toBeCloseTo(win.sillMm + win.heightMm);
    // the wall's total length is preserved, including square ends
    const fullHeight = pieces.filter((p) => p.v0 === 0 && p.v1 === 3000);
    const length = fullHeight.reduce((s, p) => s + (p.u1 - p.u0), 0) + win.widthMm;
    expect(length).toBeCloseTo(4000 + 230);
  });

  it('a door leaves only a lintel above it', () => {
    const door = createOpening('door', wall.id, 1000);
    const pieces = wallPieces(wall, [door]);
    expect(pieces.filter((p) => p.u0 >= door.offsetMm - door.widthMm / 2 - 1 && p.u1 <= door.offsetMm + door.widthMm / 2 + 1)).toHaveLength(1);
  });

  it('stacks floors on the plinth', () => {
    const p = createSampleProject();
    const e = floorElevations(p);
    const [g, roof] = [...p.floors].sort((a, b) => a.level - b.level);
    expect(e.get(g.id)).toBe(PLINTH_MM);
    expect(e.get(roof.id)).toBe(PLINTH_MM + g.heightMm);
  });

  it('builds walls, glass, doors, slabs, stairs and a parapet for the sample', () => {
    const parts = buildParts(createSampleProject());
    const kinds = new Set(parts.map((p) => p.kind));
    for (const k of ['wall', 'glass', 'door', 'slab', 'step', 'parapet', 'tank', 'lid', 'site', 'gate']) expect(kinds).toContain(k);
    expect(parts.every((p) => p.shape !== 'box' || (p.sx > 0 && p.sy > 0 && p.sz > 0))).toBe(true);
  });

  it('builds a gable roof when chosen', () => {
    const p = createSampleProject();
    p.roof.type = 'gable';
    const parts = buildParts(p);
    expect(parts.some((x) => x.shape === 'gable')).toBe(true);
    expect(parts.some((x) => x.kind === 'parapet')).toBe(false);
  });
});
