import { createFloor, createProject, rectangularBoundary } from '../model/factory';
import { ft } from '../model/units';
import { buildCompoundWalls, buildWallsFromRooms } from '../model/wallBuilder';
import type { Project } from '../model/types';
import { compoundWallSide } from '../store/projectStore';
import { openingAtFt, roomFt } from './helpers';
import { createOpening } from '../model/factory';
import { projectT, wallLength } from '../model/geometry';

/**
 * Sample project from the brief:
 *  - Plot 60 ft (east–west) × 58 ft (north–south); roads on east and west; neighbours north and south.
 *  - Ground floor 2BHK, main entrance facing north, enclosed car portico, external staircase
 *    entered from the portico, pooja room, kitchen with store, more open space on the north side.
 *
 * Coordinates in feet: x from the west boundary, y from the north boundary.
 * Setbacks: north 15', south 10', west 7', east 9'. Building envelope x 7–51, y 15–48.
 * This is an editable starting point, not an engineered or approved design.
 */
export function createSampleProject(): Project {
  const project = createProject('Sample — 60×58 north-facing 2BHK');
  project.plot = {
    boundary: rectangularBoundary(ft(60), ft(58)),
    roads: [
      { side: 'E', widthMm: ft(20) },
      { side: 'W', widthMm: ft(20) },
    ],
    neighbours: ['N', 'S'],
    setbacks: { N: ft(15), S: ft(10), E: ft(9), W: ft(7) },
    elevationMm: ft(1.5),
    slopePercent: 0,
    slopeTowards: 'N',
    maxFloors: 2,
    maxHeightMm: ft(30),
    maxCoveragePercent: 0,
  };

  const g = createFloor(0, 'Ground floor');
  g.rooms = [
    // North row (y 15–31)
    roomFt('portico', 7, 15, 12, 16, 'Car portico (enclosed)'),
    { ...roomFt('staircase', 19, 15, 4, 16, 'External staircase'), stairUp: 'S' },
    roomFt('living', 23, 15, 15, 16, 'Living room'),
    roomFt('foyer', 38, 15, 6, 6, 'Foyer'),
    roomFt('pooja', 44, 15, 7, 6, 'Pooja room'),
    roomFt('dining', 38, 21, 13, 10, 'Dining'),
    // South part (y 31–48)
    roomFt('passage', 7, 31, 31, 4, 'Passage'),
    roomFt('master_bedroom', 7, 35, 13, 13, 'Master bedroom'),
    roomFt('bathroom', 20, 35, 6, 6, 'Common bath'),
    roomFt('bathroom', 20, 41, 6, 7, 'Master bath'),
    roomFt('bedroom', 26, 35, 12, 13, 'Bedroom 2'),
    roomFt('kitchen', 38, 31, 13, 10, 'Kitchen'),
    roomFt('utility', 38, 41, 6, 7, 'Utility / wash'),
    roomFt('store', 44, 41, 7, 7, 'Store'),
    // Site (open, allowed in setbacks)
    roomFt('garden', 7, 2, 31, 11, 'Front garden (north)'),
    roomFt('pathway', 40, 6, 20, 4, 'Walkway from east gate'),
    roomFt('pathway', 40, 10, 4, 5, 'Walkway to main door'),
    roomFt('pathway', 0, 17, 7, 12, 'Driveway from west gate'),
  ];
  g.walls = buildWallsFromRooms(g.rooms, project.settings);
  const W = g.walls;
  g.openings = [
    // Doors
    openingAtFt(W, 'door', 41, 15, 3.5, 'MD (main door)'),
    openingAtFt(W, 'door', 38, 18, 3, 'D1'),
    openingAtFt(W, 'door', 41, 21, 3, 'D2'),
    openingAtFt(W, 'door', 44, 18, 2.5, 'D3'),
    openingAtFt(W, 'door', 30.5, 31, 3, 'D4'),
    openingAtFt(W, 'door', 41, 31, 3, 'D5'),
    openingAtFt(W, 'door', 17, 35, 3, 'D6'),
    openingAtFt(W, 'door', 23, 35, 2.5, 'D7'),
    openingAtFt(W, 'door', 35, 35, 3, 'D8'),
    openingAtFt(W, 'door', 20, 45, 2.5, 'D9'),
    openingAtFt(W, 'door', 41, 48, 3, 'D10 (utility to yard)'),
    openingAtFt(W, 'door', 47.5, 41, 2.5, 'D11'),
    openingAtFt(W, 'door', 41, 41, 2.5, 'D12'),
    openingAtFt(W, 'door', 19, 17.5, 3, 'D13 (portico to stair)'),
    openingAtFt(W, 'door', 13, 31, 3, 'D14 (portico to house)'),
    openingAtFt(W, 'gate', 7, 23, 9, 'S1 (portico shutter)', { heightMm: ft(8) }),
    // Windows
    openingAtFt(W, 'window', 30.5, 15, 5, 'W1'),
    openingAtFt(W, 'window', 47.5, 15, 2, 'W2'),
    openingAtFt(W, 'window', 51, 18, 2, 'W3'),
    openingAtFt(W, 'window', 51, 26, 4, 'W4'),
    openingAtFt(W, 'window', 51, 36, 4, 'W5'),
    openingAtFt(W, 'window', 51, 44.5, 2, 'W6'),
    openingAtFt(W, 'window', 7, 41.5, 4, 'W7'),
    openingAtFt(W, 'window', 13.5, 48, 4, 'W8'),
    openingAtFt(W, 'window', 32, 48, 4, 'W9'),
    openingAtFt(W, 'window', 23, 48, 2, 'V1', { heightMm: ft(2), sillMm: ft(5) }),
    openingAtFt(W, 'window', 7, 33, 2, 'W10'),
    openingAtFt(W, 'window', 13, 15, 4, 'W11'),
  ];

  const roof = createFloor(1, 'Terrace (roof)');
  roof.rooms = [
    roomFt('terrace', 23, 15, 28, 33, 'Roof terrace'),
    roomFt('terrace', 7, 15, 12, 33, 'Roof terrace (west)'),
    { ...roomFt('staircase', 19, 15, 4, 16, 'Stair arrival'), stairUp: 'S' },
    roomFt('terrace', 19, 31, 4, 17, 'Roof terrace (strip)'),
  ];

  project.floors = [g, roof];

  // Compound wall with a vehicle gate on the west road and a pedestrian gate on the east road.
  project.siteWalls = buildCompoundWalls(project);
  const gate = (side: 'E' | 'W', xFt: number, yFt: number, widthFt: number, label: string) => {
    const w = project.siteWalls.find((s) => compoundWallSide(s, project) === side);
    if (!w) throw new Error('Template error: compound wall missing');
    const p = { x: ft(xFt), y: ft(yFt) };
    const o = createOpening('gate', w.id, projectT(p, w.a, w.b) * wallLength(w), label);
    o.widthMm = ft(widthFt);
    return o;
  };
  project.siteOpenings = [gate('W', 0, 23, 10, 'G1 (vehicle gate, west road)'), gate('E', 60, 8, 4, 'G2 (pedestrian gate, east road)')];
  return project;
}
