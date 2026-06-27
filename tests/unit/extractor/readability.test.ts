import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractReadable } from '@/extractor/readability';

const articleHtml = readFileSync(join(__dirname, '../../fixtures/article.html'), 'utf-8');

describe('extractReadable', () => {
  it('extracts main article and drops nav/footer', () => {
    const doc = new DOMParser().parseFromString(articleHtml, 'text/html');
    const result = extractReadable(doc);
    expect(result.title).toContain('OpenAI announces GPT-5');
    expect(result.text).toContain('state-of-the-art');
    expect(result.text).not.toContain('Home About Contact');  // nav 被剔除
    expect(result.text).not.toContain('© 2026 News Site');    // footer 被剔除
  });
});
