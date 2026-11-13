import { useMemo, useState } from 'react';
import type { ZoneRating } from '../model/types';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { evaluate, suggestLayout, suggestSwaps, swapRoomUse, type SwapSuggestion, type VaasthuItem } from '../vaasthu/engine';
import { CENTRE_TEXT, RULE_TEXT, ZONE_NAMES } from '../vaasthu/rules';
import { Button, Section } from './fields';

const RATING_LABEL: Record<ZoneRating, { en: string; ta: string; cls: string }> = {
  preferred: { en: 'Preferred', ta: 'சிறந்தது', cls: 'bg-[#2f855a] text-white' },
  acceptable: { en: 'Acceptable', ta: 'ஏற்கத்தக்கது', cls: 'bg-[#b7791f] text-white' },
  neutral: { en: 'No preference', ta: 'குறிப்பிடப்படவில்லை', cls: 'bg-[#8a8f9c] text-white' },
  avoid: { en: 'Avoided', ta: 'தவிர்க்கப்படுவது', cls: 'bg-[#c53030] text-white' },
};

const ORDER: ZoneRating[] = ['avoid', 'neutral', 'acceptable', 'preferred'];

const T = {
  title: { en: 'Vaasthu guidance', ta: 'வாஸ்து வழிகாட்டல்' },
  score: { en: 'Advisory score', ta: 'ஆலோசனை மதிப்பெண்' },
  disclaimer: {
    en: 'Traditional preferences only. They are not structural, health or legal requirements and never override regulations, safety, ventilation or sanitation. Practitioners differ — edit the rules to match the guidance you follow.',
    ta: 'இவை பாரம்பரிய விருப்பங்கள் மட்டுமே. கட்டமைப்பு, சுகாதார அல்லது சட்டத் தேவைகள் அல்ல; விதிமுறைகள், பாதுகாப்பு, காற்றோட்டம், சுகாதாரம் ஆகியவற்றை மீறாது. வல்லுநர்களிடையே கருத்து வேறுபாடு உண்டு — நீங்கள் பின்பற்றும் வழிகாட்டலுக்கு ஏற்ப விதிகளை மாற்றலாம்.',
  },
  best: { en: 'Best', ta: 'சிறந்த இடம்' },
  also: { en: 'also', ta: 'மேலும்' },
  centre: { en: 'Centre of the house', ta: 'வீட்டின் மையம்' },
  centreOk: { en: 'The centre is free of toilets, stairs, kitchen and heavy storage.', ta: 'மையப் பகுதியில் கழிப்பறை, படிக்கட்டு, சமையலறை, கனமான சேமிப்பு எதுவும் இல்லை.' },
  suggestions: { en: 'Alternative placements', ta: 'மாற்று அமைப்புகள்' },
  none: { en: 'No single swap of two similar-sized rooms improves the score.', ta: 'ஒத்த அளவுள்ள இரண்டு அறைகளை மாற்றுவதால் மதிப்பெண் உயரவில்லை.' },
};

export function VaasthuPanel() {
  const project = useProjectStore((s) => s.project);
  const commit = useProjectStore((s) => s.commit);
  const select = useProjectStore((s) => s.select);
  const setActiveFloor = useProjectStore((s) => s.setActiveFloor);
  const ui = useUiStore();
  const lang = ui.lang;
  const report = useMemo(() => evaluate(project), [project]);
  const swaps = useMemo(() => suggestSwaps(project), [project]);
  const [layout, setLayout] = useState<ReturnType<typeof suggestLayout> | null>(null);

  const floorName = (id: string) => project.floors.find((f) => f.id === id)?.name ?? '';
  const goTo = (i: { elementId: string; floorId: string; elementKind?: VaasthuItem['elementKind'] }) => {
    setActiveFloor(i.floorId);
    select({ kind: i.elementKind === 'opening' ? 'opening' : 'room', id: i.elementId });
  };
  const apply = (list: SwapSuggestion[]) => {
    commit((d) => {
      for (const sw of list) {
        const f = d.floors.find((x) => x.id === sw.floorId);
        if (f) swapRoomUse(f, sw.a.id, sw.b.id);
      }
    });
    setLayout(null);
  };

  const sorted = [...report.items].sort((a, b) => ORDER.indexOf(a.rating) - ORDER.indexOf(b.rating) || b.weight - a.weight);
  const zoneList = (zs: string[]) => zs.map((z) => ZONE_NAMES[z as keyof typeof ZONE_NAMES][lang]).join(', ');

  return (
    <>
      <Section
        title={T.title[lang]}
        action={
          <div className="flex overflow-hidden rounded-md border border-line text-xs" role="group" aria-label="Language">
            {(['en', 'ta'] as const).map((l) => (
              <button
                key={l}
                className={`px-2 py-1 ${lang === l ? 'bg-ink text-panel' : 'text-ink-soft'}`}
                aria-pressed={lang === l}
                onClick={() => ui.setLang(l)}
              >
                {l === 'en' ? 'English' : 'தமிழ்'}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-ink">{report.score ?? '–'}</span>
          <span className="text-sm text-muted">/ 100 {T.score[lang].toLowerCase()}</span>
        </div>
        <p className="text-xs text-muted">{T.disclaimer[lang]}</p>
        <p className="text-xs text-muted">
          {report.houseGridSource === 'outline'
            ? 'Judged on the house outline’s 3×3 grid; sump, septic tank, borewell and garden on the plot’s grid.'
            : report.houseGridSource === 'rooms'
              ? 'Judged on a 3×3 grid over the ground-floor rooms (add a house outline to set it exactly).'
              : 'Judged on the plot’s 3×3 grid until rooms are drawn.'}
        </p>
        {report.entrance?.guessed && (
          <p className="text-xs text-warn">
            No door is marked as the main entrance, so “{report.entrance.opening.label || 'a door'}” was used. Select the
            main door and tick “Main entrance”.
          </p>
        )}
        {!report.entrance && <p className="text-xs text-warn">No entrance door yet, so the entrance is not judged.</p>}
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => ui.openDialog('vaasthuRules')}>Edit rules</Button>
          {!ui.showZones && <Button onClick={() => ui.toggle('showZones')}>Show grid on plan</Button>}
        </div>
      </Section>

      <Section title={T.centre[lang]}>
        {!project.vaasthu.keepCentreOpen ? (
          <p className="text-sm text-muted">Centre check is turned off in the rules.</p>
        ) : report.centreIssues.length === 0 ? (
          <p className="text-sm text-ink-soft">{T.centreOk[lang]}</p>
        ) : (
          <>
            <ul className="space-y-1">
              {report.centreIssues.map((c) => (
                <li key={c.elementId}>
                  <button className="text-left text-sm hover:underline" onClick={() => goTo(c)}>
                    <span className="font-bold text-danger">{RATING_LABEL.avoid[lang]}:</span> {c.name} ({floorName(c.floorId)})
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{CENTRE_TEXT[lang]}</p>
          </>
        )}
      </Section>

      <Section title={lang === 'en' ? `Checklist (${report.items.length})` : `சரிபார்ப்புப் பட்டியல் (${report.items.length})`}>
        {sorted.length === 0 && <p className="text-sm text-muted">Add rooms to see how they compare with the rules.</p>}
        <ul className="space-y-2.5">
          {sorted.map((i) => {
            const text = RULE_TEXT[i.target];
            return (
              <li key={i.key} className="rounded-md border border-line p-2">
                <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => goTo(i)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{i.name}</span>
                    <span className="block text-xs text-muted">
                      {floorName(i.floorId)}, {ZONE_NAMES[i.zone][lang]}
                      {i.onPlot ? (lang === 'en' ? ' of plot' : ' (மனை)') : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${RATING_LABEL[i.rating].cls}`}>{RATING_LABEL[i.rating][lang]}</span>
                </button>
                {i.rating !== 'preferred' && i.preferredZones.length > 0 && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {T.best[lang]}: {zoneList(i.preferredZones)}
                    {i.acceptableZones.length > 0 && `; ${T.also[lang]} ${zoneList(i.acceptableZones)}`}
                  </p>
                )}
                {text && i.rating !== 'preferred' && <p className="mt-1 text-xs text-muted">{text.explain[lang]}</p>}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={T.suggestions[lang]}>
        <p className="text-xs text-muted">
          Swaps exchange what two similar-sized rooms are used for, keeping walls, doors and windows. Check doors,
          plumbing and furniture after applying. Undo reverses it.
        </p>
        {swaps.length === 0 ? (
          <p className="text-sm text-ink-soft">{T.none[lang]}</p>
        ) : (
          <ul className="space-y-1.5">
            {swaps.map((sw) => (
              <li key={`${sw.a.id}-${sw.b.id}`} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  Swap <b>{sw.a.name}</b> ↔ <b>{sw.b.name}</b> <span className="text-muted">(+{sw.delta})</span>
                </span>
                <Button onClick={() => apply([sw])}>Apply</Button>
              </li>
            ))}
          </ul>
        )}
        <Button onClick={() => setLayout(suggestLayout(project))} disabled={swaps.length === 0}>
          Suggest an alternative layout
        </Button>
        {layout && (
          <div className="rounded-md border border-ochre bg-ochre-soft p-2 text-sm">
            <p className="mb-1">
              Score {layout.from} → <b>{layout.to}</b> with {layout.swaps.length} swap{layout.swaps.length === 1 ? '' : 's'}:
            </p>
            <ul className="mb-2 list-disc pl-5">
              {layout.swaps.map((sw) => (
                <li key={`${sw.a.id}-${sw.b.id}`}>
                  {sw.a.name} ↔ {sw.b.name}
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <Button variant="primary" onClick={() => apply(layout.swaps)}>
                Apply all
              </Button>
              <Button onClick={() => setLayout(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
