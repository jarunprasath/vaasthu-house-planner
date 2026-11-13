import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteProject, lastProjectId, listProjects, loadProject, saveProject } from '../../src/storage/db';
import { parseProjectFile, ProjectFileError, serializeProject } from '../../src/storage/projectFile';
import { createSampleProject } from '../../src/templates/sample60x58';

describe('storage', () => {
  it('saves, lists, reopens and deletes', async () => {
    const p = createSampleProject();
    await saveProject(p);
    expect(await lastProjectId()).toBe(p.id);
    expect((await listProjects()).map((x) => x.id)).toContain(p.id);
    expect(await loadProject(p.id)).toEqual(p);
    await deleteProject(p.id);
    expect(await loadProject(p.id)).toBeNull();
  });

  it('round-trips the JSON file format', () => {
    const p = createSampleProject();
    expect(parseProjectFile(serializeProject(p))).toEqual(p);
  });

  it('rejects bad files with a readable error', () => {
    expect(() => parseProjectFile('{nope')).toThrow(ProjectFileError);
    expect(() => parseProjectFile('{"a":1}')).toThrow(/schemaVersion/);
    expect(() => parseProjectFile(JSON.stringify({ ...createSampleProject(), schemaVersion: 99 }))).toThrow(/newer version/);
  });
});
