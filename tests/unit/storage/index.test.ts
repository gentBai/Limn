import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock chrome.storage.local
const store: Record<string, unknown> = {};
const chrome = {
  storage: {
    local: {
      get: vi.fn(async () => ({ ...store })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); }),
    },
  },
};
vi.stubGlobal('chrome', chrome);

import { loadSettings, saveSettings } from '@/storage';

describe('storage', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('returns defaults when empty', async () => {
    const s = await loadSettings();
    expect(s.activeProviderId).toBe('deepseek');
    expect(s.translateTargetLang).toBe('zh');
  });

  it('round-trips saved settings', async () => {
    await saveSettings({ activeProviderId: 'openai' } as any);
    const s = await loadSettings();
    expect(s.activeProviderId).toBe('openai');
  });
});
