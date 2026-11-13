# Implementation Plan — Vaasthu House Planner

This plan turns the master development prompt into a buildable sequence. Each phase ends with a usable,
tested application. Features that are not yet built are listed as such — the app never shows a button
that does nothing.

## 1. The key decision: one parametric building model

Every view (2D editor, PDF, later 3D / 4D / electrical / plumbing) reads from and writes to the same
plain-data model in `src/model/`. Views never own geometry.

```
Project
 ├─ settings      units, snap step, display options
 ├─ plot          boundary polygon, roads, neighbours, setbacks, slope, limits
 ├─ floors[]      level, floor-to-floor height
 │   ├─ rooms[]       rectangle (x, y, w, d), type, name, lock
 │   ├─ walls[]       centre-line segment a→b, thickness, height, kind, material
 │   └─ openings[]    door / window / gate hosted on a wall (wallId + offset along wall)
 ├─ siteWalls[]   compound wall segments (ground level)
 └─ siteOpenings[] gates on compound walls
```

Conventions (documented in `src/model/types.ts`):

- All lengths are stored as **millimetres** (numbers). Display units (ft-in, in, m, cm) are applied only
  at the UI / export edge by `src/model/units.ts`. This keeps 2D, 3D and PDF dimensionally identical.
- Plan coordinates: origin at the plot's north-west reference corner, **x increases to the east,
  y increases to the south** (same orientation as a printed plan with north at the top).
- Rooms are drawn to **wall centre-lines**. Areas shown are centre-line areas; carpet area is
  reported separately once walls exist.
- Openings are attached to a wall by id and offset, so moving a wall moves its doors and windows.
  When walls are regenerated, openings are re-hosted on the wall that now contains their position.

Later phases add fields (materials, MEP layers, construction stages) to this same model rather than
creating parallel models. The JSON format carries a `schemaVersion` and a migration hook.

## 2. Folder structure

```
src/
  model/        types, units & length parsing, geometry, factories, wall builder, areas
  validation/   rule checks (plot, setbacks, overlaps, openings, access) → Issue[]
  store/        Zustand stores: project (with undo/redo), UI state
  storage/      IndexedDB persistence (projects list, autosave)
  export/       PDF (jsPDF), PNG, JSON import/export
  templates/    blank, 1BHK, 60×58 north-facing 2BHK sample
  editor/       Konva 2D canvas and its layers / tools
  ui/           toolbar, side panels, dialogs, property editors
tests/          Vitest unit tests; e2e/ Playwright tests
docs/           this plan, user guide notes
```

## 3. Phases

### Phase 1 — Functional foundation (this delivery)
- Vite + React + TypeScript + Tailwind; GitHub Pages deployment workflow.
- Plot configuration: rectangular or irregular boundary (editable vertices), roads and neighbours per
  side, setbacks per side, elevation, slope, floor count, max height, max ground coverage, units.
- 2D editor: rooms (draw, move, resize, rotate 90°), walls (draw, move endpoints, thickness, material),
  automatic wall generation from rooms, doors / windows / gates, compound wall with gates,
  measure tool, grid + snap, zoom / pan, compass, 8-direction zone overlay, multiple floors
  (add / duplicate / delete), duplicate / lock / delete elements, undo / redo, keyboard shortcuts.
- Validation: outside plot, setback violations, overlapping rooms, walls outside plot, openings that do
  not fit their wall or overlap, rooms without a door, ground-coverage limit.
- Persistence: IndexedDB autosave, project list (open / new / delete), JSON export / import.
- Export: PDF (site plan + each floor + door/window schedule, A4/A3/A2, scale, north arrow, legend,
  revision, page numbers, "PRELIMINARY — NOT FOR CONSTRUCTION"), PNG of the current view.
- Templates: blank, 1BHK, and the 60 ft × 58 ft north-facing 2BHK sample project.
- Light / dark theme.

### Phase 2 — Vaasthu engine and 3D
- Configurable Vaasthu rule profiles (8 / 16 sectors, 3×3 and 9×9 grids), per-room checklist,
  advisory score, alternative placements, English + Tamil explanations. Vaasthu output is always
  labelled as traditional preference, kept separate from regulation / safety checks, and can never
  override them.
- Three.js / React Three Fiber model generated from the same floors / walls / openings; orbit and
  walk camera, cut-away walls, sun direction.
- Material and paint selection; roof shapes.
- Tamil UI. Note: jsPDF's built-in fonts cannot render Tamil, and Tamil needs complex text shaping;
  Tamil in PDFs needs an embedded font plus a shaping-capable approach, to be verified before promising it.

### Phase 3 — Interior and exterior design
Kitchen designer (L / U / straight / parallel, clearances), bathroom designer, furniture library,
exterior elevations, landscaping.

### Phase 4 — Engineering layers
Electrical (points, circuits, conduits, preliminary loads), plumbing (supply, hot / cold, sump,
overhead tank), drainage / sewage (gradients, chambers). Each is a separate layer in the same model.
All output labelled preliminary; final design must be done by qualified professionals.

### Phase 5 — Advanced
AI assistant (proposes changes as a diff to the model, preview, confirm — never silent overwrite; needs a
backend so no API key is shipped in the browser), 4D construction timeline, walkthrough / timeline video
recording, preliminary cost estimator with editable rates, DXF / GLB / IFC export, optional cloud sync,
PWA offline support.

## 4. Hosting

Phases 1–4 run entirely in the browser and deploy to GitHub Pages. A backend (e.g. Supabase or a small
serverless function) is only needed for: the AI assistant (to keep API keys secret), user accounts,
cloud sync / collaboration, and any server-side rendering.

## 5. What is deliberately not included yet

- **Local building-regulation presets.** Setbacks, coverage and height limits vary by authority and plot
  size (e.g. Tamil Nadu's rules), and I have not verified current values. The app provides editable
  custom limits only; presets should be added from the official, current rule text.
- Vaasthu rules, 3D, materials, MEP layers, costs, AI — see phases above.
