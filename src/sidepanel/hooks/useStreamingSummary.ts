import { useState, useCallback, useRef } from 'react';
import type { SummarizeChunk, ErrorResponse, TokenUsage } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';
import { getLocale } from '@/i18n';
import { getErrorMessage } from '@/llm/error-messages';

export type SummaryStatus = 'idle' | 'extracting' | 'streaming' | 'done' | 'error';

interface State {
  status: SummaryStatus;
  text: string;
  error: ErrorResponse | null;
  usage: TokenUsage | null;
}

export function useStreamingSummary() {
  const [state, setState] = useState<State>({ status: 'idle', text: '', error: null, usage: null });
  // Track whether the stream ended normally so onDisconnect can distinguish a
  // clean close from a service-worker-killed drop.
  const settledRef = useRef(false);

  /** 从外部恢复状态（tab 切换时加载已保存的摘要） */
  const restore = useCallback((s: Partial<State>) => {
    setState((cur) => ({ ...cur, ...s }));
  }, []);

  const summarize = useCallback(async (tabId: number) => {
    setState({ status: 'extracting', text: '', error: null, usage: null });
    settledRef.current = false;
    const port = chrome.runtime.connect({ name: `summarize:${tabId}` });
    port.onMessage.addListener((chunk: SummarizeChunk) => {
      if (chunk.kind === 'extracting') {
        setState((s) => ({ ...s, status: 'extracting' }));
      } else if (chunk.kind === 'streaming') {
        setState((s) => ({ ...s, status: 'streaming', text: s.text + chunk.delta }));
      } else if (chunk.kind === 'done') {
        settledRef.current = true;
        setState({ status: 'done', text: chunk.full, error: null, usage: chunk.usage ?? null });
        port.disconnect();
      } else if (chunk.kind === 'error') {
        settledRef.current = true;
        setState({ status: 'error', text: '', error: chunk.error, usage: null });
        port.disconnect();
      }
    });
    // Service worker can be evicted mid-stream; surface a retryable error
    // instead of leaving the UI stuck in extracting/streaming forever.
    port.onDisconnect.addListener(() => {
      if (settledRef.current) return;
      setState({
        status: 'error',
        text: '',
        error: { code: ErrorCode.CONNECTION_CLOSED, message: getErrorMessage(ErrorCode.CONNECTION_CLOSED, getLocale()), retryable: true },
        usage: null,
      });
    });
  }, []);

  return { ...state, summarize, restore };
}
