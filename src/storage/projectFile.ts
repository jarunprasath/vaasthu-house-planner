import { DEFAULT_SETTINGS, newId } from '../model/factory';
import { ensureClockwise } from '../model/geometry';
import { SCHEMA_VERSION, type Project } from '../model/types';

export const FILE_EXTENSION = '.vhp.json';

export class ProjectFileError extends Error {}

/**
 * Bring a stored or imported project up to the current schema.
 * Throws ProjectFileError when the data is not a project this version can read.
 */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new ProjectFileError('The file does not contain a project.');
  const p = raw as Partial<Project>;
  if (typeof p.schemaVersion !== 'number') throw new ProjectFileError('Missing schemaVersion — not a house-planner project file.');
  if (p.schemaVersion > SCHEMA_VERSION) {
    throw new ProjectFileError(
      `This project was saved by a newer version of the app (schema ${p.schemaVersion}); this version reads up to schema ${SCHEMA_VERSION}.`,
    );
  }
  if (!p.plot || !Array.isArray(p.plot.boundary) || !Array.isArray(p.floors) || p.floors.length === 0) {
    throw new ProjectFileError('The project is missing its plot or floors.');
  }
  // Future schema migrations go here (if p.schemaVersion === 1 → 2 ...).
  return {
    ...(p as Project),
    id: p.id ?? newId(),
    name: p.name ?? 'Imported house',
    revision: p.revision ?? 1,
    settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
    plot: { ...p.plot, boundary: ensureClockwise(p.plot.boundary) },
    siteWalls: p.siteWalls ?? [],
    siteOpenings: p.siteOpenings ?? [],
    footprint: p.footprint ?? null,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}

export function parseProjectFile(text: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFileError('The file is not valid JSON.');
  }
  return migrateProject(raw);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'house';
}
