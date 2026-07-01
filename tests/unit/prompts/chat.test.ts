import { describe, expect, it } from 'vitest';
import { buildChatPrompt, wrapSelectionAsUserMessage } from '@/prompts/chat';
import type { PageContent } from '@/shared/types';

const pageContent: PageContent = {
  url: 'https://example.com',
  title: 'Readable Page',
  text: 'This is the page context.',
  paragraphs: ['This is the page context.'],
  detectedLang: 'en',
  contentType: 'article',
  extractedAt: 1,
};

describe('chat prompts', () => {
  it('stores only selected text in the user-visible selection message', () => {
    const message = wrapSelectionAsUserMessage('Manifest V3 lifecycle', 'zh');
    expect(message.content).toBe('Manifest V3 lifecycle');
    expect(message.fromSelection).toBe(true);
  });

  it('wraps selection messages only when building the LLM payload', () => {
    const selection = wrapSelectionAsUserMessage('Manifest V3 lifecycle', 'en');
    const messages = buildChatPrompt(pageContent, [selection], 'en');
    expect(messages[0].content).toContain('Readable Page');
    expect(messages[1].content).toContain('I selected this text');
    expect(messages[1].content).toContain('Manifest V3 lifecycle');
  });
});
