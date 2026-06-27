import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock chrome.storage.session
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

// 动态导入，确保 mock 生效
const { getTabState, setPageContent, updateSummary, addTranslation, clearTabState } = await import('@/background/tab-state');
import type { PageContent } from '@/shared/types';

const mockPage: PageContent = {
  url: 'https://x.com', title: 'T', text: 'body',
  paragraphs: ['body'], detectedLang: 'en', contentType: 'article', extractedAt: 1,
};

describe('tab-state (多页面隔离)', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('getTabState 返回空状态当 tab 不存在', async () => {
    const s = await getTabState(100);
    expect(s.tabId).toBe(100);
    expect(s.summary.status).toBe('idle');
    expect(s.translations).toEqual([]);
    expect(s.pageContent).toBeNull();
  });

  it('setPageContent 写入后可读回', async () => {
    await setPageContent(1, mockPage);
    const s = await getTabState(1);
    expect(s.pageContent?.url).toBe('https://x.com');
  });

  it('多个 tab 状态相互隔离', async () => {
    await updateSummary(1, { status: 'done', text: 'tab1 摘要' });
    await updateSummary(2, { status: 'done', text: 'tab2 摘要' });
    const s1 = await getTabState(1);
    const s2 = await getTabState(2);
    expect(s1.summary.text).toBe('tab1 摘要');
    expect(s2.summary.text).toBe('tab2 摘要');
    // 互不干扰
    expect(s1.summary.text).not.toBe(s2.summary.text);
  });

  it('addTranslation 最新在最前', async () => {
    await addTranslation(1, { id: 'a', source: 's1', target: 't1', at: 100 });
    await addTranslation(1, { id: 'b', source: 's2', target: 't2', at: 200 });
    const s = await getTabState(1);
    expect(s.translations.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('clearTabState 清除指定 tab', async () => {
    await updateSummary(1, { status: 'done', text: 'x' });
    await clearTabState(1);
    const s = await getTabState(1);
    expect(s.summary.status).toBe('idle'); // 已清空，回到默认
  });
});
