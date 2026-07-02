import { useState, useCallback, useRef } from 'react';
import type { ChatStreamChunk, ConversationMessage, ErrorResponse } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';
import { getLocale } from '@/i18n';
import { getErrorMessage } from '@/llm/error-messages';

interface State {
  status: 'idle' | 'streaming' | 'error';
  /** The assistant reply being streamed (empty until first delta) */
  streamingReply: string;
  error: ErrorResponse | null;
}

export function useChat() {
  const [state, setState] = useState<State>({ status: 'idle', streamingReply: '', error: null });
  const replyRef = useRef('');
  // True once the stream completed (done/error) so onDisconnect stays quiet.
  const settledRef = useRef(false);

  /** Send a message (selection or question) via the chat port.
   *  Returns the final messages array via onDone callback. */
  const send = useCallback((
    tabId: number,
    mode: 'selection' | 'question',
    payload: string,
    onUserAdded: (msg: ConversationMessage) => void,
    onStreamingDelta: (partial: string) => void,
    onDone: (msg: ConversationMessage) => void,
  ) => {
    setState({ status: 'streaming', streamingReply: '', error: null });
    replyRef.current = '';
    settledRef.current = false;
    const port = chrome.runtime.connect({ name: `chat:${tabId}:${mode}:${payload}` });
    port.onMessage.addListener((chunk: ChatStreamChunk) => {
      if (chunk.kind === 'userAdded') {
        onUserAdded(chunk.message);
      } else if (chunk.kind === 'streaming') {
        replyRef.current += chunk.delta;
        setState((s) => ({ ...s, streamingReply: replyRef.current }));
        onStreamingDelta(replyRef.current);
      } else if (chunk.kind === 'done') {
        settledRef.current = true;
        setState({ status: 'idle', streamingReply: '', error: null });
        onDone(chunk.message);
        port.disconnect();
      } else if (chunk.kind === 'error') {
        settledRef.current = true;
        setState({ status: 'error', streamingReply: '', error: chunk.error });
        port.disconnect();
      }
    });
    // If the port drops without a done/error chunk (service worker evicted),
    // surface a retryable error so the UI doesn't freeze on "streaming".
    port.onDisconnect.addListener(() => {
      if (settledRef.current) return;
      setState({
        status: 'error',
        streamingReply: '',
        error: { code: ErrorCode.CONNECTION_CLOSED, message: getErrorMessage(ErrorCode.CONNECTION_CLOSED, getLocale()), retryable: true },
      });
    });
  }, []);

  return { ...state, send };
}
