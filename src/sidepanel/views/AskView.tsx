import { useState, useRef, useEffect } from 'react';
import type { ConversationMessage } from '@/shared/messages';
import { t } from '@/i18n';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import type { ErrorResponse } from '@/shared/messages';
import logoUrl from '../../../public/icons/icon.svg?url';

/** AI avatar: the Limn logo for AI messages, emoji for the user */
function Avatar({ role }: { role: 'user' | 'assistant' | 'system' }) {
  if (role === 'user') {
    return <div className="chat-msg-avatar user">🧑</div>;
  }
  return <img className="chat-msg-avatar ai" src={logoUrl} alt="Limn" />;
}

interface AskViewProps {
  tabId: number;
  configured: boolean;
  messages: ConversationMessage[];
  /** status of an in-flight assistant reply (set by App, drives the streaming bubble) */
  streamingStatus: 'idle' | 'streaming' | 'error';
  streamingReply: string;
  streamingError: ErrorResponse | null;
  /** called when the user submits a question in the sidebar */
  onAsk: (question: string) => void;
  onRetry: () => void;
}

function formatTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AskView({
  configured,
  messages,
  streamingStatus,
  streamingReply,
  streamingError,
  onAsk,
  onRetry,
}: AskViewProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingStatus, streamingReply]);

  if (!configured) {
    return (
      <EmptyState
        icon="🔑"
        title={t('summary.emptyTitle')}
        desc={t('summary.emptyDesc')}
        actionLabel={t('summary.emptyAction')}
        onAction={() => chrome.runtime.openOptionsPage()}
      />
    );
  }

  if (messages.length === 0 && streamingStatus === 'idle') {
    return (
      <EmptyState
        icon="💬"
        title={t('ask.emptyTitle')}
        desc={t('ask.emptyDesc')}
      />
    );
  }

  // When the last message is from the user and we're not streaming a sidebar reply,
  // the assistant is thinking (e.g. after a selection). Show a pending bubble so the
  // user sees the AI received the message.
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === 'user';
  const showPending = lastIsUser && streamingStatus !== 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || streamingStatus === 'streaming') return;
    onAsk(q);
    setInput('');
  };

  return (
    <div className="ask-layout">
      <div className="ask-messages" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.role === 'user' ? 'user' : 'ai'}`}>
            <div className="chat-msg-avatar-wrapper">
              <Avatar role={m.role} />
            </div>
            <div className="chat-msg-body">
              {m.role === 'user' && m.fromSelection && (
                <span className="chat-msg-tag">{t('ask.selectionTag')}</span>
              )}
              <div className={`chat-msg-bubble chat-msg-bubble-${m.role === 'user' ? 'user' : 'ai'}`}>
                {m.content}
              </div>
              <span className="chat-msg-time">{formatTime(m.at)}</span>
            </div>
          </div>
        ))}

        {/* assistant thinking/replying bubble.
            Covers both sidebar follow-ups (streaming) and selections (pending):
            - no reply yet -> 'Thinking' + dots animation
            - reply streaming in -> the accumulating text */}
        {(streamingStatus === 'streaming' || showPending) && (
          <div className="chat-msg chat-msg-ai">
            <div className="chat-msg-avatar-wrapper">
              <Avatar role="assistant" />
            </div>
            <div className="chat-msg-body">
              <div className={`chat-msg-bubble chat-msg-bubble-ai${!streamingReply ? ' chat-msg-pending' : ''}`}>
                {streamingReply || t('ask.thinking')}
              </div>
            </div>
          </div>
        )}

        {streamingStatus === 'error' && streamingError && (
          <ErrorBox
            code={streamingError.code}
            message={streamingError.message}
            onRetry={onRetry}
          />
        )}
      </div>

      <form className="ask-input-area" onSubmit={handleSubmit}>
        <textarea
          className="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('ask.placeholder')}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          className="ask-send-btn"
          disabled={!input.trim() || streamingStatus === 'streaming'}
        >
          ➤
        </button>
      </form>
    </div>
  );
}
