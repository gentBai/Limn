import { useState, useCallback } from 'react';
import type { SummarizeChunk, ErrorResponse, TokenUsage } from '@/shared/messages';

export type SummaryStatus = 'idle' | 'extracting' | 'streaming' | 'done' | 'error';

interface State {
  status: SummaryStatus;
  text: string;
  error: ErrorResponse | null;
  usage: TokenUsage | null;
}

export function useStreamingSummary() {
  const [state, setState] = useState<State>({ status: 'idle', text: '', error: null, usage: null });

  /** 从外部恢复状态（tab 切换时加载已保存的摘要） */
  const restore = useCallback((s: Partial<State>) => {
    setState((cur) => ({ ...cur, ...s }));
  }, []);

  const summarize = useCallback(async (tabId: number) => {
    setState({ status: 'extracting', text: '', error: null, usage: null });
    const port = chrome.runtime.connect({ name: `summarize:${tabId}` });
    port.onMessage.addListener((chunk: SummarizeChunk) => {
      if (chunk.kind === 'extracting') {
        setState((s) => ({ ...s, status: 'extracting' }));
      } else if (chunk.kind === 'streaming') {
        setState((s) => ({ ...s, status: 'streaming', text: s.text + chunk.delta }));
      } else if (chunk.kind === 'done') {
        setState({ status: 'done', text: chunk.full, error: null, usage: chunk.usage ?? null });
        port.disconnect();
      } else if (chunk.kind === 'error') {
        setState({ status: 'error', text: '', error: chunk.error, usage: null });
        port.disconnect();
      }
    });
  }, []);

  return { ...state, summarize, restore };
}
