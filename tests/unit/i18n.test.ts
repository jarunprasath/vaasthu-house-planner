import { describe, expect, it } from 'vitest';
import { TAMIL_KEYS, translate } from '../../src/i18n';
import { ROOM_TYPE_LABELS } from '../../src/model/types';

describe('interface language', () => {
  it('returns English unchanged and falls back for unknown text', () => {
    expect(translate('en', 'Kitchen')).toBe('Kitchen');
    expect(translate('ta', 'Some text that is not translated')).toBe('Some text that is not translated');
  });
  it('translates every room type into Tamil script', () => {
    for (const label of Object.values(ROOM_TYPE_LABELS)) {
      expect(TAMIL_KEYS, label).toContain(label);
      expect(translate('ta', label)).toMatch(/[஀-௿]/);
    }
  });
});
