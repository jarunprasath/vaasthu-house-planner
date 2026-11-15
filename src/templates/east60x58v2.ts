import { createFloor, createOpening, createProject, createWall, rectangularBoundary } from '../model/factory';
import { projectT, wallLength } from '../model/geometry';
import { ft } from '../model/units';
import { buildCompoundWalls, buildWallsFromRooms } from '../model/wallBuilder';
import type { Project } from '../model/types';
import { compoundWallSide } from '../store/projectStore';
import { openingAtFt, roomFt } from './helpers';

/**
 * East-facing 2BHK, version 2: house 40 ft (west–east) × 30 ft (north–south) on a 60 ft × 58 ft plot,
 * master bedroom 16′×10′, bedroom 2 10′×10′.
 *
 * Coordinates in feet: x from the west boundary, y from the north boundary.
 * House outline x 5–45, y 23–53: 5' to the west and south boundaries, 15' to the east,
 * 23' of open land to the north.
 * House 3×3 grid: columns 5–18.3 / 18.3–31.7 / 31.7–45, rows 23–33 / 33–43 / 43–53.
 *
 * Placement (default Vaasthu profile in this app):
 *  - Guest veranda and main door on the east face, north-east zone; pooja room in the north-east corner.
 *  - Hall on the north; bedroom 2 and common bath north-west; master bedroom south-west.
 *  - Kitchen south-east; car portico on the east, between the veranda and the kitchen.
 *  - Staircase (dog-leg) inside, on the west side, entered from the dining; it climbs towards the south
 *    and turns clockwise.
 *  - Dining on the centre; no bath, stair, kitchen or store on it.
 *  - Open land, sump (north-east) and septic tank (north-west) on the north part of the plot.
 *
 * Traditional preferences only. An editable starting point, not an engineered or approved design.
 */
export function createEast60x58V2Project(): Project {
  const project = createProject('East-facing 2BHK v2 — 40×30 house on 60×58 plot');
  project.plot = {
    boundary: rectangularBoundary(ft(60), ft(58)),
    roads: [
      { side: 'E', widthMm: ft(20) },
      { side: 'W', widthMm: ft(20) },
    ],
    neighbours: ['N', 'S'],
    setbacks: { N: ft(5), S: ft(5), E: ft(5), W: ft(5) },
    elevationMm: ft(1.5),
    slopePercent: 0,
    slopeTowards: 'N',
    maxFloors: 2,
    maxHeightMm: ft(30),
    maxCoveragePercent: 0,
  };

  const g = createFloor(0, 'Ground floor');
  g.rooms = [
    // North row (y 23–33)
    roomFt('bedroom', 5, 23, 10, 10, 'Bedroom 2'),
    roomFt('bathroom', 15, 23, 6, 6, 'Common bath'),
    roomFt('passage', 15, 29, 6, 4, 'Passage'),
    roomFt('living', 21, 23, 18, 10, 'Hall'),
    roomFt('pooja', 39, 23, 6, 5, 'Pooja room'),
    roomFt('sitout', 39, 28, 6, 5, 'Guest veranda'),
    // Middle band (y 33–43)
    { ...roomFt('staircase', 5, 33, 7, 10, 'Staircase (dog-leg)'), stairUp: 'S' },
    roomFt('dining', 12, 33, 19, 10, 'Dining'),
    roomFt('portico', 31, 33, 14, 10, 'Car portico'),
    // South row (y 43–53)
    roomFt('master_bedroom', 5, 43, 16, 10, 'Master bedroom'),
    roomFt('bathroom', 21, 43, 6, 10, 'Master bath'),
    roomFt('kitchen', 27, 43, 18, 10, 'Kitchen'),
    // Site (open, allowed in setbacks)
    roomFt('garden', 5, 6, 40, 14, 'Open land / garden (north)'),
    roomFt('pathway', 45, 28, 15, 5, 'Walkway from east gate'),
    roomFt('pathway', 45, 34, 15, 8, 'Driveway to portico'),
    roomFt('sump', 52, 4, 4, 4, 'Sump'),
    roomFt('septic_tank', 1, 1, 5, 4, 'Septic tank'),
  ];
  g.walls = buildWallsFromRooms(g.rooms, project.settings);
  // The staircase is inside the house: close its west side with an outer wall.
  g.walls.push(
    createWall({ x: ft(5), y: ft(33) }, { x: ft(5), y: ft(43) }, 'exterior', project.settings.defaultExteriorWallMm, project.settings.defaultWallHeightMm),
  );
  const W = g.walls;
  g.openings = [
    // Doors
    openingAtFt(W, 'door', 39, 30.5, 3.5, 'MD (main door)', { isMain: true }),
    openingAtFt(W, 'door', 39, 25.5, 2.5, 'D1 (pooja)'),
    openingAtFt(W, 'door', 15, 31, 3, 'D2 (bedroom 2)'),
    openingAtFt(W, 'door', 18, 29, 2.5, 'D3 (common bath)'),
    openingAtFt(W, 'door', 21, 31, 3, 'D4 (hall to passage)'),
    openingAtFt(W, 'door', 26, 33, 5, 'D5 (hall to dining)'),
    openingAtFt(W, 'door', 18, 33, 3, 'D6 (passage to dining)'),
    openingAtFt(W, 'door', 16, 43, 3, 'D7 (master bedroom)'),
    openingAtFt(W, 'door', 21, 48, 2.5, 'D8 (master bath)'),
    openingAtFt(W, 'door', 29, 43, 3, 'D9 (kitchen)'),
    openingAtFt(W, 'door', 31, 38, 3, 'D10 (portico to dining)'),
    openingAtFt(W, 'door', 41, 43, 3, 'D11 (kitchen to portico)'),
    openingAtFt(W, 'gate', 12, 38, 3.5, 'O1 (dining to staircase)', { heightMm: ft(7) }),
    openingAtFt(W, 'gate', 45, 38, 9, 'S1 (portico opening)', { heightMm: ft(8) }),
    // Windows
    openingAtFt(W, 'window', 10, 23, 4, 'W1'),
    openingAtFt(W, 'window', 5, 28, 3, 'W2'),
    openingAtFt(W, 'window', 26, 23, 5, 'W3'),
    openingAtFt(W, 'window', 34, 23, 4, 'W4'),
    openingAtFt(W, 'window', 42, 23, 2, 'W5 (pooja)'),
    openingAtFt(W, 'window', 5, 38, 3, 'W6 (staircase)'),
    openingAtFt(W, 'window', 5, 48, 4, 'W7'),
    openingAtFt(W, 'window', 13, 53, 4, 'W8'),
    openingAtFt(W, 'window', 45, 48, 4, 'W9 (kitchen, east)'),
    openingAtFt(W, 'window', 36, 53, 4, 'W10 (kitchen, south)'),
    openingAtFt(W, 'window', 18, 23, 2, 'V1', { heightMm: ft(2), sillMm: ft(5) }),
    openingAtFt(W, 'window', 24, 53, 2, 'V2', { heightMm: ft(2), sillMm: ft(5) }),
  ];

  const first = createFloor(1, 'First floor (open terrace for now)');
  first.rooms = [
    roomFt('terrace', 12, 23, 33, 30, 'Open terrace (east)'),
    roomFt('terrace', 5, 23, 7, 10, 'Open terrace (north-west)'),
    { ...roomFt('staircase', 5, 33, 7, 10, 'Stair arrival'), stairUp: 'S' },
    roomFt('terrace', 5, 43, 7, 10, 'Open terrace (south-west)'),
    roomFt('overhead_tank', 6, 47, 5, 5, 'Overhead tank'),
  ];

  project.floors = [g, first];
  project.footprint = { x: ft(5), y: ft(23), w: ft(40), d: ft(30), locked: false };

  project.siteWalls = buildCompoundWalls(project);
  const east = project.siteWalls.find((s) => compoundWallSide(s, project) === 'E');
  if (!east) throw new Error('Template error: east compound wall missing');
  const gate = (yFt: number, widthFt: number, label: string) => {
    const o = createOpening('gate', east.id, projectT({ x: ft(60), y: ft(yFt) }, east.a, east.b) * wallLength(east), label);
    o.widthMm = ft(widthFt);
    return o;
  };
  project.siteOpenings = [gate(38, 10, 'G1 (vehicle gate, east road)'), gate(30.5, 4, 'G2 (pedestrian gate, east road)')];
  return project;
}
