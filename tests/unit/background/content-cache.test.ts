import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock chrome.storage.session (same isolation pattern as tab-state.test.ts)
const store: Record<string, unknown> = {};
const chrome = {
  storage: {
    session: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); }),
    },
  },
};
vi.stubGlobal('chrome', chrome);

const { getContent, setContent, deleteContent } = await import('@/background/content-cache');
import type { PageContent } from '@/shared/types';

const mockPage: PageContent = {
  url: 'https://x.com', title: 'T', text: 'body',
  paragraphs: ['body'], detectedLang: 'en', contentType: 'article', extractedAt: 1,
};

describe('content-cache (survives SW restart via session storage)', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('getContent returns undefined when nothing cached', async () => {
    expect(await getContent(1)).toBeUndefined();
  });

  it('setContent writes and getContent reads back', async () => {
    await setContent(1, mockPage);
    expect(await getContent(1)).toEqual(mockPage);
  });

  it('cache is isolated per tab', async () => {
    const other: PageContent = { ...mockPage, url: 'https://y.com', text: 'other' };
    await setContent(1, mockPage);
    await setContent(2, other);
    expect((await getContent(1))?.url).toBe('https://x.com');
    expect((await getContent(2))?.url).toBe('https://y.com');
  });

  it('deleteContent removes only the target tab', async () => {
    await setContent(1, mockPage);
    await setContent(2, mockPage);
    await deleteContent(1);
    expect(await getContent(1)).toBeUndefined();
    expect(await getContent(2)).toEqual(mockPage);
  });

  it('deleteContent is a no-op when nothing is cached for the tab', async () => {
    await deleteContent(99); // should not throw
    expect(await getContent(99)).toBeUndefined();
  });
});
