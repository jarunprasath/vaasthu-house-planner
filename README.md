# Vaasthu House Planner

A browser-based house planner for homeowners in India and elsewhere: set up your plot, draw rooms, add
doors and windows, check the plan, and print a dimensioned drawing set.

This is **Phase 1 — the functional foundation** of a larger plan (Vaasthu guidance, 3D, interiors,
engineering layers, AI assistant and 4D construction come later — see
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)). Everything listed under “What works” below
is built and tested; nothing in the app is a placeholder.

> Drawings produced by this app are **preliminary and not for construction**. Structural, electrical and
> plumbing design, and building approval, need qualified professionals and your local authority.

## What works

**Plot**
- Rectangular or irregular plots (drag corners, add or remove corners, or type coordinates).
- Roads and neighbours on any side, road widths, setbacks per side, plot level, slope.
- Limits to check against: maximum floors, height and ground coverage.

**House on the plot**
- Set the house’s overall size separately from the plot (for example a 29′ × 41′ house on a 60′ × 58′ plot).
- Drag the house outline (or its label) around the plot; the rooms and walls inside it move with it on
  every floor. Arrow keys nudge it.
- Live gap to each boundary and the open land left; type a gap to place the house, or centre it.
- Shown on the PDF site plan and in the area statement; flagged if it leaves the plot or enters a setback.

**2D plan editor**
- Draw rooms by dragging; move, resize, rotate 90°, duplicate, lock, delete.
- Type exact sizes and positions in feet-and-inches, inches, metres or centimetres
  (`12'6"`, `12 ft 6 in`, `12.5`, `3.8m`, `380cm` all work).
- Generate walls from rooms (shared edges become one interior wall), or draw walls by hand; move walls
  and their end points; thickness, height, material.
- Doors, windows and gates hosted on walls — drag along the wall, flip hinge and swing side.
- Compound wall around the plot with gates.
- Multiple floors (add, duplicate, rename, delete), with the floor below shown faintly.
- Measure tool, grid with snapping, zoom and pan (mouse wheel, pinch, keyboard), compass,
  3×3 direction-zone overlay, plot / setback / building dimensions.
- Undo / redo for every change.

**Checks** (re-run on every change)
- Rooms or walls outside the plot, rooms inside a named setback, overlapping rooms.
- Doors or windows that do not fit their wall or overlap each other.
- Rooms with no door, living rooms / bedrooms / kitchens / baths with no window or ventilator.
- No entrance door on the ground floor; floor-count, height and ground-coverage limits.

**Save, print, export**
- Autosave to the browser (IndexedDB), project list, open / delete.
- Project file export / import (`.vhp.json`, versioned schema).
- PDF drawing set on A4, A3 or A2: site plan, a plan per floor, door/window/gate schedule and area
  statement, each page with title block, scale, date, revision, page numbers, north arrow, legend,
  scale bar and a “Preliminary — not for construction” mark.
- PNG of the current view.

**Interface**
- Left: tools and room types. Centre: plan. Right: selected item’s properties, or the overview with
  areas, checks and the room list. Bottom: floors, units, snap, zoom.
- Light and dark themes, keyboard shortcuts (press `?`-icon → Help), phone and tablet layouts.

**Templates**
- The 60′ × 58′ north-entrance 2BHK sample from the brief (roads east and west, enclosed car portico,
  external stair entered from the portico, pooja room, kitchen with store, compound wall with a vehicle
  gate on the west road and a pedestrian gate on the east road).
- A 1BHK on a 30′ × 40′ plot, and a blank plot.

## Not built yet

Vaasthu rules, recommendations and scoring; 3D and walkthroughs; Tamil language; paint, tiles and
materials; kitchen, bathroom and furniture designers; elevations; electrical, plumbing and drainage
layers; cost estimates; AI assistant; 4D construction timeline; DXF / GLB / IFC export; cloud accounts;
offline (PWA) install. Building-regulation presets are deliberately not included until they can be
taken from current official rules — enter your authority’s setbacks and limits yourself.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). First run `npx playwright install chromium`, or set `CHROME_PATH` to an installed Chrome |
| `npm run typecheck` | TypeScript only |

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` runs the type-check, unit tests and browser tests, builds
with the repository name as the base path, and publishes `dist/`.

One-time setup: in the repository on GitHub, open **Settings → Pages** and set **Source** to
**GitHub Actions**. The site then appears at `https://<user>.github.io/<repository>/`.

Phase 1 is fully static and needs no server. A backend becomes necessary only for: the AI assistant
(so API keys are never shipped to the browser), user accounts, cloud sync / collaboration, and any
server-side rendering. Secrets must live in server-side environment variables, never in frontend code.

## How it is built

- React 19, TypeScript, Vite, Tailwind CSS 4
- Konva / react-konva for the 2D canvas
- Zustand + Immer for state and undo history
- IndexedDB (via `idb`) for local storage
- jsPDF for vector PDF output (loaded only when you export)

```
src/
  model/        building model types, units & length parsing, geometry, wall builder, areas
  validation/   plan checks → list of issues
  store/        project store (with undo/redo), UI store
  storage/      IndexedDB persistence, project-file import/export with schema migration
  export/       PDF drawing set
  templates/    sample projects
  editor/       Konva canvas, shapes, palette
  ui/           panels, dialogs, form fields
tests/unit/     Vitest
tests/e2e/      Playwright
```

**One building model.** Every view and export reads the same plain-data model (`src/model/types.ts`).
All lengths are stored in millimetres; feet, inches, metres and centimetres are display formats only.
Plan coordinates start at the plot’s north-west corner, with x increasing east and y increasing south,
so north is always up. Rooms are rectangles measured to wall centre-lines; doors and windows are
attached to walls by id and offset, so they move with their wall. Later phases (3D, Vaasthu,
electrical, plumbing, 4D) add to this model instead of keeping their own copies.

**Known limitations**
- Rooms are rectangles; irregular rooms can be made from several rectangles for now.
- Setback lines on strongly concave plots should be checked visually.
- PDF text uses the built-in Helvetica font, so non-Latin room names (for example Tamil) will not print
  correctly yet. Tamil text needs an embedded font and proper text shaping — planned with the Tamil UI.
- Areas are computed from room rectangles to wall centre-lines and are not certified built-up areas.
