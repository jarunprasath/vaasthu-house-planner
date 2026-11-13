import { useCallback, useEffect, useRef, useState } from 'react';
import { saveProject } from './storage/db';
import { useProjectStore } from './store/projectStore';

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  at?: Date;
  error?: string;
}

/** Saves the project to IndexedDB shortly after every change. */
export function useAutosave(enabled: boolean): { state: SaveState; saveNow: () => Promise<void> } {
  const project = useProjectStore((s) => s.project);
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const timer = useRef<number | undefined>(undefined);

  const saveNow = useCallback(async () => {
    window.clearTimeout(timer.current);
    setState((s) => ({ ...s, status: 'saving' }));
    try {
      await saveProject(useProjectStore.getState().project);
      setState({ status: 'saved', at: new Date() });
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(saveNow, 700);
    return () => window.clearTimeout(timer.current);
  }, [project, enabled, saveNow]);

  return { state, saveNow };
}
