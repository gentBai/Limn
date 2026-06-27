export type ContentType = 'article' | 'github' | 'paper' | 'doc' | 'unknown';

export interface PageContent {
  url: string;
  title: string;
  text: string;
  paragraphs: string[];
  detectedLang: string;
  contentType: ContentType;
  extractedAt: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
