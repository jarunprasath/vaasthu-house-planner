import type { ZoneId, ZoneRating } from '../../model/types';
import { defaultVaasthu } from '../../model/factory';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { RULE_TEXT, ZONE_IDS } from '../../vaasthu/rules';
import { Button, Check, Dialog } from '../fields';

const NEXT: Record<ZoneRating, ZoneRating> = { neutral: 'preferred', preferred: 'acceptable', acceptable: 'avoid', avoid: 'neutral' };
const CELL: Record<ZoneRating, { cls: string; mark: string; label: string }> = {
  preferred: { cls: 'bg-[#2f855a] text-white', mark: '✓', label: 'preferred' },
  acceptable: { cls: 'bg-[#b7791f] text-white', mark: '~', label: 'acceptable' },
  avoid: { cls: 'bg-[#c53030] text-white', mark: '✕', label: 'avoided' },
  neutral: { cls: 'bg-panel text-muted', mark: '', label: 'no preference' },
};

export function VaasthuRulesDialog({ onClose }: { onClose: () => void }) {
  const v = useProjectStore((s) => s.project.vaasthu);
  const commit = useProjectStore((s) => s.commit);
  const lang = useUiStore((s) => s.lang);

  const setZone = (i: number, z: ZoneId) =>
    commit((d) => {
      const r = d.vaasthu.rules[i];
      r.zones[z] = NEXT[r.zones[z]];
    });

  return (
    <Dialog title="Vaasthu rules for this project" onClose={onClose} wide>
      <p className="mb-3 max-w-prose text-sm text-ink-soft">
        Each small grid is the house seen from above with north at the top. Click a square to cycle it through
        preferred (✓), acceptable (~), avoided (✕) and no preference. Weight sets how much a rule counts in the score.
        Changes apply to this project only and can be undone.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Check
          checked={v.keepCentreOpen}
          onChange={(on) =>
            commit((d) => {
              d.vaasthu.keepCentreOpen = on;
            })
          }
          label="Keep the centre (Brahmasthan) free of toilets, stairs, kitchen and heavy storage"
        />
        <Button
          onClick={() => {
            if (confirm('Reset all Vaasthu rules in this project to the defaults?'))
              commit((d) => {
                d.vaasthu = defaultVaasthu();
              });
          }}
        >
          Reset to defaults
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {v.rules.map((rule, i) => (
          <div key={rule.target} className={`rounded-md border border-line p-2.5 ${rule.enabled ? '' : 'opacity-50'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--ochre)]"
                  checked={rule.enabled}
                  onChange={(e) =>
                    commit((d) => {
                      d.vaasthu.rules[i].enabled = e.target.checked;
                    })
                  }
                />
                {RULE_TEXT[rule.target]?.label[lang] ?? rule.target}
              </label>
              <select
                aria-label="Weight"
                className="rounded border border-line bg-panel px-1 py-0.5 text-xs"
                value={rule.weight}
                onChange={(e) =>
                  commit((d) => {
                    d.vaasthu.rules[i].weight = Number(e.target.value);
                  })
                }
              >
                {[1, 2, 3].map((w) => (
                  <option key={w} value={w}>
                    weight {w}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid w-[132px] grid-cols-3 gap-0.5" role="grid" aria-label={`${rule.target} zones`}>
              {ZONE_IDS.map((z) => {
                const c = CELL[rule.zones[z]];
                return (
                  <button
                    key={z}
                    disabled={!rule.enabled}
                    onClick={() => setZone(i, z)}
                    title={`${z}: ${c.label}`}
                    aria-label={`${z}: ${c.label}`}
                    className={`flex h-10 flex-col items-center justify-center rounded-sm border border-line text-[10px] leading-none ${c.cls}`}
                  >
                    <span>{z === 'C' ? 'C' : z}</span>
                    <span className="text-sm font-bold">{c.mark}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
