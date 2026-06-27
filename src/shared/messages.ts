import type { PageContent } from './types';

export enum ErrorCode {
  NO_PROVIDER_CONFIGURED = 'NO_PROVIDER_CONFIGURED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  MISSING_API_KEY = 'MISSING_API_KEY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  EMPTY_CONTENT = 'EMPTY_CONTENT',
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  MODEL_ERROR = 'MODEL_ERROR',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  PAGE_NOT_SUPPORTED = 'PAGE_NOT_SUPPORTED',
  OLLAMA_NOT_RUNNING = 'OLLAMA_NOT_RUNNING',
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

/** token 用量 */
export interface TokenUsage {
  input: number;
  output: number;
}

/** 单条翻译记录 */
export interface TranslationRecord {
  id: string;
  source: string;
  target: string;
  at: number;
}

/** 摘要状态 */
export interface SummaryState {
  status: 'idle' | 'extracting' | 'streaming' | 'done' | 'error';
  text: string;
  error: ErrorResponse | null;
  usage: TokenUsage | null;
}

/** 按 tabId 隔离的页面状态 */
export interface TabState {
  tabId: number;
  pageContent: PageContent | null;
  summary: SummaryState;
  translations: TranslationRecord[];
}

export type RequestMessage =
  | { type: 'EXTRACT_CONTENT'; tabId: number }
  | { type: 'SUMMARIZE'; tabId: number }
  | { type: 'TRANSLATE'; text: string }
  | { type: 'TRANSLATE_AND_RECORD'; tabId: number; text: string }
  | { type: 'GET_PAGE_CONTENT'; tabId: number }
  | { type: 'GET_TAB_STATE'; tabId: number };

/** 流式摘要 chunk（含 token 用量） */
export type SummarizeChunk =
  | { kind: 'extracting' }
  | { kind: 'streaming'; delta: string }
  | { kind: 'done'; full: string; usage?: TokenUsage }
  | { kind: 'error'; error: ErrorResponse };

/** 流式翻译 chunk（通过 port 推送给 content-script 气泡 + sidepanel 记录） */
export type TranslateStreamChunk =
  | { kind: 'created'; record: TranslationRecord }    // 空记录已建
  | { kind: 'streaming'; delta: string }              // 译文增量
  | { kind: 'done'; record: TranslationRecord }       // 完成（含最终译文）
  | { kind: 'error'; error: ErrorResponse };

/** background 主动推给 sidepanel 的事件 */
export type BackgroundEvent =
  | { type: 'TAB_CHANGED'; tabId: number }
  | { type: 'TRANSLATION_ADDED'; tabId: number; record: TranslationRecord }
  | { type: 'TRANSLATION_UPDATED'; tabId: number; record: TranslationRecord };

export type ResponseMessage<T = unknown> =
  | { type: 'SUCCESS'; data: T }
  | { type: 'ERROR'; error: ErrorResponse };

export type TranslateResult = { translated: string };
export type ExtractResult = { content: PageContent };
