import { describe, expect, it, vi } from 'vitest';
import type { TabState } from '@/shared/messages';
import type { PageContent } from '@/shared/types';
import { getContentForChat, parseChatPortName } from '@/background/chat-flow';

const pageContent: PageContent = {
  url: 'https://example.com',
  title: 'Example',
  text: 'Page body',
  paragraphs: ['Page body'],
  detectedLang: 'en',
  contentType: 'article',
  extractedAt: 1,
};

const emptyState: TabState = {
  tabId: 42,
  pageContent: null,
  summary: { status: 'idle', text: '', error: null, usage: null },
  chat: [],
};

describe('chat flow helpers', () => {
  it('parses sidepanel chat port names with explicit tabId and colon payloads', () => {
    expect(parseChatPortName('chat:42:question:Why: now?', undefined)).toEqual({
      tabId: 42,
      mode: 'question',
      payload: 'Why: now?',
    });
  });

  it('parses content-script selection port names using sender tabId', () => {
    expect(parseChatPortName('chat:selection:selected: text', 7)).toEqual({
      tabId: 7,
      mode: 'selection',
      payload: 'selected: text',
    });
  });

  it('uses cached page content for chat when available', async () => {
    const extract = vi.fn();
    const content = await getContentForChat(42, pageContent, emptyState, extract);
    expect(content).toBe(pageContent);
    expect(extract).not.toHaveBeenCalled();
  });

  it('extracts page content before chat when no cached or stored content exists', async () => {
    const extract = vi.fn().mockResolvedValue(pageContent);
    const content = await getContentForChat(42, undefined, emptyState, extract);
    expect(content).toBe(pageContent);
    expect(extract).toHaveBeenCalledWith(42);
  });
});
