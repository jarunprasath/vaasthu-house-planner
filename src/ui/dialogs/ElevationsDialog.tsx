import { useMemo, useState } from 'react';
import { computeElevation, ELEVATION_TITLES, type Elevation } from '../../model/elevation';
import { applyStyle, STYLE_PRESETS } from '../../model/styles';
import { formatLength } from '../../model/units';
import type { DisplayUnit, Side } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { Button, Check, Dialog, Field, LengthInput } from '../fields';
import { buildParts } from '../../three/buildModel';

const SIDES: Side[] = ['N', 'E', 'S', 'W'];

/** One elevation as SVG (metres, y up), with ground and level lines and overall dimensions. */
export function ElevationSvg({ elev, unit, height = 260, title }: { elev: Elevation; unit: DisplayUnit; height?: number; title?: string }) {
  const pad = 1.2;
  const right = 4.2; // room for level labels
  const w = elev.h1 - elev.h0;
  const H = elev.top;
  const vbW = w + pad + right;
  const vbH = H + pad * 2 + 0.6;
  const X = (h: number) => h - elev.h0 + pad;
  const Y = (v: number) => H - v + pad;
  const fs = Math.max(0.28, Math.min(0.45, vbH / 28));
  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height }} role="img" aria-label={title ?? ELEVATION_TITLES[elev.side]}>
      <rect x={0} y={0} width={vbW} height={vbH} fill="#f8f7f2" />
      {/* ground */}
      <rect x={0} y={Y(0)} width={vbW} height={pad + 0.6} fill="#e3dfd2" />
      {elev.shapes.map((s, i) => (
        <polygon key={i} points={s.pts.map(([h, v]) => `${X(h)},${Y(v)}`).join(' ')} fill={s.color} stroke="#2b2f3a" strokeWidth={0.02} strokeLinejoin="round" />
      ))}
      <line x1={0} x2={vbW} y1={Y(0)} y2={Y(0)} stroke="#2b2f3a" strokeWidth={0.04} />
      {/* level marks */}
      {elev.levels.map((l) => (
        <g key={l.label}>
          <line x1={X(elev.h1) + 0.2} x2={X(elev.h1) + 0.9} y1={Y(l.v)} y2={Y(l.v)} stroke="#6d7488" strokeWidth={0.02} />
          <text x={X(elev.h1) + 1.0} y={Y(l.v) + fs * 0.35} fontSize={fs} fill="#4b5577">
            {`+${formatLength(l.v * 1000, unit)} ${l.label}`}
          </text>
        </g>
      ))}
      {/* overall height */}
      <line x1={X(elev.h1) + 0.55} x2={X(elev.h1) + 0.55} y1={Y(0)} y2={Y(H)} stroke="#b8860b" strokeWidth={0.025} />
      <text x={X(elev.h1) + 1.0} y={Y(H) + fs * 0.35} fontSize={fs} fill="#8a6408" fontWeight="bold">
        {`Top +${formatLength(H * 1000, unit)}`}
      </text>
      {/* overall width */}
      <line x1={X(elev.h0)} x2={X(elev.h1)} y1={Y(0) + 0.55} y2={Y(0) + 0.55} stroke="#4b5577" strokeWidth={0.02} />
      <line x1={X(elev.h0)} x2={X(elev.h0)} y1={Y(0) + 0.35} y2={Y(0) + 0.75} stroke="#4b5577" strokeWidth={0.02} />
      <line x1={X(elev.h1)} x2={X(elev.h1)} y1={Y(0) + 0.35} y2={Y(0) + 0.75} stroke="#4b5577" strokeWidth={0.02} />
      <text x={(X(elev.h0) + X(elev.h1)) / 2} y={Y(0) + 0.5} fontSize={fs} fill="#4b5577" textAnchor="middle">
        {formatLength(w * 1000, unit)}
      </text>
    </svg>
  );
}

export function ElevationsDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const unit = project.settings.unit;
  const [side, setSide] = useState<Side | 'all'>('all');
  const elevs = useMemo(() => {
    const parts = buildParts(project);
    return SIDES.map((s) => computeElevation(project, s, parts));
  }, [project]);
  const ext = project.exterior;
  const hasWalls = project.floors.some((f) => f.walls.length > 0);

  return (
    <Dialog title="Elevations & exterior style" onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        <div className="space-y-3">
          <p className="text-xs font-bold text-ink">Style</p>
          <div className="space-y-1.5" role="radiogroup" aria-label="Exterior style">
            {STYLE_PRESETS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={ext.style === s.id}
                onClick={() => commit((d) => applyStyle(d, s.id))}
                className={`flex w-full items-start gap-2 rounded-md border p-2 text-left ${ext.style === s.id ? 'border-ochre bg-ochre-soft' : 'border-line hover:border-ink-soft'}`}
              >
                <span className="mt-0.5 flex shrink-0 flex-col overflow-hidden rounded-sm border border-black/15">
                  <span className="h-2 w-5" style={{ background: s.roofColor }} />
                  <span className="h-3 w-5" style={{ background: s.exteriorWall }} />
                  <span className="h-0.5 w-5" style={{ background: s.bands ? s.bandColor : s.exteriorWall }} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{s.label}</span>
                  <span className="block text-xs text-ink-soft">{s.description}</span>
                </span>
              </button>
            ))}
          </div>
          <Field label="Sunshade depth over windows and doors" hint="0 = no sunshades">
            <LengthInput
              valueMm={ext.sunshadeMm}
              unit={unit}
              min={0}
              ariaLabel="Sunshade depth"
              onCommit={(v) =>
                commit((d) => {
                  d.exterior.sunshadeMm = Math.min(v, 1500);
                  d.exterior.style = 'custom';
                })
              }
            />
          </Field>
          <Check
            checked={ext.bands}
            onChange={(bands) =>
              commit((d) => {
                d.exterior.bands = bands;
                d.exterior.style = 'custom';
              })
            }
            label="Band at each floor level"
          />
          {ext.bands && (
            <Field label="Band colour">
              <input
                type="color"
                aria-label="Band colour"
                value={ext.bandColor}
                onChange={(e) =>
                  commit((d) => {
                    d.exterior.bandColor = e.target.value;
                    d.exterior.style = 'custom';
                  })
                }
                className="h-7 w-12"
              />
            </Field>
          )}
          <p className="text-xs text-muted">
            A style sets the outside wall and roof colours, the roof type, sunshades and bands. Change any of them afterwards here or in “Choose paint, floors & roof”. Elevations are simplified drawings for discussion, not construction drawings.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Elevation side">
            {(['all', ...SIDES] as const).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={side === s}
                onClick={() => setSide(s)}
                className={`rounded px-2.5 py-1 text-sm ${side === s ? 'bg-ochre-soft font-bold text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                {s === 'all' ? 'All four' : { N: 'North', E: 'East', S: 'South', W: 'West' }[s]}
              </button>
            ))}
          </div>
          {!hasWalls ? (
            <p className="text-sm text-muted">There are no walls yet. Draw rooms and choose “Generate walls from rooms” to see elevations.</p>
          ) : side === 'all' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {elevs.map((e) => (
                <figure key={e.side} className="rounded-md border border-line p-1.5">
                  <figcaption className="px-1 pb-1 text-xs font-bold text-ink">{ELEVATION_TITLES[e.side]}</figcaption>
                  <ElevationSvg elev={e} unit={unit} height={200} />
                </figure>
              ))}
            </div>
          ) : (
            <figure className="rounded-md border border-line p-1.5">
              <figcaption className="px-1 pb-1 text-sm font-bold text-ink">{ELEVATION_TITLES[side]}</figcaption>
              <ElevationSvg elev={elevs[SIDES.indexOf(side)]} unit={unit} height={440} />
            </figure>
          )}
          <p className="text-xs text-muted">Add the elevations to your drawing set from Export → PDF.</p>
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
