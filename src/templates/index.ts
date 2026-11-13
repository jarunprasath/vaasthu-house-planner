import { createFloor, createPlot, createProject } from '../model/factory';
import { ft } from '../model/units';
import { buildWallsFromRooms } from '../model/wallBuilder';
import type { Project } from '../model/types';
import { openingAtFt, roomFt } from './helpers';
import { createSampleProject } from './sample60x58';

export interface Template {
  id: string;
  name: string;
  description: string;
  create: () => Project;
}

function createBlank(): Project {
  return createProject('New house', createPlot(ft(30), ft(40)));
}

/** Compact 1BHK on a 30 ft × 40 ft plot with the road on the north. */
function create1BHK(): Project {
  const p = createProject('1BHK — 30×40 plot', createPlot(ft(30), ft(40)));
  const g = createFloor(0);
  g.rooms = [
    roomFt('living', 3, 5, 13, 12, 'Living room'),
    roomFt('kitchen', 16, 5, 11, 8, 'Kitchen'),
    roomFt('dining', 16, 13, 11, 7, 'Dining'),
    roomFt('bedroom', 3, 17, 13, 12, 'Bedroom'),
    roomFt('bathroom', 16, 20, 6, 6, 'Bath'),
    roomFt('utility', 22, 20, 5, 6, 'Utility'),
  ];
  g.walls = buildWallsFromRooms(g.rooms, p.settings);
  const W = g.walls;
  g.openings = [
    openingAtFt(W, 'door', 9.5, 5, 3.5, 'MD (main door)'),
    openingAtFt(W, 'door', 9.5, 17, 3, 'D1'),
    openingAtFt(W, 'door', 16, 15, 3, 'D2'),
    openingAtFt(W, 'door', 21.5, 13, 3, 'D3'),
    openingAtFt(W, 'door', 19, 20, 2.5, 'D4'),
    openingAtFt(W, 'door', 24.5, 20, 2.5, 'D5'),
    openingAtFt(W, 'window', 5, 5, 3, 'W1'),
    openingAtFt(W, 'window', 3, 23, 4, 'W2'),
    openingAtFt(W, 'window', 9.5, 29, 4, 'W3'),
    openingAtFt(W, 'window', 27, 9, 3, 'W4'),
    openingAtFt(W, 'window', 27, 16.5, 4, 'W5'),
    openingAtFt(W, 'window', 19, 26, 2, 'V1', { heightMm: ft(2), sillMm: ft(5) }),
    openingAtFt(W, 'window', 27, 23, 2, 'W6'),
  ];
  p.floors = [g];
  return p;
}

export const TEMPLATES: Template[] = [
  {
    id: 'sample-60x58',
    name: '2BHK sample — 60′×58′, north entrance',
    description:
      'Roads east and west, enclosed car portico, external staircase from the portico, pooja room, compound wall with two gates.',
    create: createSampleProject,
  },
  {
    id: '1bhk',
    name: '1BHK — 30′×40′ plot',
    description: 'Compact single-floor 1BHK with the road on the north.',
    create: create1BHK,
  },
  {
    id: 'blank',
    name: 'Blank plot — 30′×40′',
    description: 'Empty plot. Set the plot size in Plot settings, then draw rooms.',
    create: createBlank,
  },
];
