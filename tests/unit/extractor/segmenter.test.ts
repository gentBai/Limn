import { describe, it, expect } from 'vitest';
import { segment } from '@/extractor/segmenter';

describe('segment', () => {
  it('splits by double newlines', () => {
    expect(segment('A\n\nB\n\nC')).toEqual(['A', 'B', 'C']);
  });
  it('collapses single newlines within a paragraph', () => {
    expect(segment('Line1\nLine2')).toEqual(['Line1 Line2']);
  });
  it('trims and filters empty', () => {
    expect(segment('A\n\n\n\n  \n\nB')).toEqual(['A', 'B']);
  });
});
