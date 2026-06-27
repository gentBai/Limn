import { describe, it, expect } from 'vitest';
import { detectLang } from '@/extractor/lang-detect';

describe('detectLang', () => {
  it('returns zh for Chinese text', () => {
    expect(detectLang('这是一段中文文本')).toBe('zh');
  });
  it('returns en for English text', () => {
    expect(detectLang('This is an English sentence.')).toBe('en');
  });
  it('returns unknown for empty', () => {
    expect(detectLang('')).toBe('unknown');
  });
});
