import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '@/sidepanel/components/Markdown';

describe('Markdown', () => {
  it('renders bold syntax into <strong>', () => {
    const { container } = render(<Markdown content="This is **bold** text" />);
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders fenced code blocks into <pre><code>', () => {
    const { container } = render(<Markdown content={'```\nconsole.log(1)\n```'} />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')).not.toBeNull();
  });

  it('renders inline code into <code>', () => {
    const { container } = render(<Markdown content="use the `map` function" />);
    expect(container.querySelector('code')?.textContent).toBe('map');
  });

  it('renders headings and lists', () => {
    const { container } = render(<Markdown content={'# Title\n\n- one\n- two'} />);
    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('strips <script> tags from rendered output', () => {
    const { container } = render(
      <Markdown content={'Hello\n\n<script>alert("xss")</script>\n\nWorld'} />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('World');
  });

  it('strips inline event handlers from raw HTML', () => {
    const { container } = render(
      <Markdown content={'<img src="x" onerror="alert(1)" alt="pic" />'} />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('onerror')).toBeNull();
  });
});
