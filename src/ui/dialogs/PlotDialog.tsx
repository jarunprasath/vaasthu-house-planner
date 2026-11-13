import { plotArea } from '../../model/areas';
import { rectangularBoundary, SIDE_NAMES } from '../../model/factory';
import { boundingBox } from '../../model/geometry';
import { formatArea, formatLength } from '../../model/units';
import type { Side } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Button, Check, Dialog, Field, LengthInput, NumberInput, Select } from '../fields';

const SIDES: Side[] = ['N', 'E', 'S', 'W'];

export function PlotDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const ui = useUiStore();
  const plot = project.plot;
  const unit = project.settings.unit;
  const box = boundingBox(plot.boundary);
  const isRect =
    plot.boundary.length === 4 &&
    plot.boundary.every((p) => (Math.abs(p.x - box.x) < 1 || Math.abs(p.x - box.x - box.w) < 1) && (Math.abs(p.y - box.y) < 1 || Math.abs(p.y - box.y - box.d) < 1));

  const setRect = (w: number, d: number) =>
    commit((dr) => {
      dr.plot.boundary = rectangularBoundary(w, d).map((p) => ({ x: p.x + box.x, y: p.y + box.y }));
    });

  return (
    <Dialog title="Plot settings" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-bold">Size and shape</h3>
          {isRect ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Width (east–west)">
                <LengthInput valueMm={box.w} unit={unit} min={1000} onCommit={(w) => setRect(w, box.d)} />
              </Field>
              <Field label="Depth (north–south)">
                <LengthInput valueMm={box.d} unit={unit} min={1000} onCommit={(d) => setRect(box.w, d)} />
              </Field>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-ink-soft">
                Irregular plot with {plot.boundary.length} corners. Corner positions are measured from the north-west reference point.
              </p>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {plot.boundary.map((p, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
                    <span className="text-xs text-muted">#{i + 1}</span>
                    <LengthInput
                      valueMm={p.x}
                      unit={unit}
                      min={-1e9}
                      ariaLabel={`Corner ${i + 1} east`}
                      onCommit={(x) =>
                        commit((d) => {
                          d.plot.boundary[i].x = x;
                        })
                      }
                    />
                    <LengthInput
                      valueMm={p.y}
                      unit={unit}
                      min={-1e9}
                      ariaLabel={`Corner ${i + 1} south`}
                      onCommit={(y) =>
                        commit((d) => {
                          d.plot.boundary[i].y = y;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <Button className="mt-2" onClick={() => setRect(box.w, box.d)}>
                Make it a rectangle ({formatLength(box.w, unit)} × {formatLength(box.d, unit)})
              </Button>
            </div>
          )}
          <Button
            onClick={() => {
              ui.setTool('plot');
              onClose();
            }}
          >
            Reshape on the plan…
          </Button>
          <p className="text-sm text-ink-soft">Plot area: {formatArea(plotArea(project), unit)}</p>

          <h3 className="pt-2 text-sm font-bold">Setbacks</h3>
          <div className="grid grid-cols-2 gap-2">
            {SIDES.map((s) => (
              <Field key={s} label={SIDE_NAMES[s]}>
                <LengthInput
                  valueMm={plot.setbacks[s]}
                  unit={unit}
                  onCommit={(v) =>
                    commit((d) => {
                      d.plot.setbacks[s] = v;
                    })
                  }
                />
              </Field>
            ))}
          </div>
          <p className="text-xs text-muted">
            Enter the setbacks your local authority requires. Rules depend on the authority, plot size and road width, so
            this app has no built-in rule presets yet — please check the current rules for your area.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">Surroundings</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-1 font-normal">Side</th>
                <th className="pb-1 pr-3 font-normal">Road</th>
                <th className="pb-1 font-normal">Road width</th>
                <th className="pb-1 font-normal">Neighbour</th>
              </tr>
            </thead>
            <tbody>
              {SIDES.map((s) => {
                const road = plot.roads.find((r) => r.side === s);
                const neighbour = plot.neighbours.includes(s);
                return (
                  <tr key={s}>
                    <td className="py-1 pr-2">{SIDE_NAMES[s]}</td>
                    <td className="py-1 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`Road on ${SIDE_NAMES[s]}`}
                        className="h-4 w-4 accent-[var(--ochre)]"
                        checked={!!road}
                        onChange={(e) =>
                          commit((d) => {
                            if (e.target.checked) {
                              d.plot.roads.push({ side: s, widthMm: 6096 });
                              d.plot.neighbours = d.plot.neighbours.filter((n) => n !== s);
                            } else d.plot.roads = d.plot.roads.filter((r) => r.side !== s);
                          })
                        }
                      />
                    </td>
                    <td className="py-1 pr-2">
                      {road && (
                        <LengthInput
                          valueMm={road.widthMm}
                          unit={unit}
                          ariaLabel={`${SIDE_NAMES[s]} road width`}
                          onCommit={(v) =>
                            commit((d) => {
                              const r = d.plot.roads.find((x) => x.side === s);
                              if (r) r.widthMm = v;
                            })
                          }
                        />
                      )}
                    </td>
                    <td className="py-1">
                      <input
                        type="checkbox"
                        aria-label={`Neighbour on ${SIDE_NAMES[s]}`}
                        className="h-4 w-4 accent-[var(--ochre)]"
                        checked={neighbour}
                        disabled={!!road}
                        onChange={(e) =>
                          commit((d) => {
                            if (e.target.checked) d.plot.neighbours.push(s);
                            else d.plot.neighbours = d.plot.neighbours.filter((n) => n !== s);
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 className="pt-2 text-sm font-bold">Ground</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Plot level above road">
              <LengthInput
                valueMm={plot.elevationMm}
                unit={unit}
                min={-1e6}
                onCommit={(v) =>
                  commit((d) => {
                    d.plot.elevationMm = v;
                  })
                }
              />
            </Field>
            <Field label="Ground slope">
              <NumberInput
                value={plot.slopePercent}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                onCommit={(v) =>
                  commit((d) => {
                    d.plot.slopePercent = v;
                  })
                }
              />
            </Field>
            <Field label="Ground falls towards">
              <Select<Side>
                value={plot.slopeTowards}
                options={SIDES.map((s) => ({ value: s, label: SIDE_NAMES[s] }))}
                onChange={(v) =>
                  commit((d) => {
                    d.plot.slopeTowards = v;
                  })
                }
              />
            </Field>
          </div>
          <p className="text-xs text-muted">Slope and level are recorded for later drainage and 3D phases; the 2D plan does not use them yet.</p>

          <h3 className="pt-2 text-sm font-bold">Limits to check against</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Maximum floors">
              <NumberInput
                value={plot.maxFloors}
                min={0}
                max={50}
                onCommit={(v) =>
                  commit((d) => {
                    d.plot.maxFloors = Math.round(v);
                  })
                }
              />
            </Field>
            <Field label="Maximum height">
              <LengthInput
                valueMm={plot.maxHeightMm}
                unit={unit}
                onCommit={(v) =>
                  commit((d) => {
                    d.plot.maxHeightMm = v;
                  })
                }
              />
            </Field>
            <Field label="Max ground coverage" hint="0 = no limit">
              <NumberInput
                value={plot.maxCoveragePercent}
                min={0}
                max={100}
                suffix="%"
                onCommit={(v) =>
                  commit((d) => {
                    d.plot.maxCoveragePercent = v;
                  })
                }
              />
            </Field>
          </div>
          <Check
            checked={ui.showSetbacks}
            onChange={() => ui.toggle('showSetbacks')}
            label="Show the setback line on the plan"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
