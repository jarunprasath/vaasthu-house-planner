import { useEffect, useRef, useState } from 'react';
import { newId } from '../../model/factory';
import { deleteProject, listProjects, loadProject, saveProject, type ProjectSummary } from '../../storage/db';
import { parseProjectFile, ProjectFileError } from '../../storage/projectFile';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { TEMPLATES } from '../../templates';
import { Button, Dialog } from '../fields';

export function ProjectsDialog({ welcome, onClose }: { welcome: boolean; onClose: () => void }) {
  const load = useProjectStore((s) => s.load);
  const current = useProjectStore((s) => s.project);
  const requestFit = useUiStore((s) => s.requestFit);
  const [saved, setSaved] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listProjects()
      .then(setSaved)
      .catch((e) => setError(`Could not read saved projects: ${e instanceof Error ? e.message : e}`));
  useEffect(() => {
    refresh();
  }, []);

  const open = async (id: string) => {
    try {
      // save the current one first so nothing is lost
      await saveProject(useProjectStore.getState().project);
      const p = await loadProject(id);
      if (!p) throw new Error('That project no longer exists.');
      load(p);
      requestFit();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const fromTemplate = async (create: () => ReturnType<(typeof TEMPLATES)[number]['create']>) => {
    await saveProject(useProjectStore.getState().project).catch(() => undefined);
    load(create());
    requestFit();
    onClose();
  };

  const importFile = async (file: File) => {
    try {
      const p = parseProjectFile(await file.text());
      // Avoid overwriting an existing project with the same id.
      const existing = await loadProject(p.id);
      const project = existing ? { ...p, id: newId(), name: `${p.name} (imported)` } : p;
      await saveProject(project);
      load(project);
      requestFit();
      onClose();
    } catch (e) {
      setError(e instanceof ProjectFileError ? e.message : `Import failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <Dialog title={welcome ? 'Welcome — start a house plan' : 'Projects'} onClose={onClose} wide>
      {welcome && (
        <p className="mb-4 max-w-prose text-sm text-ink-soft">
          Set up your plot, draw rooms, add doors and windows, and print a dimensioned plan. Everything is saved in this
          browser automatically. Start from a template or open the sample house below.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-md border border-danger px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <h3 className="mb-2 text-sm font-bold">Start new</h3>
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="rounded-md border border-line p-3 text-left hover:border-ochre"
            onClick={() => fromTemplate(t.create)}
          >
            <span className="block text-sm font-bold text-ink">{t.name}</span>
            <span className="mt-1 block text-xs text-muted">{t.description}</span>
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">Saved in this browser</h3>
        <Button onClick={() => fileRef.current?.click()}>Open project file…</Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {saved === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : saved.length === 0 ? (
        <p className="text-sm text-muted">No saved projects yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {saved.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {p.name} {p.id === current.id && <span className="text-xs text-muted">(open)</span>}
                </p>
                <p className="text-xs text-muted">
                  {p.floors} floor{p.floors === 1 ? '' : 's'}, edited {new Date(p.updatedAt).toLocaleString()}
                </p>
              </div>
              <Button onClick={() => open(p.id)} disabled={p.id === current.id}>
                Open
              </Button>
              <Button
                variant="danger"
                disabled={p.id === current.id}
                onClick={async () => {
                  if (!confirm(`Delete “${p.name}” from this browser? This cannot be undone.`)) return;
                  await deleteProject(p.id);
                  refresh();
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Projects live in this browser’s storage. Clearing site data removes them — use Export → Project file to keep a backup.
      </p>
    </Dialog>
  );
}
