import { createFloor, createOpening, createProject, rectangularBoundary } from '../model/factory';
import { projectT, wallLength } from '../model/geometry';
import { ft } from '../model/units';
import { buildCompoundWalls, buildWallsFromRooms } from '../model/wallBuilder';
import type { Project } from '../model/types';
import { compoundWallSide } from '../store/projectStore';
import { openingAtFt, roomFt } from './helpers';

/**
 * East-facing 2BHK, house 40 ft (west–east) × 30 ft (north–south) on a 60 ft × 58 ft plot.
 *
 * Coordinates in feet: x from the west boundary, y from the north boundary.
 * House outline x 5–45, y 23–53: 5' to the west and south boundaries, 15' to the east,
 * 23' of open land to the north.
 * House 3×3 grid: columns 5–18.3 / 18.3–31.7 / 31.7–45, rows 23–33 / 33–43 / 43–53.
 *
 * Placement (default Vaasthu profile in this app):
 *  - Guest veranda and main door on the east face, north-east zone; pooja room in the north-east corner.
 *  - Hall on the north; bedroom 2 north-west; master bedroom south-west; common bath west.
 *  - Car portico south-east, entered from the east; staircase to the first floor on the south,
 *    entered from the portico.
 *  - Kitchen east (between the veranda and the portico), opening to the dining and to the portico.
 *  - Open land, sump (north-east) and septic tank (north-west) on the north part of the plot.
 *
 * Traditional preferences only. An editable starting point, not an engineered or approved design.
 */
export function createEast60x58Project(): Project {
  const project = createProject('East-facing 2BHK — 40×30 house on 60×58 plot');
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
    // North row (y 23–35)
    roomFt('bedroom', 5, 23, 12, 12, 'Bedroom 2'),
    roomFt('living', 17, 23, 22, 12, 'Hall'),
    roomFt('pooja', 39, 23, 6, 6, 'Pooja room'),
    roomFt('sitout', 39, 29, 6, 6, 'Guest veranda'),
    // Middle band (y 35–43)
    roomFt('bathroom', 5, 35, 6, 8, 'Common bath'),
    roomFt('dining', 11, 35, 20, 8, 'Dining'),
    roomFt('kitchen', 31, 35, 14, 8, 'Kitchen'),
    // South row (y 43–53)
    roomFt('master_bedroom', 5, 43, 12, 10, 'Master bedroom'),
    roomFt('bathroom', 17, 43, 5, 10, 'Master bath'),
    { ...roomFt('staircase', 22, 43, 7, 10, 'Staircase (from portico)'), stairUp: 'N' },
    roomFt('portico', 29, 43, 16, 10, 'Car portico'),
    // Site (open, allowed in setbacks)
    roomFt('garden', 5, 6, 40, 14, 'Open land / garden (north)'),
    roomFt('pathway', 45, 29, 15, 6, 'Walkway from east gate'),
    roomFt('pathway', 45, 44, 15, 8, 'Driveway to portico'),
    roomFt('sump', 52, 4, 4, 4, 'Sump'),
    roomFt('septic_tank', 1, 1, 5, 4, 'Septic tank'),
  ];
  g.walls = buildWallsFromRooms(g.rooms, project.settings);
  const W = g.walls;
  g.openings = [
    // Doors
    openingAtFt(W, 'door', 39, 32, 3.5, 'MD (main door)', { isMain: true }),
    openingAtFt(W, 'door', 39, 26, 2.5, 'D1 (pooja)'),
    openingAtFt(W, 'door', 17, 31, 3, 'D2 (bedroom 2)'),
    openingAtFt(W, 'door', 24, 35, 5, 'D3 (hall to dining)'),
    openingAtFt(W, 'door', 11, 39, 2.5, 'D4 (common bath)'),
    openingAtFt(W, 'door', 14, 43, 3, 'D5 (master bedroom)'),
    openingAtFt(W, 'door', 17, 48, 2.5, 'D6 (master bath)'),
    openingAtFt(W, 'door', 31, 39, 3, 'D7 (kitchen)'),
    openingAtFt(W, 'door', 34, 43, 3, 'D8 (kitchen to portico)'),
    openingAtFt(W, 'gate', 45, 48, 9, 'S1 (portico opening)', { heightMm: ft(8) }),
    openingAtFt(W, 'gate', 29, 50.5, 3.5, 'O1 (portico to staircase)', { heightMm: ft(7) }),
    // Windows
    openingAtFt(W, 'window', 11, 23, 4, 'W1'),
    openingAtFt(W, 'window', 5, 29, 4, 'W2'),
    openingAtFt(W, 'window', 23, 23, 5, 'W3'),
    openingAtFt(W, 'window', 33, 23, 5, 'W4'),
    openingAtFt(W, 'window', 42, 23, 2, 'W5 (pooja)'),
    openingAtFt(W, 'window', 45, 39, 4, 'W6 (kitchen)'),
    openingAtFt(W, 'window', 5, 48, 4, 'W7'),
    openingAtFt(W, 'window', 11, 53, 4, 'W8'),
    openingAtFt(W, 'window', 5, 39, 2, 'V1', { heightMm: ft(2), sillMm: ft(5) }),
    openingAtFt(W, 'window', 19.5, 53, 2, 'V2', { heightMm: ft(2), sillMm: ft(5) }),
  ];

  const first = createFloor(1, 'First floor (open terrace for now)');
  first.rooms = [
    roomFt('terrace', 5, 23, 17, 30, 'Open terrace (west)'),
    roomFt('terrace', 29, 23, 16, 30, 'Open terrace (east)'),
    roomFt('terrace', 22, 23, 7, 20, 'Open terrace (middle)'),
    { ...roomFt('staircase', 22, 43, 7, 10, 'Stair arrival'), stairUp: 'N' },
    roomFt('overhead_tank', 6, 47, 5, 5, 'Overhead tank'),
  ];

  project.floors = [g, first];
  project.footprint = { x: ft(5), y: ft(23), w: ft(40), d: ft(30), locked: false };

  // Compound wall with a vehicle gate and a pedestrian gate on the east road.
  project.siteWalls = buildCompoundWalls(project);
  const east = project.siteWalls.find((s) => compoundWallSide(s, project) === 'E');
  if (!east) throw new Error('Template error: east compound wall missing');
  const gate = (yFt: number, widthFt: number, label: string) => {
    const o = createOpening('gate', east.id, projectT({ x: ft(60), y: ft(yFt) }, east.a, east.b) * wallLength(east), label);
    o.widthMm = ft(widthFt);
    return o;
  };
  project.siteOpenings = [gate(48, 10, 'G1 (vehicle gate, east road)'), gate(32, 4, 'G2 (pedestrian gate, east road)')];
  return project;
}
