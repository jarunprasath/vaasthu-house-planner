import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import type { SaveState } from '../useAutosave';
import { Button } from './fields';
import { Icon } from './icons';

export function TopBar({ saveState, onSave }: { saveState: SaveState; onSave: () => void }) {
  const ui = useUiStore();
  const name = useProjectStore((s) => s.project.name);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const saveText =
    saveState.status === 'saving'
      ? 'Saving…'
      : saveState.status === 'error'
        ? 'Not saved'
        : saveState.at
          ? `Saved ${saveState.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : '';

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-panel px-2 sm:gap-2 sm:px-3">
      <Button variant="ghost" className="lg:hidden" title="Tools" onClick={() => ui.setPanels({ leftOpen: !ui.leftOpen })}>
        <Icon name="menu" />
      </Button>
      <div className="mr-1 hidden min-w-0 items-center gap-2 sm:flex">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
          <path d="M4 15 16 5l12 10v12H4z" fill="var(--ochre)" />
          <rect x="13" y="19" width="6" height="8" fill="var(--panel)" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-ink">{name}</p>
          <p className="hidden truncate text-xs leading-tight text-muted sm:block" aria-live="polite">
            {saveText}
          </p>
        </div>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
        <Button variant="ghost" onClick={() => ui.openDialog('projects')} title="Projects & templates">
          <Icon name="folder" /> <span className="hidden md:inline">Projects</span>
        </Button>
        <span className="hidden sm:contents">
          <Button variant="ghost" onClick={onSave} title="Save now (Ctrl+S)">
            <Icon name="save" /> <span className="hidden md:inline">Save</span>
          </Button>
        </span>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Button variant="ghost" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Icon name="undo" />
        </Button>
        <Button variant="ghost" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Icon name="redo" />
        </Button>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Button variant="ghost" onClick={() => ui.openDialog('plot')} title="Plot settings">
          <Icon name="plot" /> <span className="hidden md:inline">Plot</span>
        </Button>
        <Button variant="primary" onClick={() => ui.openDialog('export')} title="Export & print">
          <Icon name="export" /> <span className="hidden sm:inline">Export</span>
        </Button>
<span className="hidden sm:contents">
        <Button
          variant="ghost"
          onClick={() => ui.setTheme(ui.theme === 'dark' ? 'light' : 'dark')}
          title={ui.theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          <Icon name={ui.theme === 'dark' ? 'sun' : 'moon'} />
        </Button>
        </span>
        <Button variant="ghost" onClick={() => ui.openDialog('help')} title="Help & shortcuts">
          <Icon name="help" />
        </Button>
        <Button variant="ghost" className="lg:hidden" title="Properties" onClick={() => ui.setPanels({ rightOpen: !ui.rightOpen })}>
          <Icon name="panel" />
        </Button>
      </div>
    </header>
  );
}
