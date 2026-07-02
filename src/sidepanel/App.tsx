import { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { TabNav, type Tab } from './components/TabNav';
import { SummaryView } from './views/SummaryView';
import { AskView } from './views/AskView';
import { loadSettings } from '@/storage';
import { useStreamingSummary } from './hooks/useStreamingSummary';
import { useChat } from './hooks/useChat';
import { t } from '@/i18n';
import type { BackgroundEvent, ConversationMessage } from '@/shared/messages';

export function App() {
  const [tab, setTab] = useState<Tab>('summary');
  const [tabId, setTabId] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [providerLabel, setProviderLabel] = useState(t('common.unconfigured'));
  // Conversation messages (single stream per tab)
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Summary state lifted to App: not lost on tab switch, restored from background on page switch
  const summary = useStreamingSummary();
  const chat = useChat();
  // remember the last question for retry
  const [lastQuestion, setLastQuestion] = useState('');

  // Load config
  useEffect(() => {
    loadSettings().then((s) => {
      const p = s.providers[s.activeProviderId];
      setConfigured(!!p?.apiKey || p?.protocol === 'ollama');
      setProviderLabel(p?.label ?? t('common.unconfigured'));
    });
  }, []);

  /** Load the state for a given tab (summary + chat), called on tab switch */
  const loadTabState = useCallback((id: number) => {
    if (!id) return;
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATE', tabId: id }).then((res) => {
      if (res?.type !== 'SUCCESS') return;
      const ts = res.data;
      summary.restore({
        status: ts.summary.status,
        text: ts.summary.text,
        error: ts.summary.error,
        usage: ts.summary.usage,
      });
      setMessages(ts.chat ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Init: get current tab + load state. Retry a few times because, right after
  // the service worker wakes up, tabs.query can momentarily return no active tab.
  useEffect(() => {
    let cancelled = false;
    const resolveActiveTab = async () => {
      for (const delay of [0, 200, 400]) {
        await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          setTabId(tab.id);
          loadTabState(tab.id);
          return;
        }
      }
      // Fallback: keep tabId 0 (UI shows empty state rather than erroring).
    };
    resolveActiveTab();
    return () => { cancelled = true; };
  }, [loadTabState]);

  // Listen for tab switch (background broadcast) + chat updates
  useEffect(() => {
    const listener = (event: BackgroundEvent) => {
      if (event.type === 'TAB_CHANGED' && event.tabId !== tabId) {
        setTabId(event.tabId);
        loadTabState(event.tabId);
      } else if (event.type === 'CHAT_UPDATED' && event.tabId === tabId) {
        // Real-time refresh from background (e.g. a selection interpretation finished)
        setMessages(event.messages);
        // Auto-switch to the Ask tab so the user sees the conversation (e.g. after a selection)
        setTab('ask');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId, loadTabState]);

  /** Send a follow-up question from the sidebar */
  const handleAsk = useCallback((question: string) => {
    setLastQuestion(question);
    chat.send(
      tabId,
      'question',
      question,
      // onUserAdded: optimistic local append
      (userMsg) => setMessages((prev) => [...prev, userMsg]),
      // onStreamingDelta: streaming handled by chat.status/streamingReply in render
      () => {},
      // onDone: append the assistant reply (the CHAT_UPDATED broadcast will also fire)
      (assistantMsg) => setMessages((prev) => [...prev, assistantMsg]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, chat]);

  const handleRetry = useCallback(() => {
    if (lastQuestion) handleAsk(lastQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastQuestion, handleAsk]);

  return (
    <>
      <Header providerLabel={providerLabel} />
      <TabNav active={tab} onChange={setTab} />
      <main className="sp-main">
        {tab === 'summary' && (
          <SummaryView
            tabId={tabId}
            configured={configured}
            status={summary.status}
            text={summary.text}
            error={summary.error}
            usage={summary.usage}
            summarize={summary.summarize}
          />
        )}
        {tab === 'ask' && (
          <AskView
            tabId={tabId}
            configured={configured}
            messages={messages}
            streamingStatus={chat.status}
            streamingReply={chat.streamingReply}
            streamingError={chat.error}
            onAsk={handleAsk}
            onRetry={handleRetry}
          />
        )}
      </main>
    </>
  );
}
