import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('static UI contracts', () => {
  it('options page has a small-width layout override', () => {
    const css = readFileSync('src/options/styles/options.css', 'utf8');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('flex-direction: column');
  });

  it('sidepanel logo imports public assets from the served root path', () => {
    const header = readFileSync('src/sidepanel/components/Header.tsx', 'utf8');
    const askView = readFileSync('src/sidepanel/views/AskView.tsx', 'utf8');
    expect(header).not.toContain('../../../public/icons');
    expect(askView).not.toContain('../../../public/icons');
    expect(header).toContain('/icons/icon.svg?url');
    expect(askView).toContain('/icons/icon.svg?url');
  });
});
