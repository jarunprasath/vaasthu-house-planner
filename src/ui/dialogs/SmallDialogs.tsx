import { useState } from 'react';
import { SIDE_NAMES } from '../../model/factory';
import type { Side } from '../../model/types';
import { useProjectStore } from '../../store/projectStore';
import { Button, Check, Dialog } from '../fields';
import { TOOLS } from '../ToolPanel';

export function CompoundDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project);
  const generate = useProjectStore((s) => s.generateCompoundWall);
  const remove = useProjectStore((s) => s.removeCompoundWall);
  const [gates, setGates] = useState<Side[]>(project.plot.roads.map((r) => r.side));
  const exists = project.siteWalls.length > 0;
  return (
    <Dialog title="Compound wall" onClose={onClose}>
      <p className="mb-3 text-sm text-ink-soft">
        Builds a wall just inside every plot boundary edge, with a gate in the middle of each side you choose. After
        that, select a gate to resize it or drag it along the wall.
      </p>
      <p className="mb-1 text-xs text-muted">Gates on</p>
      <div className="mb-4 grid grid-cols-2 gap-1.5">
        {(['N', 'E', 'S', 'W'] as Side[]).map((s) => (
          <Check
            key={s}
            checked={gates.includes(s)}
            onChange={(on) => setGates((g) => (on ? [...g, s] : g.filter((x) => x !== s)))}
            label={`${SIDE_NAMES[s]}${project.plot.roads.some((r) => r.side === s) ? ' (road)' : ''}`}
          />
        ))}
      </div>
      {exists && <p className="mb-3 text-sm text-warn">This replaces the current compound wall and its gates.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {exists && (
          <Button
            variant="danger"
            onClick={() => {
              remove();
              onClose();
            }}
          >
            Remove compound wall
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => {
            generate(gates);
            onClose();
          }}
        >
          {exists ? 'Rebuild compound wall' : 'Add compound wall'}
        </Button>
      </div>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
  ['Ctrl+S', 'Save now'],
  ['Delete / Backspace', 'Delete selected item'],
  ['Ctrl+D', 'Duplicate selected item'],
  ['R', 'Rotate the selected room or furniture item 90° (turns the item while placing it)'],
  ['Arrow keys', 'Nudge the selected furniture item or house outline'],
  ['L', 'Lock or unlock selected item'],
  ['F', 'Fit plot to screen'],
  ['+ / −', 'Zoom in / out'],
  ['Esc', 'Cancel drawing, clear selection'],
  ['Shift (while drawing walls)', 'Allow any angle'],
  ['Mouse wheel, two-finger pinch', 'Zoom'],
  ['Middle mouse or drag on empty space', 'Pan'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Help" onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 text-sm text-ink-soft">
          <h3 className="font-bold text-ink">Getting started</h3>
          <p>1. Open Plot settings and enter your plot size, roads, neighbours and setbacks.</p>
          <p>Have a plan drawing already? Use “Import a plan drawing” on the left to place a picture or PDF of it inside your plot.</p>
          <p>2. Pick a room type on the left and drag on the plan. Drag rooms to move them; drag the handles to resize.</p>
          <p>3. Press “Generate walls from rooms” to build walls along the room edges.</p>
          <p>4. Use the Door and Window tools and click on a wall to place them.</p>
          <p>5. Check the list on the right for overlaps, setback problems and rooms without doors or windows.</p>
          <p>6. Open the Vaasthu tab on the right for the traditional-preference checklist, and switch to 3D view at the top left of the plan.</p>
          <p>7. Export a PDF drawing set to print.</p>
          <p>
            Lengths can be typed as 12'6", 12 ft 6 in, 12.5, 3.8m or 380cm. Plans are drawn with north at the top.
          </p>
          <h3 className="pt-2 font-bold text-ink">Not built yet</h3>
          <p>
            A first-person walkthrough, editing in 3D, a full Tamil interface, kitchen and bathroom designers,
            electrical, plumbing and drainage layers, cost estimates, the AI assistant and the 4D construction timeline
            are planned for later phases. They are not shown as buttons until they work.
          </p>
          <p className="text-xs text-muted">
            Drawings from this app are preliminary. Structural, electrical and plumbing design, and building approval,
            need qualified professionals and your local authority.
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-bold">Tool keys</h3>
          <table className="mb-4 w-full text-sm">
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.id}>
                  <td className="py-0.5 pr-3">
                    <kbd className="rounded border border-line px-1.5 text-xs">{t.key}</kbd>
                  </td>
                  <td className="py-0.5 text-ink-soft">{t.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mb-2 text-sm font-bold">Other shortcuts</h3>
          <table className="w-full text-sm">
            <tbody>
              {SHORTCUTS.map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-3 align-top">
                    <kbd className="rounded border border-line px-1.5 text-xs whitespace-nowrap">{k}</kbd>
                  </td>
                  <td className="py-0.5 text-ink-soft">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Dialog>
  );
}
