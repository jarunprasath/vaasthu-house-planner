import { useMemo, useState } from 'react';
import { catalogEntry } from '../../model/catalog';
import type { Item, Room } from '../../model/types';
import { activeFloor, useProjectStore } from '../../store/projectStore';
import { isPolygonRoom } from '../../model/roomShape';
import { itemsInRoom, type DesignNote } from '../../design/common';
import {
  CABINET_COLORS,
  COUNTER_COLORS,
  DEFAULT_KITCHEN,
  generateKitchen,
  isKitchenItem,
  KITCHEN_LAYOUTS,
  kitchenChecks,
  type KitchenLayout,
  type KitchenOptions,
} from '../../design/kitchen';
import { bathroomChecks, DEFAULT_BATHROOM, generateBathroom, isBathroomItem, type BathroomOptions } from '../../design/bathroom';
import { Button, Check, Dialog, Field, Select } from '../fields';

export function NoteList({ notes }: { notes: DesignNote[] }) {
  if (!notes.length) return null;
  const tone = { ok: 'text-[#2f855a]', warning: 'text-danger', info: 'text-ink-soft' } as const;
  const mark = { ok: '✓', warning: '!', info: 'i' } as const;
  return (
    <ul className="space-y-1.5 text-sm" aria-label="Design checks">
      {notes.map((n, i) => (
        <li key={i} className="flex gap-2">
          <span className={`w-4 shrink-0 text-center font-bold ${tone[n.level]}`} aria-hidden>
            {mark[n.level]}
          </span>
          <span className={n.level === 'warning' ? 'text-ink' : 'text-ink-soft'}>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

function useSelectedRoom(): Room | undefined {
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const selection = useProjectStore((s) => s.selection);
  const floor = activeFloor({ project, activeFloorId });
  return selection?.kind === 'room' ? floor.rooms.find((r) => r.id === selection.id) : undefined;
}

/** Replace the room's kitchen or bathroom items with a new set (one undo step). */
function useReplace() {
  const commit = useProjectStore((s) => s.commit);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  return (room: Room, items: Item[], isOwn: (it: Item) => boolean) =>
    commit((d) => {
      const f = d.floors.find((x) => x.id === activeFloorId);
      if (!f) return;
      const inRoom = (it: Item) => it.x > room.x && it.x < room.x + room.w && it.y > room.y && it.y < room.y + room.d;
      f.items = f.items.filter((it) => !(inRoom(it) && isOwn(it))).concat(items);
    });
}

function SwatchSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${value === o.value ? 'border-ochre text-ink' : 'border-line text-ink-soft'}`}
          >
            <span className="inline-block h-3.5 w-3.5 rounded-sm border border-black/15" style={{ background: o.value }} />
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function KitchenDialog({ onClose }: { onClose: () => void }) {
  const room = useSelectedRoom();
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const floor = activeFloor({ project, activeFloorId });
  const [opt, setOpt] = useState<KitchenOptions>(DEFAULT_KITCHEN);
  const replace = useReplace();
  const existing = room ? itemsInRoom(floor, room).filter(isKitchenItem) : [];
  const notes = useMemo(() => (room && existing.length ? kitchenChecks(floor, room) : []), [floor, room, existing.length]);
  const [genNotes, setGenNotes] = useState<DesignNote[] | null>(null);
  if (!room) return null;
  const set = (p: Partial<KitchenOptions>) => setOpt((o) => ({ ...o, ...p }));
  const shown = genNotes ?? notes;
  return (
    <Dialog title={`Design the kitchen — ${room.name}`} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Layout">
            <Select<KitchenLayout> value={opt.layout} options={KITCHEN_LAYOUTS.map((l) => ({ value: l.id, label: l.label }))} onChange={(layout) => set({ layout })} ariaLabel="Kitchen layout" />
          </Field>
          <Check checked={opt.fridge} onChange={(fridge) => set({ fridge })} label="Refrigerator" />
          <Check checked={opt.chimney} onChange={(chimney) => set({ chimney })} label="Chimney over the hob" />
          <Check checked={opt.wallCabinets} onChange={(wallCabinets) => set({ wallCabinets })} label="Wall cabinets" />
          <Check checked={opt.dishwasher} onChange={(dishwasher) => set({ dishwasher })} label="Dishwasher" />
          <SwatchSelect label="Cabinet colour" value={opt.cabinetColor} options={CABINET_COLORS} onChange={(cabinetColor) => set({ cabinetColor })} />
          <SwatchSelect label="Counter top" value={opt.counterColor} options={COUNTER_COLORS} onChange={(counterColor) => set({ counterColor })} />
          {isPolygonRoom(room) && <p className="text-xs text-warn">This room is not a rectangle; the layout uses its overall outline, so check the result.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              onClick={() => {
                const r = generateKitchen(floor, room, opt);
                replace(room, r.items, isKitchenItem);
                setGenNotes(r.notes);
              }}
            >
              {existing.length ? 'Replace kitchen layout' : 'Create kitchen layout'}
            </Button>
            {existing.length > 0 && (
              <Button
                variant="danger"
                onClick={() => {
                  replace(room, [], isKitchenItem);
                  setGenNotes([]);
                }}
              >
                Remove kitchen units
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            Uses standard 600 mm deep counters and 600 mm modules. Every unit stays editable afterwards: drag it, turn it with R, or change its size. Sizes are typical — confirm them with your kitchen maker.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Checks</h3>
          {shown.length ? <NoteList notes={shown} /> : <p className="text-sm text-muted">Create a layout to see the work triangle, walkway, ventilation and Vaasthu checks.</p>}
          {existing.length > 0 && (
            <p className="text-xs text-muted">
              In this kitchen: {Object.entries(existing.reduce<Record<string, number>>((m, i) => ((m[catalogEntry(i.type).label] = (m[catalogEntry(i.type).label] ?? 0) + 1), m), {}))
                .map(([k, v]) => `${v} × ${k.toLowerCase()}`)
                .join(', ')}
              .
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}

export function BathroomDialog({ onClose }: { onClose: () => void }) {
  const room = useSelectedRoom();
  const project = useProjectStore((s) => s.project);
  const activeFloorId = useProjectStore((s) => s.activeFloorId);
  const floor = activeFloor({ project, activeFloorId });
  const [opt, setOpt] = useState<BathroomOptions>(DEFAULT_BATHROOM);
  const replace = useReplace();
  const existing = room ? itemsInRoom(floor, room).filter(isBathroomItem) : [];
  const notes = useMemo(() => (room && existing.length ? bathroomChecks(floor, room) : []), [floor, room, existing.length]);
  const [genNotes, setGenNotes] = useState<DesignNote[] | null>(null);
  if (!room) return null;
  const set = (p: Partial<BathroomOptions>) => setOpt((o) => ({ ...o, ...p }));
  const shown = genNotes ?? notes;
  return (
    <Dialog title={`Design the bathroom — ${room.name}`} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Toilet">
            <Select<BathroomOptions['wc']>
              value={opt.wc}
              options={[
                { value: 'western', label: 'Western (EWC)' },
                { value: 'indian', label: 'Indian (IWC)' },
                { value: 'none', label: 'No toilet' },
              ]}
              onChange={(wc) => set({ wc })}
              ariaLabel="Toilet type"
            />
          </Field>
          <Field label="Bathing">
            <Select<BathroomOptions['bathing']>
              value={opt.bathing}
              options={[
                { value: 'shower', label: 'Shower area' },
                { value: 'tub', label: 'Bathtub' },
                { value: 'none', label: 'None' },
              ]}
              onChange={(bathing) => set({ bathing })}
              ariaLabel="Bathing"
            />
          </Field>
          <Check checked={opt.basin} onChange={(basin) => set({ basin })} label="Washbasin with mirror" />
          <Check checked={opt.geyser} onChange={(geyser) => set({ geyser })} label="Geyser (water heater)" />
          <Check checked={opt.exhaust} onChange={(exhaust) => set({ exhaust })} label="Exhaust fan" />
          <Check checked={opt.vaasthuWc} onChange={(vaasthuWc) => set({ vaasthuWc })} label="Vaasthu: toilet user faces north or south" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="primary"
              onClick={() => {
                const r = generateBathroom(floor, room, opt);
                replace(room, r.items, isBathroomItem);
                setGenNotes(r.notes);
              }}
            >
              {existing.length ? 'Replace bathroom layout' : 'Create bathroom layout'}
            </Button>
            {existing.length > 0 && (
              <Button
                variant="danger"
                onClick={() => {
                  replace(room, [], isBathroomItem);
                  setGenNotes([]);
                }}
              >
                Remove fittings
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            The wet area goes in the corner farthest from the door, with a floor drain. Clearances follow common planning guidance (about 380 mm from a toilet’s centre to a side wall, about 530 mm clear in front) — approximate, not a regulation.
          </p>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Checks</h3>
          {shown.length ? <NoteList notes={shown} /> : <p className="text-sm text-muted">Create a layout to see clearance, ventilation, waterproofing and Vaasthu checks.</p>}
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}
