import { beforeEach, describe, expect, it } from 'vitest';
import { createRoom } from '../../src/model/factory';
import { activeFloor, useProjectStore } from '../../src/store/projectStore';
import { createSampleProject } from '../../src/templates/sample60x58';

describe('project store', () => {
  beforeEach(() => useProjectStore.getState().load(createSampleProject()));

  it('undo and redo a room addition', () => {
    const s = useProjectStore.getState();
    const before = activeFloor(s).rooms.length;
    s.addRoom(createRoom('study', 0, 0, 1000, 1000));
    expect(activeFloor(useProjectStore.getState()).rooms.length).toBe(before + 1);
    useProjectStore.getState().undo();
    expect(activeFloor(useProjectStore.getState()).rooms.length).toBe(before);
    useProjectStore.getState().redo();
    expect(activeFloor(useProjectStore.getState()).rooms.length).toBe(before + 1);
  });

  it('does not record a history entry for a no-op', () => {
    const s = useProjectStore.getState();
    s.updateRoom('does-not-exist', { name: 'x' });
    expect(useProjectStore.getState().past).toHaveLength(0);
  });

  it('locked elements cannot be deleted', () => {
    const s = useProjectStore.getState();
    const room = activeFloor(s).rooms[0];
    s.select({ kind: 'room', id: room.id });
    s.toggleLockSelection();
    useProjectStore.getState().deleteSelection();
    expect(activeFloor(useProjectStore.getState()).rooms.some((r) => r.id === room.id)).toBe(true);
  });

  it('rebuilding walls keeps doors and windows', () => {
    const s = useProjectStore.getState();
    const n = activeFloor(s).openings.length;
    s.rebuildWalls();
    expect(activeFloor(useProjectStore.getState()).openings.length).toBe(n);
    expect(useProjectStore.getState().notice).toContain('Walls rebuilt');
  });

  it('duplicates a floor with re-pointed openings', () => {
    const s = useProjectStore.getState();
    const g = activeFloor(s);
    s.duplicateFloor(g.id);
    const copy = activeFloor(useProjectStore.getState());
    expect(copy.id).not.toBe(g.id);
    expect(copy.openings.every((o) => copy.walls.some((w) => w.id === o.wallId))).toBe(true);
  });

  it('rotates a room about its centre', () => {
    const s = useProjectStore.getState();
    const r = activeFloor(s).rooms.find((x) => x.name === 'Kitchen')!;
    s.select({ kind: 'room', id: r.id });
    s.rotateSelectedRoom();
    const after = activeFloor(useProjectStore.getState()).rooms.find((x) => x.id === r.id)!;
    expect(after.w).toBeCloseTo(r.d);
    expect(after.x + after.w / 2).toBeCloseTo(r.x + r.w / 2);
  });
});
