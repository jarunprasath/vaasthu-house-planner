import { describe, expect, it } from 'vitest';
import { createFloor, createPlot, createProject, createRoom } from '../../src/model/factory';
import { ft } from '../../src/model/units';
import { buildWallsFromRooms } from '../../src/model/wallBuilder';
import { parseProjectFile } from '../../src/storage/projectFile';
import { createSampleProject } from '../../src/templates/sample60x58';
import { applySwap, evaluate, mainEntrance, suggestLayout, suggestSwaps } from '../../src/vaasthu/engine';
import { defaultRules, RULE_TEXT, ZONE_IDS } from '../../src/vaasthu/rules';

/** 30×30 ft house on a 40×40 plot; rooms placed by 3×3 zone (10 ft cells). */
function house(rooms: [Parameters<typeof createRoom>[0], number, number, number?, number?][]) {
  const p = createProject('t', createPlot(ft(40), ft(40)));
  p.footprint = { x: ft(5), y: ft(5), w: ft(30), d: ft(30), locked: false };
  const f = createFloor(0);
  f.rooms = rooms.map(([t, col, row, w = 10, d = 10]) => createRoom(t, ft(5 + col * 10), ft(5 + row * 10), ft(w), ft(d)));
  f.walls = buildWallsFromRooms(f.rooms, p.settings);
  p.floors = [f];
  return p;
}

describe('vaasthu engine', () => {
  it('rates rooms by the zone of their centre on the house grid', () => {
    const r = evaluate(house([['kitchen', 2, 2], ['pooja', 2, 0], ['master_bedroom', 0, 2], ['toilet', 2, 0, 5, 5]]));
    const byName = Object.fromEntries(r.items.map((i) => [i.name, [i.zone, i.rating]]));
    expect(byName['Kitchen']).toEqual(['SE', 'preferred']);
    expect(byName['Pooja room']).toEqual(['NE', 'preferred']);
    expect(byName['Master bedroom']).toEqual(['SW', 'preferred']);
    expect(byName['Toilet']).toEqual(['NE', 'avoid']);
    expect(r.houseGridSource).toBe('outline');
  });

  it('scores 100 when everything is in a preferred zone', () => {
    expect(evaluate(house([['kitchen', 2, 2], ['master_bedroom', 0, 2]])).score).toBe(100);
  });

  it('flags toilets, stairs and kitchens on the centre (Brahmasthan)', () => {
    const p = house([['toilet', 1, 1]]);
    expect(evaluate(p).centreIssues.map((c) => c.name)).toEqual(['Toilet']);
    p.vaasthu.keepCentreOpen = false;
    expect(evaluate(p).centreIssues).toEqual([]);
  });

  it('uses the plot grid for the sump', () => {
    const p = house([]);
    p.floors[0].rooms.push(createRoom('sump', ft(35), ft(1), ft(4), ft(3)));
    const item = evaluate(p).items.find((i) => i.target === 'sump')!;
    expect([item.zone, item.rating, item.onPlot]).toEqual(['NE', 'preferred', true]);
  });

  it('respects edited and disabled rules', () => {
    const p = house([['kitchen', 0, 1]]); // west
    expect(evaluate(p).items[0].rating).toBe('neutral');
    p.vaasthu.rules.find((r) => r.target === 'kitchen')!.zones.W = 'avoid';
    expect(evaluate(p).items[0].rating).toBe('avoid');
    p.vaasthu.rules.find((r) => r.target === 'kitchen')!.enabled = false;
    expect(evaluate(p).items).toEqual([]);
  });

  it('finds the main entrance: marked door first, then an exterior door as a guess', () => {
    const p = createSampleProject();
    expect(mainEntrance(p)?.guessed).toBe(false);
    for (const o of p.floors[0].openings) o.isMain = undefined;
    for (const o of p.floors[0].openings) o.label = o.label.replace(/^MD/, 'D0');
    expect(mainEntrance(p)?.guessed).toBe(true);
  });

  it('suggests swaps that raise the score and applies them without moving walls', () => {
    // Kitchen in SW and master bedroom in SE: swapping their use fixes both.
    const p = house([['kitchen', 0, 2], ['master_bedroom', 2, 2]]);
    const [best] = suggestSwaps(p);
    expect(best.delta).toBeGreaterThan(0);
    const swapped = applySwap(p, best);
    expect(evaluate(swapped).score).toBe(100);
    expect(swapped.floors[0].walls).toEqual(p.floors[0].walls);
    const layout = suggestLayout(p);
    expect(layout.to).toBe(100);
    expect(evaluate(p).score).toBeLessThan(100); // nothing applied
  });

  it('never swaps rooms of very different size', () => {
    const p = house([['pooja', 0, 2, 5, 5], ['master_bedroom', 2, 0]]);
    expect(suggestSwaps(p)).toEqual([]);
  });

  it('has English and Tamil text for every rule', () => {
    for (const r of defaultRules()) {
      const t = RULE_TEXT[r.target]!;
      expect(t.label.en && t.label.ta && t.explain.en && t.explain.ta).toBeTruthy();
      expect(Object.keys(r.zones).sort()).toEqual([...ZONE_IDS].sort());
    }
  });

  it('sample house: entrance, pooja and master bedroom in preferred zones', () => {
    const r = evaluate(createSampleProject());
    const get = (n: string) => r.items.find((i) => i.name.startsWith(n))!;
    expect(get('MD').rating).toBe('preferred');
    expect(get('Pooja').zone).toBe('NE');
    expect(get('Master bedroom').zone).toBe('SW');
    expect(r.score).toBeGreaterThan(60);
  });

  it('older project files get default rules, finishes and roof', () => {
    const raw = JSON.parse(JSON.stringify(createSampleProject()));
    delete raw.vaasthu;
    delete raw.finishes;
    delete raw.roof;
    const p = parseProjectFile(JSON.stringify(raw));
    expect(p.vaasthu.rules.length).toBe(defaultRules().length);
    expect(p.finishes.floor).toBeTruthy();
    expect(p.roof.type).toBe('flat');
  });
});
