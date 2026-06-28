import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt } from '@/prompts/summary';
import type { PageContent } from '@/shared/types';

const mockContent: PageContent = {
  url: 'https://x.com', title: 'Test', text: 'body content',
  paragraphs: ['body content'], detectedLang: 'en', contentType: 'article', extractedAt: 1,
};

describe('buildSummaryPrompt', () => {
  it('produces system + user messages with content embedded (zh)', () => {
    const msgs = buildSummaryPrompt(mockContent, 'zh');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('Test');
    expect(msgs[1].content).toContain('body content');
  });

  it('uses English system prompt when locale is en', () => {
    const msgs = buildSummaryPrompt(mockContent, 'en');
    expect(msgs[0].content).toContain('English');
    expect(msgs[1].content).toContain('Title:');
  });
});
