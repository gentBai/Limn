import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPageContent } from '@/extractor';

const articleHtml = readFileSync(join(__dirname, '../../fixtures/article.html'), 'utf-8');

describe('extractPageContent', () => {
  it('returns full PageContent object', () => {
    const doc = new DOMParser().parseFromString(articleHtml, 'text/html');
    const result = extractPageContent(doc, 'https://example.com/news');
    expect(result.url).toBe('https://example.com/news');
    expect(result.title).toContain('OpenAI');
    expect(result.detectedLang).toBe('en');
    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.contentType).toBe('article');
    expect(result.extractedAt).toBeGreaterThan(0);
  });
});
