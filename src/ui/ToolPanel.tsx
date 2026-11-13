import { useState } from 'react';
import { CATALOG, ITEM_GROUPS, type ItemGroup } from '../model/catalog';
import { ROOM_COLORS, ROOM_TYPE_LABELS, type RoomType } from '../model/types';
import { useProjectStore } from '../store/projectStore';
import { useUiStore, type Tool } from '../store/uiStore';
import { Button, Check, Section } from './fields';
import { Icon } from './icons';
import { useT } from '../i18n';

function HouseButton() {
  const has = useProjectStore((s) => !!s.project.footprint);
  const addFootprint = useProjectStore((s) => s.addFootprint);
  const select = useProjectStore((s) => s.select);
  const setTool = useUiStore((s) => s.setTool);
  return (
    <>
      <Button
        className="w-full"
        variant={has ? 'default' : 'primary'}
        onClick={() => {
          setTool('select');
          if (has) select({ kind: 'footprint', id: 'footprint' });
          else addFootprint();
        }}
        title={has ? 'Edit house size and position' : 'Add house outline'}
      >
        <Icon name="room" size={16} /> {has ? 'Edit house size & position' : 'Add house outline'}
      </Button>
      <p className="text-xs text-muted">
        {has ? 'Drag the orange outline to move the house; arrow keys nudge it.' : 'Set the overall house size, then move it around the plot.'}
      </p>
    </>
  );
}

function FurnitureSection() {
  const ui = useUiStore();
  const t = useT();
  const [group, setGroup] = useState<ItemGroup>('Living');
  return (
    <Section title="Furniture & fittings">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Furniture groups">
        {ITEM_GROUPS.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={`rounded px-2 py-0.5 text-xs ${group === g ? 'bg-ochre-soft font-bold text-ink' : 'text-ink-soft hover:text-ink'}`}
          >
            {t(g)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {CATALOG.filter((c) => c.group === group).map((c) => {
          const active = ui.tool === 'item' && ui.itemType === c.id;
          return (
            <button
              key={c.id}
              aria-pressed={active}
              onClick={() => {
                ui.setItemType(c.id);
                ui.setTool('item');
              }}
              title={`${c.label} — ${Math.round(c.w)} × ${Math.round(c.d)} mm`}
              className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-left text-xs leading-tight ${active ? 'border-ochre text-ink' : 'border-line text-ink-soft hover:border-ink-soft'}`}
            >
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10" style={{ background: c.color }} />
              {c.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">Pick an item, then click on the plan. Kitchens and bathrooms can be laid out for you: select the room and choose “Design this…”.</p>
    </Section>
  );
}

export const TOOLS: { id: Tool; label: string; key: string; icon: string }[] = [
  { id: 'select', label: 'Select & move', key: 'V', icon: 'select' },
  { id: 'pan', label: 'Pan', key: 'H', icon: 'pan' },
  { id: 'room', label: 'Draw room', key: 'B', icon: 'room' },
  { id: 'wall', label: 'Draw wall', key: 'W', icon: 'wall' },
  { id: 'door', label: 'Door', key: 'D', icon: 'door' },
  { id: 'window', label: 'Window', key: 'N', icon: 'window' },
  { id: 'gate', label: 'Gate', key: 'G', icon: 'gate' },
  { id: 'measure', label: 'Measure', key: 'M', icon: 'measure' },
  { id: 'plot', label: 'Edit plot shape', key: 'P', icon: 'plot' },
];

const ROOM_GROUPS: { title: string; types: RoomType[] }[] = [
  { title: 'Living', types: ['living', 'dining', 'foyer', 'passage', 'study'] },
  { title: 'Bedrooms', types: ['master_bedroom', 'bedroom'] },
  { title: 'Service', types: ['kitchen', 'store', 'utility', 'bathroom', 'toilet', 'pooja'] },
  { title: 'Outside & circulation', types: ['portico', 'staircase', 'sitout', 'balcony', 'terrace', 'courtyard'] },
  { title: 'Site', types: ['parking', 'garden', 'pathway', 'other'] },
  { title: 'Water & drainage', types: ['sump', 'overhead_tank', 'septic_tank', 'borewell'] },
];

export function ToolPanel() {
  const ui = useUiStore();
  const t = useT();
  const rebuildWalls = useProjectStore((s) => s.rebuildWalls);
  const hasSiteWalls = useProjectStore((s) => s.project.siteWalls.length > 0);
  const roomCount = useProjectStore((s) => s.project.floors.find((f) => f.id === s.activeFloorId)?.rooms.length ?? 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Section title="Tools">
        <div className="grid grid-cols-3 gap-1.5" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((tl) => {
            const active = ui.tool === tl.id;
            return (
              <button
                key={tl.id}
                onClick={() => ui.setTool(tl.id)}
                aria-pressed={active}
                title={`${tl.label} (${tl.key})`}
                className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-xs leading-tight ${
                  active ? 'border-ochre bg-ochre-soft text-ink' : 'border-line bg-panel text-ink-soft hover:border-ink-soft'
                }`}
              >
                <Icon name={tl.icon} />
                <span>{t(tl.label)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="House outline">
        <HouseButton />
        <Button className="w-full" onClick={() => ui.openDialog('importPlan')} title="Import a plan drawing">
          <Icon name="export" size={16} /> Import a plan drawing
        </Button>
        <p className="text-xs text-muted">Place a picture or PDF of a house plan inside your plot.</p>
      </Section>

      <Section title="Add a room">
        <p className="text-xs text-muted">{t('Pick a type, then drag on the plan.')}</p>
        {ROOM_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-xs text-muted">{t(g.title)}</p>
            <div className="flex flex-wrap gap-1">
              {g.types.map((rt) => {
                const active = ui.tool === 'room' && ui.roomType === rt;
                return (
                  <button
                    key={rt}
                    onClick={() => {
                      ui.setRoomType(rt);
                      ui.setTool('room');
                    }}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
                      active ? 'border-ochre text-ink' : 'border-line text-ink-soft hover:border-ink-soft'
                    }`}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-sm border border-black/10" style={{ background: ROOM_COLORS[rt] }} />
                    {t(ROOM_TYPE_LABELS[rt])}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Section>

      <FurnitureSection />

      <Section title="Walls">
        <Button onClick={rebuildWalls} disabled={roomCount === 0} className="w-full" title="Rebuild walls from rooms">
          <Icon name="rebuild" size={16} /> Generate walls from rooms
        </Button>
        <p className="text-xs text-muted">
          Replaces this floor’s walls with walls along the room edges. Doors and windows stay where they are.
        </p>
        <Button onClick={() => ui.openDialog('compound')} className="w-full" title="Compound wall">
          <Icon name="compound" size={16} /> {hasSiteWalls ? 'Edit compound wall' : 'Add compound wall'}
        </Button>
      </Section>

      <Section title="Paint, floors & roof">
        <Button onClick={() => ui.openDialog('finishes')} className="w-full" title="Choose paint, floors & roof">
          Choose paint, floors & roof
        </Button>
        <Button onClick={() => ui.openDialog('elevations')} className="w-full" title="Elevations & exterior style">
          Elevations & exterior style
        </Button>
      </Section>

      <Section title="Show">
        <Check checked={ui.showGrid} onChange={() => ui.toggle('showGrid')} label="Grid" />
        <Check checked={ui.showDimensions} onChange={() => ui.toggle('showDimensions')} label="Dimensions" />
        <Check checked={ui.showSetbacks} onChange={() => ui.toggle('showSetbacks')} label="Setback line" />
        <Check checked={ui.showZones} onChange={() => ui.toggle('showZones')} label="Vaasthu grid and ratings" />
        <Check checked={ui.showSixteen} onChange={() => ui.toggle('showSixteen')} label="16 directions" />
        <Check checked={ui.showFloorBelow} onChange={() => ui.toggle('showFloorBelow')} label="Floor below (faint)" />
      </Section>
    </div>
  );
}
