import { useState, useCallback, useRef } from 'react';
import type { ChatStreamChunk, ConversationMessage, ErrorResponse } from '@/shared/messages';

interface State {
  status: 'idle' | 'streaming' | 'error';
  /** The assistant reply being streamed (empty until first delta) */
  streamingReply: string;
  error: ErrorResponse | null;
}

export function useChat() {
  const [state, setState] = useState<State>({ status: 'idle', streamingReply: '', error: null });
  const replyRef = useRef('');

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
    const port = chrome.runtime.connect({ name: `chat:${tabId}:${mode}:${payload}` });
    port.onMessage.addListener((chunk: ChatStreamChunk) => {
      if (chunk.kind === 'userAdded') {
        onUserAdded(chunk.message);
      } else if (chunk.kind === 'streaming') {
        replyRef.current += chunk.delta;
        setState((s) => ({ ...s, streamingReply: replyRef.current }));
        onStreamingDelta(replyRef.current);
      } else if (chunk.kind === 'done') {
        setState({ status: 'idle', streamingReply: '', error: null });
        onDone(chunk.message);
        port.disconnect();
      } else if (chunk.kind === 'error') {
        setState({ status: 'error', streamingReply: '', error: chunk.error });
        port.disconnect();
      }
    });
  }, []);

  return { ...state, send };
}
