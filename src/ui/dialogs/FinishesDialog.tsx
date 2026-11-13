import { useState } from 'react';
import { FLOOR_FINISHES, PAINT_SWATCHES, ROOF_COLOURS } from '../../model/finishes';
import type { Finishes, RoofType } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Button, Dialog, Field, LengthInput, NumberInput, Select } from '../fields';

function Swatches({
  value,
  options,
  onPick,
  label,
}: {
  value: string;
  options: { name: string; color: string }[];
  onPick: (c: string) => void;
  label: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((o) => (
          <button
            key={o.color}
            title={o.name}
            aria-label={`${label}: ${o.name}`}
            aria-pressed={value.toLowerCase() === o.color.toLowerCase()}
            onClick={() => onPick(o.color)}
            className={`h-7 w-7 rounded-md border ${value.toLowerCase() === o.color.toLowerCase() ? 'border-ink ring-2 ring-ochre' : 'border-line'}`}
            style={{ background: o.color }}
          />
        ))}
        <label className="flex items-center gap-1 text-xs text-muted">
          Custom
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} aria-label={`${label}: custom colour`} className="h-7 w-9 cursor-pointer rounded border border-line bg-panel" />
        </label>
      </div>
    </div>
  );
}

export function FinishesDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const f = project.finishes;
  const roof = project.roof;
  const unit = project.settings.unit;
  const [themeName, setThemeName] = useState('');
  const setF = (patch: Partial<Finishes>) =>
    commit((d) => {
      Object.assign(d.finishes, patch);
    });

  return (
    <Dialog title="Paint, floors and roof" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-bold">Walls</h3>
          <Swatches label="Exterior walls" value={f.exteriorWall} options={PAINT_SWATCHES} onPick={(c) => setF({ exteriorWall: c })} />
          <Swatches label="Interior walls" value={f.interiorWall} options={PAINT_SWATCHES} onPick={(c) => setF({ interiorWall: c })} />
          <h3 className="pt-2 text-sm font-bold">Floors</h3>
          <Field label="Default floor finish" hint="Each room can have its own finish in its properties.">
            <Select value={f.floor} options={FLOOR_FINISHES.map((x) => ({ value: x.id, label: x.label }))} onChange={(floor) => setF({ floor })} />
          </Field>
          <p className="text-xs text-muted">
            Colours are flat on-screen approximations, not supplier matches. Check real samples before buying.
          </p>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-bold">Roof</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Roof type">
              <Select<RoofType>
                value={roof.type}
                options={[
                  { value: 'flat', label: 'Flat RCC roof' },
                  { value: 'gable', label: 'Sloped (gable) roof' },
                ]}
                onChange={(type) =>
                  commit((d) => {
                    d.roof.type = type;
                  })
                }
              />
            </Field>
            {roof.type === 'flat' ? (
              <Field label="Parapet height" hint="0 = no parapet">
                <LengthInput
                  valueMm={roof.parapetMm}
                  unit={unit}
                  onCommit={(v) =>
                    commit((d) => {
                      d.roof.parapetMm = v;
                    })
                  }
                />
              </Field>
            ) : (
              <>
                <Field label="Pitch">
                  <NumberInput
                    value={roof.pitchDeg}
                    min={5}
                    max={60}
                    suffix="°"
                    onCommit={(v) =>
                      commit((d) => {
                        d.roof.pitchDeg = v;
                      })
                    }
                  />
                </Field>
                <Field label="Ridge runs">
                  <Select<'EW' | 'NS'>
                    value={roof.ridge}
                    options={[
                      { value: 'EW', label: 'East–west' },
                      { value: 'NS', label: 'North–south' },
                    ]}
                    onChange={(ridge) =>
                      commit((d) => {
                        d.roof.ridge = ridge;
                      })
                    }
                  />
                </Field>
              </>
            )}
          </div>
          <Swatches label="Roof colour" value={f.roof} options={ROOF_COLOURS} onPick={(c) => setF({ roof: c })} />

          <h3 className="pt-2 text-sm font-bold">Saved themes</h3>
          <div className="flex gap-1.5">
            <input
              className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
              placeholder="Theme name, e.g. Cream and grey"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Theme name"
            />
            <Button
              disabled={!themeName.trim()}
              onClick={() => {
                const name = themeName.trim();
                commit((d) => {
                  d.finishes.themes = d.finishes.themes.filter((t) => t.name !== name);
                  d.finishes.themes.push({ name, exteriorWall: f.exteriorWall, interiorWall: f.interiorWall, roof: f.roof, floor: f.floor });
                });
                setThemeName('');
              }}
            >
              Save current
            </Button>
          </div>
          {f.themes.length === 0 ? (
            <p className="text-sm text-muted">No saved themes yet. Save one to compare colour schemes later.</p>
          ) : (
            <ul className="space-y-1.5">
              {f.themes.map((t) => (
                <li key={t.name} className="flex items-center gap-2">
                  <span className="flex overflow-hidden rounded border border-line">
                    {[t.exteriorWall, t.interiorWall, t.roof].map((c, i) => (
                      <span key={i} className="h-5 w-5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                  <Button onClick={() => setF({ exteriorWall: t.exteriorWall, interiorWall: t.interiorWall, roof: t.roof, floor: t.floor })}>Apply</Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      commit((d) => {
                        d.finishes.themes = d.finishes.themes.filter((x) => x.name !== t.name);
                      })
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          onClick={() => {
            setViewMode('3d');
            onClose();
          }}
        >
          See it in 3D
        </Button>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
