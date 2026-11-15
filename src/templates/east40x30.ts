import { createFloor, createOpening, createProject, rectangularBoundary } from '../model/factory';
import { projectT, wallLength } from '../model/geometry';
import { ft } from '../model/units';
import { buildCompoundWalls, buildWallsFromRooms } from '../model/wallBuilder';
import type { Project } from '../model/types';
import { compoundWallSide } from '../store/projectStore';
import { openingAtFt, roomFt } from './helpers';

/**
 * East-facing 2BHK on a 40 ft (west–east) × 30 ft (north–south) plot, road on the east.
 *
 * Coordinates in feet: x from the west boundary, y from the north boundary.
 * Setbacks: north 2', south 2', west 2', east 4'. House outline x 2–36, y 2–28 (34' × 26').
 * House 3×3 grid: columns 2–13.3 / 13.3–24.7 / 24.7–36, rows 2–10.7 / 10.7–19.3 / 19.3–28.
 *
 * Placement (default Vaasthu profile in this app):
 *  - Main door on the east face, north-east zone, entered from the sit-out.
 *  - Pooja room in the north-east corner; sit-out in front of the main door (east/north-east).
 *  - Car portico on the east, sit-out opening onto it; car enters from the east road.
 *  - Kitchen in the south-east; master bedroom in the south-west; bedroom 2 in the north-west.
 *  - Common bath in the west, master bath in the south; dining near the centre (no wet room,
 *    stair, kitchen or store on the centre).
 *  - Sump in the north-east of the plot; overhead tank over the south-west on the roof.
 *
 * Traditional preferences only. This is an editable starting point, not an engineered or approved
 * design: setbacks, structure and services must be checked with the local authority and an engineer.
 */
export function createEast40x30Project(): Project {
  const project = createProject('East-facing 2BHK — 40×30 plot');
  project.plot = {
    boundary: rectangularBoundary(ft(40), ft(30)),
    roads: [{ side: 'E', widthMm: ft(20) }],
    neighbours: ['N', 'S', 'W'],
    setbacks: { N: ft(2), S: ft(2), E: ft(4), W: ft(2) },
    elevationMm: ft(1.5),
    slopePercent: 0,
    slopeTowards: 'E',
    maxFloors: 2,
    maxHeightMm: ft(30),
    maxCoveragePercent: 0,
  };

  const g = createFloor(0, 'Ground floor');
  g.rooms = [
    // North row (y 2–12)
    roomFt('bedroom', 2, 2, 12, 10, 'Bedroom 2'),
    roomFt('living', 14, 2, 16, 10, 'Living room'),
    roomFt('pooja', 30, 2, 6, 5, 'Pooja room'),
    roomFt('sitout', 30, 7, 6, 5, 'Sit-out'),
    // Middle band (y 12–21)
    roomFt('bathroom', 2, 12, 6, 6, 'Common bath'),
    roomFt('passage', 8, 12, 6, 6, 'Passage'),
    roomFt('dining', 14, 12, 10, 9, 'Dining'),
    roomFt('portico', 24, 12, 12, 9, 'Car portico'),
    // South row
    roomFt('master_bedroom', 2, 18, 12, 10, 'Master bedroom'),
    roomFt('bathroom', 14, 21, 6, 7, 'Master bath'),
    roomFt('kitchen', 20, 21, 16, 7, 'Kitchen'),
    // Site (open, allowed in setbacks)
    roomFt('pathway', 36, 7, 4, 5, 'Walkway from east gate'),
    roomFt('pathway', 36, 12, 4, 9, 'Driveway to portico'),
    roomFt('sump', 37, 2, 3, 4, 'Sump'),
  ];
  g.walls = buildWallsFromRooms(g.rooms, project.settings);
  const W = g.walls;
  g.openings = [
    // Doors
    openingAtFt(W, 'door', 30, 9.5, 3.5, 'MD (main door)', { isMain: true }),
    openingAtFt(W, 'door', 30, 4.5, 2.5, 'D1 (pooja)'),
    openingAtFt(W, 'door', 11, 12, 3, 'D2 (bedroom 2)'),
    openingAtFt(W, 'door', 8, 15, 2.5, 'D3 (common bath)'),
    openingAtFt(W, 'door', 11, 18, 3, 'D4 (master bedroom)'),
    openingAtFt(W, 'door', 14, 24.5, 2.5, 'D5 (master bath)'),
    openingAtFt(W, 'door', 22, 21, 3, 'D6 (kitchen)'),
    openingAtFt(W, 'door', 14, 15, 3, 'D7 (passage to dining)'),
    openingAtFt(W, 'door', 19, 12, 4, 'D8 (living to dining)'),
    openingAtFt(W, 'door', 24, 16.5, 3, 'D9 (portico to dining)'),
    openingAtFt(W, 'gate', 36, 16.5, 8, 'S1 (portico opening)', { heightMm: ft(8) }),
    // Windows
    openingAtFt(W, 'window', 8, 2, 4, 'W1'),
    openingAtFt(W, 'window', 2, 7, 3, 'W2'),
    openingAtFt(W, 'window', 22, 2, 5, 'W3'),
    openingAtFt(W, 'window', 33, 2, 2, 'W4 (pooja)'),
    openingAtFt(W, 'window', 2, 23, 4, 'W5'),
    openingAtFt(W, 'window', 8, 28, 4, 'W6'),
    openingAtFt(W, 'window', 36, 24.5, 3, 'W7 (kitchen, east)'),
    openingAtFt(W, 'window', 28, 28, 4, 'W8 (kitchen, south)'),
    openingAtFt(W, 'window', 27, 12, 3, 'W9 (living over portico)'),
    openingAtFt(W, 'window', 2, 15, 2, 'V1', { heightMm: ft(2), sillMm: ft(5) }),
    openingAtFt(W, 'window', 17, 28, 2, 'V2', { heightMm: ft(2), sillMm: ft(5) }),
  ];

  const roof = createFloor(1, 'Terrace (roof)');
  roof.rooms = [
    roomFt('terrace', 2, 2, 34, 26, 'Roof terrace'),
    roomFt('overhead_tank', 3, 22, 5, 5, 'Overhead tank'),
  ];

  project.floors = [g, roof];
  project.footprint = { x: ft(2), y: ft(2), w: ft(34), d: ft(26), locked: false };

  // Compound wall with a vehicle gate and a pedestrian gate on the east road.
  project.siteWalls = buildCompoundWalls(project);
  const east = project.siteWalls.find((s) => compoundWallSide(s, project) === 'E');
  if (!east) throw new Error('Template error: east compound wall missing');
  const gate = (yFt: number, widthFt: number, label: string) => {
    const o = createOpening('gate', east.id, projectT({ x: ft(40), y: ft(yFt) }, east.a, east.b) * wallLength(east), label);
    o.widthMm = ft(widthFt);
    return o;
  };
  project.siteOpenings = [gate(16.5, 9, 'G1 (vehicle gate, east road)'), gate(9.5, 4, 'G2 (pedestrian gate, east road)')];
  return project;
}
