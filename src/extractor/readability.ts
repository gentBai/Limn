import { Readability } from '@mozilla/readability';

export interface ReadableResult {
  title: string;
  text: string;
}

export function extractReadable(document: Document): ReadableResult {
  // Readability mutates the passed document, so clone it
  const docClone = document.cloneNode(true) as Document;
  const article = new Readability(docClone).parse();
  const text = article?.textContent?.trim() ?? '';
  // Readability may return an empty title for short pages or pages without <title>,
  // fall back to document.title, first h1, then first line of textContent
  let title = article?.title?.trim() || document.title?.trim() || '';
  if (!title) {
    const h1 = document.querySelector('h1');
    if (h1?.textContent?.trim()) title = h1.textContent.trim();
    else if (text) title = text.split('\n')[0].trim().slice(0, 100);
  }
  return { title, text };
}
