import { openDB, type IDBPDatabase } from 'idb';
import type { Project } from '../model/types';
import { migrateProject } from './projectFile';

const DB_NAME = 'vaasthu-house-planner';
const STORE = 'projects';
const META = 'meta';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  floors: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(META)) database.createObjectStore(META);
      },
    });
  }
  return dbPromise;
}

export async function saveProject(p: Project): Promise<void> {
  const d = await db();
  await d.put(STORE, p);
  await d.put(META, p.id, 'lastProjectId');
}

export async function loadProject(id: string): Promise<Project | null> {
  const d = await db();
  const raw = await d.get(STORE, id);
  return raw ? migrateProject(raw) : null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const d = await db();
  const all = (await d.getAll(STORE)) as Project[];
  return all
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, floors: p.floors?.length ?? 0 }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, id);
}

export async function lastProjectId(): Promise<string | null> {
  const d = await db();
  return ((await d.get(META, 'lastProjectId')) as string | undefined) ?? null;
}

/** For tests: close and forget the connection. */
export async function resetDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}
