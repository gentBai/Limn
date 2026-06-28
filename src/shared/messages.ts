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

/** token usage */
export interface TokenUsage {
  input: number;
  output: number;
}

/** A single message in the conversation stream (single stream per tab).
 *  Distinct from the base ChatMessage in types.ts (which is for LLM API payloads);
 *  this one adds UI metadata (fromSelection, at). */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Whether triggered by text selection (for UI differentiation) */
  fromSelection?: boolean;
  at: number;
}

/** Summary state */
export interface SummaryState {
  status: 'idle' | 'extracting' | 'streaming' | 'done' | 'error';
  text: string;
  error: ErrorResponse | null;
  usage: TokenUsage | null;
}

/** Per-tab state isolated by tabId */
export interface TabState {
  tabId: number;
  pageContent: PageContent | null;
  summary: SummaryState;
  /** Single conversation stream: all selections and follow-ups chained together */
  chat: ConversationMessage[];
}

export type RequestMessage =
  | { type: 'EXTRACT_CONTENT'; tabId: number }
  | { type: 'SUMMARIZE'; tabId: number }
  | { type: 'GET_PAGE_CONTENT'; tabId: number }
  | { type: 'GET_TAB_STATE'; tabId: number };

/** Streaming summary chunk (with token usage) */
export type SummarizeChunk =
  | { kind: 'extracting' }
  | { kind: 'streaming'; delta: string }
  | { kind: 'done'; full: string; usage?: TokenUsage }
  | { kind: 'error'; error: ErrorResponse };

/** Streaming chat chunk (pushed via port to content-script bubble + sidepanel) */
export type ChatStreamChunk =
  | { kind: 'userAdded'; message: ConversationMessage }    // user message added to stream
  | { kind: 'streaming'; delta: string }                   // assistant reply delta
  | { kind: 'done'; message: ConversationMessage }         // assistant reply complete
  | { kind: 'error'; error: ErrorResponse };

/** Events broadcast from background to sidepanel */
export type BackgroundEvent =
  | { type: 'TAB_CHANGED'; tabId: number }
  | { type: 'CHAT_UPDATED'; tabId: number; messages: ConversationMessage[] };

export type ResponseMessage<T = unknown> =
  | { type: 'SUCCESS'; data: T }
  | { type: 'ERROR'; error: ErrorResponse };

export type ExtractResult = { content: PageContent };
