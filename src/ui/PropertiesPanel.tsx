import { useMemo } from 'react';
import { floorAreas, groundCoveragePercent, plotArea } from '../model/areas';
import { SIDE_NAMES } from '../model/factory';
import { boundingBox, rectCenter, wallDir, wallLength, zoneOf, ZONE_LABELS } from '../model/geometry';
import { formatArea, formatLength } from '../model/units';
import { ROOM_TYPE_LABELS, WALL_MATERIAL_LABELS } from '../model/types';
import type { Opening, Project, Room, RoomType, Side, Wall, WallKind, WallMaterial } from '../model/types';
import { activeFloor, useProjectStore } from '../store/projectStore';
import { validateProject, type Issue } from '../validation/validate';
import { Button, Field, LengthInput, Section, Select, TextInput } from './fields';
import { Icon } from './icons';

export function PropertiesPanel() {
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const selection = useProjectStore((s) => s.selection);
  const floor = activeFloor({ project, activeFloorId });

  let body: React.ReactNode = null;
  if (selection?.kind === 'room') {
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
  }

  return <div className="flex h-full flex-col overflow-y-auto">{body ?? <Overview project={project} />}</div>;
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
  return (
    <button className="px-4 pt-3 text-left text-sm text-ink-soft underline-offset-2 hover:underline" onClick={() => select(null)}>
      ← Overview & checks
    </button>
  );
}

function RoomProps({ room, project }: { room: Room; project: Project }) {
  const update = useProjectStore((s) => s.updateRoom);
  const unit = project.settings.unit;
  const box = boundingBox(project.plot.boundary);
  const zone = zoneOf(rectCenter(room), box);
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
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">Area (to centre-lines)</dt>
          <dd className="text-right">{formatArea(room.w * room.d, unit)}</dd>
          <dt className="text-muted">Position on plot</dt>
          <dd className="text-right">{ZONE_LABELS[zone]}</dd>
        </dl>
        <p className="text-xs text-muted">
          Position is the 3×3 zone of the plot that holds the room’s centre. Vaasthu recommendations come in Phase 2.
        </p>
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

function OpeningProps({ opening, wall, site, project }: { opening: Opening; wall: Wall; site: boolean; project: Project }) {
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
                  <td className="py-0.5 text-right text-ink-soft">{zoneOf(rectCenter(r), box)}</td>
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
