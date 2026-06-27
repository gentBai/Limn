import type { PageContent, ContentType } from '@/shared/types';
import { extractReadable } from './readability';
import { segment } from './segmenter';
import { detectLang } from './lang-detect';

const MAX_CHARS = 12000;

function guessContentType(url: string): ContentType {
  if (/github\.com/.test(url)) return 'github';
  if (/arxiv\.org/.test(url)) return 'paper';
  return 'article';
}

export function extractPageContent(document: Document, url: string): PageContent {
  const { title, text } = extractReadable(document);
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  return {
    url,
    title,
    text: truncated,
    paragraphs: segment(truncated),
    detectedLang: detectLang(truncated),
    contentType: guessContentType(url),
    extractedAt: Date.now(),
  };
}
