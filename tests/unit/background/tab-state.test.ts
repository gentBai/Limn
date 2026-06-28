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

const { getTabState, setPageContent, updateSummary, addChatMessage, clearTabState } = await import('@/background/tab-state');
import type { PageContent } from '@/shared/types';
import type { ConversationMessage } from '@/shared/messages';

const mockPage: PageContent = {
  url: 'https://x.com', title: 'T', text: 'body',
  paragraphs: ['body'], detectedLang: 'en', contentType: 'article', extractedAt: 1,
};

const mockUserMsg: ConversationMessage = { role: 'user', content: 'hi', at: 100 };
const mockAiMsg: ConversationMessage = { role: 'assistant', content: 'hello', at: 200 };

describe('tab-state (per-tab isolation)', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('getTabState returns empty state when tab does not exist', async () => {
    const s = await getTabState(100);
    expect(s.tabId).toBe(100);
    expect(s.summary.status).toBe('idle');
    expect(s.chat).toEqual([]);
    expect(s.pageContent).toBeNull();
  });

  it('setPageContent writes and reads back', async () => {
    await setPageContent(1, mockPage);
    const s = await getTabState(1);
    expect(s.pageContent?.url).toBe('https://x.com');
  });

  it('multiple tabs are isolated', async () => {
    await updateSummary(1, { status: 'done', text: 'tab1 summary' });
    await updateSummary(2, { status: 'done', text: 'tab2 summary' });
    const s1 = await getTabState(1);
    const s2 = await getTabState(2);
    expect(s1.summary.text).toBe('tab1 summary');
    expect(s2.summary.text).toBe('tab2 summary');
    expect(s1.summary.text).not.toBe(s2.summary.text);
  });

  it('addChatMessage appends to the single conversation stream', async () => {
    await addChatMessage(1, mockUserMsg);
    await addChatMessage(1, mockAiMsg);
    const s = await getTabState(1);
    expect(s.chat).toHaveLength(2);
    expect(s.chat[0].content).toBe('hi');
    expect(s.chat[1].content).toBe('hello');
  });

  it('chat history is isolated per tab', async () => {
    await addChatMessage(1, mockUserMsg);
    await addChatMessage(2, mockAiMsg);
    const s1 = await getTabState(1);
    const s2 = await getTabState(2);
    expect(s1.chat).toHaveLength(1);
    expect(s2.chat).toHaveLength(1);
    expect(s1.chat[0].role).toBe('user');
    expect(s2.chat[0].role).toBe('assistant');
  });

  it('clearTabState clears the specified tab', async () => {
    await updateSummary(1, { status: 'done', text: 'x' });
    await clearTabState(1);
    const s = await getTabState(1);
    expect(s.summary.status).toBe('idle'); // cleared, back to default
  });

  it('backward compat: old data without chat field gets initialized', async () => {
    // simulate old data without chat field
    store['tabStates'] = { 99: { tabId: 99, pageContent: null, summary: { status: 'idle', text: '', error: null, usage: null } } };
    const s = await getTabState(99);
    expect(s.chat).toEqual([]);
  });
});
