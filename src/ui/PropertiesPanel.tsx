import { useMemo } from 'react';
import { isPolygonRoom, lShapeOf, roomArea, roomCentre } from '../model/roomShape';
import { clearances, defaultFootprint, openLandArea } from '../model/footprint';
import { floorAreas, groundCoveragePercent, plotArea } from '../model/areas';
import { SIDE_NAMES } from '../model/factory';
import { boundingBox, rectCorners, wallDir, wallLength, zoneOf, ZONE_LABELS } from '../model/geometry';
import { formatArea, formatLength } from '../model/units';
import { ROOM_TYPE_LABELS, WALL_MATERIAL_LABELS } from '../model/types';
import type { Item, Opening, Project, Room, RoomType, Side, Wall, WallKind, WallMaterial } from '../model/types';
import { catalogEntry } from '../model/catalog';
import { activeFloor, useProjectStore } from '../store/projectStore';
import { validateProject, type Issue } from '../validation/validate';
import { Button, Check, Field, LengthInput, Section, Select, TextInput } from './fields';
import { useUiStore } from '../store/uiStore';
import { evaluate } from '../vaasthu/engine';
import { ZONE_NAMES } from '../vaasthu/rules';
import { VaasthuPanel } from './VaasthuPanel';
import { FLOOR_FINISHES, floorFinish } from '../model/finishes';
import { Icon } from './icons';
import { useT } from '../i18n';

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const selection = useProjectStore((s) => s.selection);
  const floor = activeFloor({ project, activeFloorId });

  let body: React.ReactNode = null;
  if (selection?.kind === 'footprint' && project.footprint) {
    body = <FootprintProps project={project} />;
  } else if (selection?.kind === 'room') {
    const r = floor.rooms.find((x) => x.id === selection.id);
    if (r) body = <RoomProps room={r} project={project} />;
  } else if (selection?.kind === 'wall' || selection?.kind === 'siteWall') {
    const site = selection.kind === 'siteWall';
    const w = (site ? project.siteWalls : floor.walls).find((x) => x.id === selection.id);
    if (w) body = <WallProps wall={w} site={site} project={project} />;
  } else if (selection?.kind === 'opening' || selection?.kind === 'siteOpening') {
    const site = selection.kind === 'siteOpening';
    const o = (site ? project.siteOpenings : floor.openings).find((x) => x.id === selection.id);
    const w = o && (site ? project.siteWalls : floor.walls).find((x) => x.id === o.wallId);
    if (o && w) body = <OpeningProps opening={o} wall={w} site={site} project={project} />;
  } else if (selection?.kind === 'item') {
    const it = floor.items.find((x) => x.id === selection.id);
    if (it) body = <ItemProps item={it} project={project} />;
  }

  return <div className="flex h-full flex-col overflow-y-auto">{body ?? <Tabs project={project} />}</div>;
}

function Tabs({ project }: { project: Project }) {
  const tab = useUiStore((s) => s.panelTab);
  const setTab = useUiStore((s) => s.setPanelTab);
  const t = useT();
  return (
    <>
      <div className="sticky top-0 z-10 flex border-b border-line bg-panel" role="tablist">
        {(
          [
            ['overview', 'Overview & checks'],
            ['vaasthu', 'Vaasthu'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 px-3 py-2.5 text-sm ${tab === id ? 'border-b-2 border-ochre font-bold text-ink' : 'text-ink-soft'}`}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'vaasthu' ? <VaasthuPanel /> : <Overview project={project} />}
    </>
  );
}

function ElementActions({ locked, rotate }: { locked: boolean; rotate?: boolean }) {
  const s = useProjectStore();
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button onClick={s.toggleLockSelection} title={locked ? 'Unlock (L)' : 'Lock (L)'} ariaPressed={locked}>
        <Icon name="lock" size={15} /> {locked ? 'Unlock' : 'Lock'}
      </Button>
      <Button onClick={s.duplicateSelection} title="Duplicate (Ctrl+D)" disabled={s.selection?.kind?.startsWith('site')}>
        <Icon name="copy" size={15} /> Duplicate
      </Button>
      {rotate && (
        <Button onClick={s.rotateSelectedRoom} disabled={locked} title="Rotate 90° (R)">
          <Icon name="rotate" size={15} /> Rotate
        </Button>
      )}
      <Button variant="danger" onClick={s.deleteSelection} disabled={locked} title="Delete (Del)">
        <Icon name="trash" size={15} /> Delete
      </Button>
    </div>
  );
}

function BackLink() {
  const select = useProjectStore((s) => s.select);
  const t = useT();
  return (
    <button className="px-4 pt-3 text-left text-sm text-ink-soft underline-offset-2 hover:underline" onClick={() => select(null)}>
      {t('← Overview & checks')}
    </button>
  );
}

function RoomVaasthu({ room, project }: { room: Room; project: Project }) {
  const lang = useUiStore((s) => s.lang);
  const report = useMemo(() => evaluate(project), [project]);
  const item = report.items.find((i) => i.elementId === room.id);
  const inCentre = report.centreIssues.some((c) => c.elementId === room.id);
  if (!item && !inCentre) return null;
  const tone = item?.rating === 'preferred' ? 'text-[#2f855a]' : item?.rating === 'avoid' ? 'text-danger' : 'text-warn';
  return (
    <div className="rounded-md border border-line p-2 text-sm">
      {item && (
        <p>
          <span className="text-muted">Vaasthu: </span>
          <span className={`font-bold ${tone}`}>
            {{ preferred: 'preferred position', acceptable: 'acceptable position', neutral: 'no stated preference here', avoid: 'traditionally avoided here' }[item.rating]}
          </span>{' '}
          ({ZONE_NAMES[item.zone][lang]})
        </p>
      )}
      {item && item.rating !== 'preferred' && item.preferredZones.length > 0 && (
        <p className="text-xs text-ink-soft">Best: {item.preferredZones.map((z) => ZONE_NAMES[z][lang]).join(', ')}</p>
      )}
      {inCentre && <p className="text-xs text-danger">Sits on the centre of the house (Brahmasthan).</p>}
    </div>
  );
}

function RoomDesign({ room }: { room: Room }) {
  const open = useUiStore((s) => s.openDialog);
  const kind = room.type === 'kitchen' ? 'kitchen' : room.type === 'bathroom' || room.type === 'toilet' ? 'bathroom' : null;
  if (!kind) return null;
  return (
    <Button className="w-full" variant="primary" onClick={() => open(kind)}>
      {kind === 'kitchen' ? 'Design this kitchen…' : 'Design this bathroom…'}
    </Button>
  );
}

const ITEM_COLOURS = ['#7b5537', '#a37b55', '#5f4632', '#d9d4c7', '#f2f2f0', '#8a7a6a', '#4b5d4f', '#2e3a52', '#8a8d92', '#b9a48c'];

function ItemProps({ item, project }: { item: Item; project: Project }) {
  const update = useProjectStore((s) => s.updateItem);
  const unit = project.settings.unit;
  const c = catalogEntry(item.type);
  const dis = item.locked;
  const box = boundingBox(project.plot.boundary);
  const zone = zoneOf({ x: item.x, y: item.y }, box);
  const faces = (['south', 'west', 'north', 'east'] as const)[((Math.round(item.rotation / 90) % 4) + 4) % 4];
  return (
    <>
      <BackLink />
      <Section title={c.label}>
        <Field label="Label (optional)">
          <TextInput value={item.label ?? ''} disabled={dis} onCommit={(label) => update(item.id, { label: label || undefined })} ariaLabel="Item label" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <LengthInput valueMm={item.w} unit={unit} min={50} disabled={dis} onCommit={(w) => update(item.id, { w })} ariaLabel="Item width" />
          </Field>
          <Field label="Depth">
            <LengthInput valueMm={item.d} unit={unit} min={20} disabled={dis} onCommit={(d) => update(item.id, { d })} ariaLabel="Item depth" />
          </Field>
          <Field label="Height">
            <LengthInput valueMm={item.h} unit={unit} min={10} disabled={dis} onCommit={(h) => update(item.id, { h })} ariaLabel="Item height" />
          </Field>
          <Field label="Above floor">
            <LengthInput valueMm={item.elevationMm ?? 0} unit={unit} min={0} disabled={dis} onCommit={(elevationMm) => update(item.id, { elevationMm: elevationMm || undefined })} ariaLabel="Height above floor" />
          </Field>
          <Field label="From west boundary">
            <LengthInput valueMm={item.x} unit={unit} min={-1e9} disabled={dis} onCommit={(x) => update(item.id, { x })} ariaLabel="Item X" />
          </Field>
          <Field label="From north boundary">
            <LengthInput valueMm={item.y} unit={unit} min={-1e9} disabled={dis} onCommit={(y) => update(item.id, { y })} ariaLabel="Item Y" />
          </Field>
        </div>
        <Field label="Turn">
          <Select
            value={String(((Math.round(item.rotation / 90) % 4) + 4) % 4 * 90)}
            disabled={dis}
            options={[
              { value: '0', label: 'Front faces south' },
              { value: '90', label: 'Front faces west' },
              { value: '180', label: 'Front faces north' },
              { value: '270', label: 'Front faces east' },
            ]}
            onChange={(v) => update(item.id, { rotation: Number(v) })}
            ariaLabel="Item direction"
          />
        </Field>
        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-1.5">
            {ITEM_COLOURS.map((col) => (
              <button
                key={col}
                disabled={dis}
                title={col}
                aria-label={`Colour ${col}`}
                aria-pressed={(item.color ?? c.color) === col}
                onClick={() => update(item.id, { color: col })}
                className={`h-6 w-6 rounded border ${(item.color ?? c.color) === col ? 'border-ochre ring-2 ring-ochre/40' : 'border-line'}`}
                style={{ background: col }}
              />
            ))}
            <input type="color" aria-label="Custom colour" disabled={dis} value={item.color ?? c.color} onChange={(e) => update(item.id, { color: e.target.value })} className="h-6 w-8" />
          </div>
        </Field>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">Front faces</dt>
          <dd className="text-right">{faces}</dd>
          <dt className="text-muted">Position on plot</dt>
          <dd className="text-right">{ZONE_LABELS[zone]}</dd>
        </dl>
        <p className="text-xs text-muted">Typical size from the catalogue: {formatLength(c.w, unit)} × {formatLength(c.d, unit)}. Change it to match the product you buy. R turns it, arrow keys nudge it.</p>
        <ElementActions locked={item.locked} />
      </Section>
    </>
  );
}

function RoomProps({ room, project }: { room: Room; project: Project }) {
  const update = useProjectStore((s) => s.updateRoom);
  const unit = project.settings.unit;
  const box = boundingBox(project.plot.boundary);
  const zone = zoneOf(roomCentre(room), box);
  const dis = room.locked;
  const typeOptions = (Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((t) => ({ value: t, label: ROOM_TYPE_LABELS[t] }));
  return (
    <>
      <BackLink />
      <Section title="Room">
        <Field label="Name">
          <TextInput value={room.name} disabled={dis} onCommit={(name) => update(room.id, { name })} ariaLabel="Room name" />
        </Field>
        <Field label="Type">
          <Select value={room.type} options={typeOptions} disabled={dis} onChange={(type) => update(room.id, { type })} ariaLabel="Room type" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (east–west)">
            <LengthInput valueMm={room.w} unit={unit} min={300} disabled={dis} onCommit={(w) => update(room.id, { w })} ariaLabel="Width" />
          </Field>
          <Field label="Depth (north–south)">
            <LengthInput valueMm={room.d} unit={unit} min={300} disabled={dis} onCommit={(d) => update(room.id, { d })} ariaLabel="Depth" />
          </Field>
          <Field label="From west boundary">
            <LengthInput valueMm={room.x} unit={unit} disabled={dis} min={-1e9} onCommit={(x) => update(room.id, { x })} ariaLabel="X position" />
          </Field>
          <Field label="From north boundary">
            <LengthInput valueMm={room.y} unit={unit} disabled={dis} min={-1e9} onCommit={(y) => update(room.id, { y })} ariaLabel="Y position" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isPolygonRoom(room) ? (
            <Button disabled={dis} onClick={() => update(room.id, { points: undefined })} title="Make it a rectangle again">
              Make rectangle
            </Button>
          ) : (
            <>
              <Button disabled={dis} onClick={() => update(room.id, { points: lShapeOf(room) })} title="Make an L-shaped room">
                Make L-shape
              </Button>
              <Button disabled={dis} onClick={() => update(room.id, { points: rectCorners(room) })} title="Edit the corners freely">
                Edit corners
              </Button>
            </>
          )}
        </div>
        {isPolygonRoom(room) && (
          <p className="text-xs text-muted">Drag the orange corners; click + on an edge to add a corner; double-click a corner to remove it.</p>
        )}
        {room.type === 'staircase' && (
          <Field label="Walking up towards">
            <Select<Side>
              value={room.stairUp ?? 'N'}
              disabled={dis}
              options={(['N', 'E', 'S', 'W'] as Side[]).map((s) => ({ value: s, label: SIDE_NAMES[s] }))}
              onChange={(stairUp) => update(room.id, { stairUp })}
            />
          </Field>
        )}
        {!['garden', 'pathway', 'parking', 'sump', 'septic_tank', 'borewell', 'overhead_tank', 'staircase'].includes(room.type) && (
          <Field label="Floor finish">
            <Select
              value={room.floorFinish ?? ''}
              disabled={dis}
              options={[
                { value: '', label: `Project default (${floorFinish(project.finishes.floor).label})` },
                ...FLOOR_FINISHES.map((f) => ({ value: f.id, label: f.label })),
              ]}
              onChange={(v) => update(room.id, { floorFinish: v || undefined })}
              ariaLabel="Floor finish"
            />
          </Field>
        )}
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">Area (to centre-lines)</dt>
          <dd className="text-right">{formatArea(roomArea(room), unit)}</dd>
          <dt className="text-muted">Position on plot</dt>
          <dd className="text-right">{ZONE_LABELS[zone]}</dd>
        </dl>
        <RoomVaasthu room={room} project={project} />
        <RoomDesign room={room} />
        <ElementActions locked={room.locked} rotate />
      </Section>
    </>
  );
}

function WallProps({ wall, site, project }: { wall: Wall; site: boolean; project: Project }) {
  const update = useProjectStore((s) => s.updateWall);
  const unit = project.settings.unit;
  const len = wallLength(wall);
  const dis = wall.locked;
  const setLength = (mm: number) => {
    const d = wallDir(wall);
    update(wall.id, { b: { x: wall.a.x + d.x * mm, y: wall.a.y + d.y * mm } }, site);
  };
  return (
    <>
      <BackLink />
      <Section title={site ? 'Compound wall' : 'Wall'}>
        <Field label="Length" hint="Changing the length moves the wall’s end point.">
          <LengthInput valueMm={len} unit={unit} min={50} disabled={dis} onCommit={setLength} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Thickness">
            <LengthInput valueMm={wall.thicknessMm} unit={unit === 'ft' ? 'in' : unit} min={50} disabled={dis} onCommit={(thicknessMm) => update(wall.id, { thicknessMm }, site)} />
          </Field>
          <Field label="Height">
            <LengthInput valueMm={wall.heightMm} unit={unit} min={100} disabled={dis} onCommit={(heightMm) => update(wall.id, { heightMm }, site)} />
          </Field>
        </div>
        {!site && (
          <Field label="Kind">
            <Select<WallKind>
              value={wall.kind}
              disabled={dis}
              options={[
                { value: 'exterior', label: 'Exterior' },
                { value: 'interior', label: 'Interior partition' },
              ]}
              onChange={(kind) => update(wall.id, { kind }, site)}
            />
          </Field>
        )}
        <Field label="Material">
          <Select<WallMaterial>
            value={wall.material}
            disabled={dis}
            options={(Object.keys(WALL_MATERIAL_LABELS) as WallMaterial[]).map((m) => ({ value: m, label: WALL_MATERIAL_LABELS[m] }))}
            onChange={(material) => update(wall.id, { material }, site)}
          />
        </Field>
        <p className="text-xs text-muted">Drag the wall to move it, or drag its end points.</p>
        <ElementActions locked={wall.locked} />
      </Section>
    </>
  );
}

const SIDE_ORDER: Side[] = ['N', 'E', 'S', 'W'];

function FootprintProps({ project }: { project: Project }) {
  const s = useProjectStore();
  const f = project.footprint!;
  const unit = project.settings.unit;
  const dis = f.locked;
  const gaps = clearances(f, project.plot.boundary);
  const gap = (side: Side) => gaps.find((g) => g.side === side);
  /** Move the house so the gap on `side` becomes `target`. */
  const setGap = (side: Side, target: number) => {
    const cur = gap(side);
    if (!cur) return;
    const delta = target - cur.mm;
    const move = { N: [0, delta], S: [0, -delta], E: [-delta, 0], W: [delta, 0] }[side];
    s.moveHouse(move[0], move[1]);
  };
  const centre = (axis: 'x' | 'y') => {
    if (axis === 'x') {
      const e = gap('E');
      const w = gap('W');
      if (e && w) s.moveHouse((e.mm - w.mm) / 2, 0);
    } else {
      const n = gap('N');
      const so = gap('S');
      if (n && so) s.moveHouse(0, (so.mm - n.mm) / 2);
    }
  };
  const plotMm2 = plotArea(project);
  return (
    <>
      <BackLink />
      <Section title="House on the plot">
        <p className="text-xs text-muted">
          The house outline is the building’s overall size. Drag it on the plan (or its orange label) to try
          different positions; the rooms and walls inside it move with it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="House width (east–west)">
            <LengthInput valueMm={f.w} unit={unit} min={1000} disabled={dis} onCommit={(w) => s.updateFootprint({ w })} ariaLabel="House width" />
          </Field>
          <Field label="House depth (north–south)">
            <LengthInput valueMm={f.d} unit={unit} min={1000} disabled={dis} onCommit={(d) => s.updateFootprint({ d })} ariaLabel="House depth" />
          </Field>
        </div>
        <Button disabled={dis} onClick={() => s.updateFootprint({ w: f.d, d: f.w })} title="Swap width and depth">
          <Icon name="rotate" size={15} /> Swap width and depth
        </Button>
        <p className="text-xs text-muted">Changing the size keeps the north-west corner in place and does not move any rooms.</p>
      </Section>
      <Section title="Open space around the house">
        <div className="grid grid-cols-2 gap-2">
          {SIDE_ORDER.map((side) => {
            const g = gap(side);
            return (
              <Field key={side} label={`${SIDE_NAMES[side]} side`}>
                {g ? (
                  <LengthInput valueMm={g.mm} unit={unit} disabled={dis} onCommit={(v) => setGap(side, v)} ariaLabel={`${SIDE_NAMES[side]} gap`} />
                ) : (
                  <p className="py-1.5 text-sm text-danger">Outside the plot</p>
                )}
              </Field>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Type a gap to move the house to it.
          {project.plot.boundary.length !== 4 && ' On an irregular plot each gap is measured from the middle of that side of the house.'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button disabled={dis} onClick={() => centre('x')}>
            Centre east–west
          </Button>
          <Button disabled={dis} onClick={() => centre('y')}>
            Centre north–south
          </Button>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted">House area</dt>
          <dd className="font-bold">{formatArea(f.w * f.d, unit)}</dd>
          <dt className="text-muted">Share of the plot</dt>
          <dd>{plotMm2 > 0 ? ((f.w * f.d * 100) / plotMm2).toFixed(1) : '0'}%</dd>
          <dt className="text-muted">Open land left</dt>
          <dd>{formatArea(openLandArea(project), unit)}</dd>
        </dl>
      </Section>
      <Section title="Outline">
        <div className="flex flex-wrap gap-1.5">
          <Button disabled={dis} onClick={() => s.updateFootprint({ ...defaultFootprint({ ...project, footprint: null }), locked: false })} title="Fit the outline around the existing rooms">
            Fit outline to rooms
          </Button>
          <Button onClick={s.toggleLockSelection} ariaPressed={f.locked} title={f.locked ? 'Unlock (L)' : 'Lock (L)'}>
            <Icon name="lock" size={15} /> {f.locked ? 'Unlock' : 'Lock'}
          </Button>
          <Button variant="danger" disabled={dis} onClick={s.deleteSelection} title="Remove outline">
            <Icon name="trash" size={15} /> Remove outline
          </Button>
        </div>
        <p className="text-xs text-muted">Removing the outline keeps all rooms and walls.</p>
      </Section>
    </>
  );
}

function UnderlaySection({ project }: { project: Project }) {
  const s = useProjectStore();
  const openDialog = useUiStore((x) => x.openDialog);
  const floor = activeFloor(s);
  const u = project.underlays.find((x) => x.floorId === floor.id);
  if (!u) return null;
  return (
    <Section title="Plan drawing">
      <img src={u.dataUrl} alt={`${u.name} drawing`} className="max-h-32 border border-line bg-white" />
      <p className="text-sm text-ink-soft">
        {u.name}, {formatLength(u.w, project.settings.unit)} × {formatLength(u.d, project.settings.unit)} on {floor.name}
      </p>
      <label className="block text-xs text-muted">
        Visibility on the plan
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.05}
          value={u.opacity}
          className="mt-1 w-full accent-[var(--ochre)]"
          onChange={(e) => s.updateUnderlay(u.id, { opacity: Number(e.target.value) })}
          aria-label="Drawing visibility"
        />
      </label>
      <Check checked={u.showIn3d} onChange={(on) => s.updateUnderlay(u.id, { showIn3d: on })} label="Show in 3D view" />
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={() => openDialog('importPlan')}>Replace drawing</Button>
        <Button variant="danger" onClick={() => s.removeUnderlay(u.id)}>
          <Icon name="trash" size={15} /> Remove drawing
        </Button>
      </div>
      <p className="text-xs text-muted">Moving the house outline moves the drawing with it. Draw rooms over it to get Vaasthu ratings and areas.</p>
    </Section>
  );
}

function HouseSummary({ project }: { project: Project }) {
  const s = useProjectStore();
  const f = project.footprint;
  const unit = project.settings.unit;
  if (!f) {
    return (
      <Section title="House on the plot">
        <p className="text-sm text-ink-soft">
          Set the house’s overall size (for example 29′ × 41′) and move it around the plot to see how much open
          land is left on each side.
        </p>
        <Button variant="primary" onClick={s.addFootprint}>
          Add house outline
        </Button>
      </Section>
    );
  }
  const gaps = clearances(f, project.plot.boundary);
  return (
    <Section
      title="House on the plot"
      action={
        <button className="text-sm text-ink-soft underline-offset-2 hover:underline" onClick={() => s.select({ kind: 'footprint', id: 'footprint' })}>
          Edit
        </button>
      }
    >
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
        <dt className="text-muted">House size</dt>
        <dd className="font-bold">
          {formatLength(f.w, unit)} × {formatLength(f.d, unit)}
        </dd>
        <dt className="text-muted">House area</dt>
        <dd>{formatArea(f.w * f.d, unit)}</dd>
        <dt className="text-muted">Open land left</dt>
        <dd>{formatArea(openLandArea(project), unit)}</dd>
        {SIDE_ORDER.map((side) => {
          const g = gaps.find((x) => x.side === side);
          return [
            <dt key={`${side}k`} className="text-muted">
              Gap to {SIDE_NAMES[side].toLowerCase()} boundary
            </dt>,
            <dd key={`${side}v`} className={g ? '' : 'text-danger'}>
              {g ? formatLength(g.mm, unit) : 'outside'}
            </dd>,
          ];
        })}
      </dl>
    </Section>
  );
}

function OpeningProps({ opening, wall, site, project }: { opening: Opening; wall: Wall; site: boolean; project: Project }) {
  const s2 = useProjectStore();
  const update = useProjectStore((s) => s.updateOpening);
  const unit = project.settings.unit;
  const dis = opening.locked;
  const u = (patch: Partial<Opening>) => update(opening.id, patch, site);
  const len = wallLength(wall);
  const title = opening.type === 'door' ? 'Door' : opening.type === 'window' ? 'Window' : 'Gate';
  return (
    <>
      <BackLink />
      <Section title={title}>
        <Field label="Label">
          <TextInput value={opening.label} disabled={dis} onCommit={(label) => u({ label })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width">
            <LengthInput valueMm={opening.widthMm} unit={unit} min={200} disabled={dis} onCommit={(widthMm) => u({ widthMm })} />
          </Field>
          <Field label="Height">
            <LengthInput valueMm={opening.heightMm} unit={unit} min={200} disabled={dis} onCommit={(heightMm) => u({ heightMm })} />
          </Field>
          {opening.type === 'window' && (
            <Field label="Sill height">
              <LengthInput valueMm={opening.sillMm} unit={unit} disabled={dis} onCommit={(sillMm) => u({ sillMm })} />
            </Field>
          )}
          <Field label="Centre from wall start">
            <LengthInput valueMm={opening.offsetMm} unit={unit} disabled={dis} onCommit={(offsetMm) => u({ offsetMm: Math.min(offsetMm, len) })} />
          </Field>
        </div>
        {opening.type === 'door' && !site && (
          <Check
            checked={!!opening.isMain}
            label="Main entrance (used by the Vaasthu checks)"
            onChange={(on) =>
              s2.commit((d) => {
                for (const f of d.floors) for (const o of f.openings) o.isMain = on && o.id === opening.id ? true : undefined;
              })
            }
          />
        )}
        {opening.type === 'door' && (
          <div className="flex flex-wrap gap-1.5">
            <Button disabled={dis} onClick={() => u({ hinge: opening.hinge === 'start' ? 'end' : 'start' })}>
              Flip hinge side
            </Button>
            <Button disabled={dis} onClick={() => u({ swing: opening.swing === 'left' ? 'right' : 'left' })}>
              Flip opening side
            </Button>
          </div>
        )}
        <p className="text-xs text-muted">
          Wall length {formatLength(len, unit)}. Drag the {title.toLowerCase()} along its wall to move it.
        </p>
        <ElementActions locked={opening.locked} />
      </Section>
    </>
  );
}

const SEVERITY_STYLE: Record<Issue['severity'], string> = {
  error: 'text-danger',
  warning: 'text-warn',
  info: 'text-ink-soft',
};

function Overview({ project }: { project: Project }) {
  const s = useProjectStore();
  const unit = project.settings.unit;
  const floor = activeFloor(s);
  const areas = floorAreas(floor);
  const issues = useMemo(() => validateProject(project), [project]);
  const box = boundingBox(project.plot.boundary);
  const coverage = groundCoveragePercent(project);
  const goTo = (i: Issue) => {
    if (i.floorId) s.setActiveFloor(i.floorId);
    const id = i.elementIds[0];
    if (!id) return;
    if (id === 'footprint') return s.select({ kind: 'footprint', id });
    const f = project.floors.find((x) => x.id === (i.floorId ?? floor.id));
    if (!f) return;
    if (f.rooms.some((r) => r.id === id)) s.select({ kind: 'room', id });
    else if (f.walls.some((w) => w.id === id)) s.select({ kind: 'wall', id });
    else if (f.openings.some((o) => o.id === id)) s.select({ kind: 'opening', id });
    else if (project.siteOpenings.some((o) => o.id === id)) s.select({ kind: 'siteOpening', id });
  };
  const sortedRooms = [...floor.rooms].sort((a, b) => a.name.localeCompare(b.name));
  const counts = { error: issues.filter((i) => i.severity === 'error').length, warning: issues.filter((i) => i.severity === 'warning').length };

  return (
    <>
      <Section title="Project">
        <Field label="Name">
          <TextInput
            value={project.name}
            onCommit={(name) =>
              s.commit((d) => {
                d.name = name;
              })
            }
            ariaLabel="Project name"
          />
        </Field>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted">Plot</dt>
          <dd>
            {formatLength(box.w, unit)} × {formatLength(box.d, unit)}
            {project.plot.boundary.length !== 4 && ' (irregular)'}
          </dd>
          <dt className="text-muted">Plot area</dt>
          <dd>{formatArea(plotArea(project), unit)}</dd>
          <dt className="text-muted">Ground coverage</dt>
          <dd>{coverage.toFixed(1)}%</dd>
        </dl>
      </Section>

      <HouseSummary project={project} />

      <UnderlaySection project={project} />

      <Section title={`${floor.name} — areas`}>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-muted">Enclosed rooms</dt>
          <dd className="font-bold">{formatArea(areas.enclosedMm2, unit)}</dd>
          <dt className="text-muted">Portico & stairs</dt>
          <dd>{formatArea(areas.porticoStairMm2, unit)}</dd>
          <dt className="text-muted">Open areas</dt>
          <dd>{formatArea(areas.outdoorMm2, unit)}</dd>
        </dl>
        <p className="text-xs text-muted">Measured to wall centre-lines. Not a certified built-up area.</p>
      </Section>

      <Section title={`Checks (${plural(counts.error, 'error')}, ${plural(counts.warning, 'warning')})`}>
        {issues.length === 0 ? (
          <p className="text-sm text-ink-soft">No problems found by the plan checks.</p>
        ) : (
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.id}>
                <button className="w-full text-left text-sm hover:underline" onClick={() => goTo(i)}>
                  <span className={`font-bold ${SEVERITY_STYLE[i.severity]}`}>{i.severity === 'error' ? 'Error' : i.severity === 'warning' ? 'Warning' : 'Note'}:</span>{' '}
                  <span className="text-ink">{i.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          These are geometry and limit checks against the values in Plot settings — not a building-approval check.
        </p>
      </Section>

      <Section title={`Rooms on ${floor.name} (${floor.rooms.length})`}>
        {sortedRooms.length === 0 ? (
          <p className="text-sm text-ink-soft">No rooms yet. Pick a room type on the left and drag on the plan.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-1 font-normal">Room</th>
                <th className="pb-1 font-normal">Size</th>
                <th className="pb-1 text-right font-normal">Zone</th>
              </tr>
            </thead>
            <tbody>
              {sortedRooms.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-ochre-soft" onClick={() => s.select({ kind: 'room', id: r.id })}>
                  <td className="py-0.5 pr-2">{r.name}</td>
                  <td className="py-0.5 pr-2 whitespace-nowrap text-ink-soft">
                    {formatLength(r.w, unit)} × {formatLength(r.d, unit)}
                  </td>
                  <td className="py-0.5 text-right text-ink-soft">{zoneOf(roomCentre(r), box)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Floor">
        <FloorProps />
      </Section>
    </>
  );
}

function FloorProps() {
  const s = useProjectStore();
  const floor = activeFloor(s);
  const unit = s.project.settings.unit;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name">
          <TextInput value={floor.name} onCommit={(name) => s.renameFloor(floor.id, name)} />
        </Field>
        <Field label="Floor-to-floor height">
          <LengthInput valueMm={floor.heightMm} unit={unit} min={2000} onCommit={(heightMm) => s.updateFloor(floor.id, { heightMm })} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button onClick={() => s.duplicateFloor(floor.id)}>
          <Icon name="copy" size={15} /> Duplicate floor
        </Button>
        <Button
          variant="danger"
          disabled={s.project.floors.length <= 1}
          onClick={() => {
            if (confirm(`Delete “${floor.name}” and everything on it? You can undo this.`)) s.deleteFloor(floor.id);
          }}
        >
          <Icon name="trash" size={15} /> Delete floor
        </Button>
      </div>
    </>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
