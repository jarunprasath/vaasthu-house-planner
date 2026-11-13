import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { PlanCanvas } from './editor/PlanCanvas';
import { lastProjectId, loadProject } from './storage/db';
import { useProjectStore } from './store/projectStore';
import { useUiStore, type Tool } from './store/uiStore';
import { createSampleProject } from './templates/sample60x58';
import { BottomBar } from './ui/BottomBar';
import { ExportDialog } from './ui/dialogs/ExportDialog';
import { PlotDialog } from './ui/dialogs/PlotDialog';
import { ProjectsDialog } from './ui/dialogs/ProjectsDialog';
import { CompoundDialog, HelpDialog } from './ui/dialogs/SmallDialogs';
import { VaasthuRulesDialog } from './ui/dialogs/VaasthuRulesDialog';
import { FinishesDialog } from './ui/dialogs/FinishesDialog';
import { ImportPlanDialog } from './ui/dialogs/ImportPlanDialog';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { ToolPanel, TOOLS } from './ui/ToolPanel';
import { TopBar } from './ui/TopBar';
import { useAutosave } from './useAutosave';

const View3D = lazy(() => import('./three/View3D'));

export default function App() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const ui = useUiStore();
  const notice = useProjectStore((s) => s.notice);
  const setNotice = useProjectStore((s) => s.setNotice);
  const { state: saveState, saveNow } = useAutosave(ready);

  // Load the last project, or start with the sample and show the welcome screen.
  useEffect(() => {
    (async () => {
      try {
        const id = await lastProjectId();
        const p = id ? await loadProject(id) : null;
        if (p) useProjectStore.getState().load(p);
        else {
          useProjectStore.getState().load(createSampleProject());
          setWelcome(true);
          ui.openDialog('projects');
        }
      } catch (e) {
        useProjectStore.getState().load(createSampleProject());
        setNotice(`Browser storage is unavailable, so changes will not be kept: ${e instanceof Error ? e.message : e}`);
      }
      ui.requestFit();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', ui.theme === 'dark');
  }, [ui.theme]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [notice, setNotice]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (useUiStore.getState().dialog) return;
      const s = useProjectStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) return e.preventDefault(), s.undo();
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return e.preventDefault(), s.redo();
      if (mod && k === 's') return e.preventDefault(), void saveNow();
      if (mod && k === 'd') return e.preventDefault(), s.duplicateSelection();
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') return e.preventDefault(), s.deleteSelection();
      if (e.key === 'Escape') {
        s.select(null);
        useUiStore.getState().setTool('select');
        return;
      }
      if (s.selection?.kind === 'footprint' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = (s.project.settings.snapMm || 152.4) * (e.shiftKey ? 2 : 1);
        const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.key];
        if (d) s.moveHouse(d[0], d[1]);
        return;
      }
      if (k === 'r') return s.rotateSelectedRoom();
      if (k === 'l') return s.toggleLockSelection();
      if (k === 'f') return useUiStore.getState().requestFit();
      if (e.key === '+' || e.key === '=' || e.key === '-') {
        const v = useUiStore.getState().view;
        const f = e.key === '-' ? 1 / 1.25 : 1.25;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const scale = Math.min(Math.max(v.scale * f, 0.004), 2);
        useUiStore.getState().setView({ scale, x: cx - ((cx - v.x) / v.scale) * scale, y: cy - ((cy - v.y) / v.scale) * scale });
        return;
      }
      const tool = TOOLS.find((t) => t.key.toLowerCase() === k);
      if (tool) useUiStore.getState().setTool(tool.id as Tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  const close = () => {
    ui.openDialog(null);
    setWelcome(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-paper text-ink">
      <TopBar saveState={saveState} onSave={saveNow} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          aria-label="Tools"
          className={`no-print absolute inset-y-0 left-0 z-20 w-64 border-r border-line bg-panel shadow-lg transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
            ui.leftOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <ToolPanel />
        </aside>
        <main className="relative min-w-0 flex-1" aria-label="Plan">
          {ready && ui.viewMode === '2d' && <PlanCanvas stageRef={stageRef} />}
          {ready && ui.viewMode === '3d' && (
            <Suspense fallback={<p className="absolute inset-0 grid place-items-center text-sm text-muted">Loading 3D view…</p>}>
              <View3D />
            </Suspense>
          )}
          <div className="no-print absolute left-3 top-3 z-10 flex overflow-hidden rounded-md border border-line bg-panel text-sm shadow-sm" role="group" aria-label="View mode">
            {(['2d', '3d'] as const).map((m) => (
              <button
                key={m}
                aria-pressed={ui.viewMode === m}
                onClick={() => ui.setViewMode(m)}
                className={`px-3 py-1.5 ${ui.viewMode === m ? 'bg-ink text-panel' : 'text-ink-soft hover:bg-ochre-soft'}`}
              >
                {m === '2d' ? '2D plan' : '3D view'}
              </button>
            ))}
          </div>
          {notice && (
            <div role="status" className="absolute bottom-3 left-1/2 z-10 max-w-md -translate-x-1/2 rounded-md border border-line bg-panel px-4 py-2 text-sm shadow-md">
              {notice}
            </div>
          )}
        </main>
        <aside
          aria-label="Properties"
          className={`no-print absolute inset-y-0 right-0 z-20 w-80 border-l border-line bg-panel shadow-lg transition-transform lg:static lg:translate-x-0 lg:shadow-none ${
            ui.rightOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <PropertiesPanel />
        </aside>
      </div>
      <BottomBar />

      {ui.dialog === 'projects' && <ProjectsDialog welcome={welcome} onClose={close} />}
      {ui.dialog === 'plot' && <PlotDialog onClose={close} />}
      {ui.dialog === 'export' && <ExportDialog onClose={close} stageRef={stageRef} />}
      {ui.dialog === 'help' && <HelpDialog onClose={close} />}
      {ui.dialog === 'compound' && <CompoundDialog onClose={close} />}
      {ui.dialog === 'vaasthuRules' && <VaasthuRulesDialog onClose={close} />}
      {ui.dialog === 'finishes' && <FinishesDialog onClose={close} />}
      {ui.dialog === 'importPlan' && <ImportPlanDialog onClose={close} />}
    </div>
  );
}
