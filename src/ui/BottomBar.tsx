import { formatLength, snapOptions, UNIT_LABELS } from '../model/units';
import type { DisplayUnit } from '../model/types';
import { useCursorStore } from '../store/cursorStore';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { Icon } from './icons';
import { useT } from '../i18n';

export function BottomBar() {
  const s = useProjectStore();
  const ui = useUiStore();
  const t = useT();
  const cursor = useCursorStore((c) => c.p);
  const unit = s.project.settings.unit;
  const floors = [...s.project.floors].sort((a, b) => a.level - b.level);

  const zoom = (factor: number) => {
    const v = ui.view;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const wx = (cx - v.x) / v.scale;
    const wy = (cy - v.y) / v.scale;
    const scale = Math.min(Math.max(v.scale * factor, 0.004), 2);
    ui.setView({ scale, x: cx - wx * scale, y: cy - wy * scale });
  };

  const sel = 'rounded-md border border-line bg-panel px-1.5 py-1 text-sm text-ink';

  return (
    <footer className="no-print flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-panel px-2 py-1 text-sm sm:px-3">
      <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Floors">
        {floors.map((f) => (
          <button
            key={f.id}
            onClick={() => s.setActiveFloor(f.id)}
            aria-current={f.id === s.activeFloorId}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 ${
              f.id === s.activeFloorId ? 'bg-ink text-panel' : 'text-ink-soft hover:bg-ochre-soft'
            }`}
          >
            {f.name}
          </button>
        ))}
        <button onClick={s.addFloor} className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-soft hover:bg-ochre-soft" title="Add an empty floor above">
          <Icon name="plus" size={14} /> {t('Floor')}
        </button>
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="hidden w-44 text-xs text-muted tabular-nums md:inline" aria-hidden="true">
          {cursor ? `${formatLength(cursor.x, unit)} E, ${formatLength(cursor.y, unit)} S` : ''}
        </span>
        <label className="flex items-center gap-1 text-xs text-muted">
          {t('Units')}
          <select
            className={sel}
            value={unit}
            onChange={(e) => {
              const u = e.target.value as DisplayUnit;
              const snapMm = snapOptions(u)[3].mm;
              s.commit((d) => {
                d.settings.unit = u;
                d.settings.snapMm = snapMm;
              });
            }}
          >
            {(Object.keys(UNIT_LABELS) as DisplayUnit[]).map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          {t('Snap')}
          <select
            className={sel}
            value={String(s.project.settings.snapMm)}
            onChange={(e) =>
              s.commit((d) => {
                d.settings.snapMm = Number(e.target.value);
              })
            }
          >
            {snapOptions(unit).map((o) => (
              <option key={o.label} value={String(o.mm)}>
                {o.label}
              </option>
            ))}
            {!snapOptions(unit).some((o) => Math.abs(o.mm - s.project.settings.snapMm) < 0.01) && (
              <option value={String(s.project.settings.snapMm)}>{formatLength(s.project.settings.snapMm, unit)}</option>
            )}
          </select>
        </label>
        <div className="flex items-center">
          <button className="rounded p-1.5 text-ink-soft hover:bg-ochre-soft" onClick={() => zoom(1 / 1.25)} title="Zoom out (-)" aria-label="Zoom out">
            <Icon name="minus" size={16} />
          </button>
          <button className="rounded p-1.5 text-ink-soft hover:bg-ochre-soft" onClick={ui.requestFit} title="Fit plot (F)" aria-label="Fit plot to screen">
            <Icon name="fit" size={16} />
          </button>
          <button className="rounded p-1.5 text-ink-soft hover:bg-ochre-soft" onClick={() => zoom(1.25)} title="Zoom in (+)" aria-label="Zoom in">
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
}
