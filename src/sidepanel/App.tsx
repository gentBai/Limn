import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { TabNav, type Tab } from './components/TabNav';
import { SummaryView } from './views/SummaryView';
import { TranslateView } from './views/TranslateView';
import { ChatView } from './views/ChatView';
import { loadSettings } from '@/storage';
import { useStreamingSummary } from './hooks/useStreamingSummary';
import { t } from '@/i18n';
import type { BackgroundEvent, TranslationRecord } from '@/shared/messages';

export function App() {
  const [tab, setTab] = useState<Tab>('summary');
  const [tabId, setTabId] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [providerLabel, setProviderLabel] = useState(t('common.unconfigured'));
  // Translation records shown for the current tabId (loaded from background)
  const [translations, setTranslations] = useState<TranslationRecord[]>([]);

  // Summary state lifted to App: not lost on tab switch, restored from background on page switch
  const summary = useStreamingSummary();

  // Load config
  useEffect(() => {
    loadSettings().then((s) => {
      const p = s.providers[s.activeProviderId];
      setConfigured(!!p?.apiKey || p?.protocol === 'ollama');
      setProviderLabel(p?.label ?? t('common.unconfigured'));
    });
  }, []);

  /** 加载指定 tab 的状态（摘要 + 翻译记录），切 tab 时调用 */
  const loadTabState = (id: number) => {
    if (!id) return;
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATE', tabId: id }).then((res) => {
      if (res?.type !== 'SUCCESS') return;
      const ts = res.data;
      // restore summary state
      summary.restore({
        status: ts.summary.status,
        text: ts.summary.text,
        error: ts.summary.error,
        usage: ts.summary.usage,
      });
      // restore translation records
      setTranslations(ts.translations ?? []);
    });
  };

  // Init: get current tab + load state
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id ?? 0;
      setTabId(id);
      loadTabState(id);
    });
  }, []);

  // Listen for tab switch (background broadcast) + translation add/update
  useEffect(() => {
    const listener = (event: BackgroundEvent) => {
      if (event.type === 'TAB_CHANGED' && event.tabId !== tabId) {
        setTabId(event.tabId);
        loadTabState(event.tabId);
      } else if (event.type === 'TRANSLATION_ADDED' && event.tabId === tabId) {
        // new translation on current tab, prepend to list
        setTranslations((prev) => [event.record, ...prev]);
      } else if (event.type === 'TRANSLATION_UPDATED' && event.tabId === tabId) {
        // translation streaming update, replace the matching record target
        setTranslations((prev) =>
          prev.map((t) => (t.id === event.record.id ? event.record : t))
        );
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [tabId]);

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
        {tab === 'translate' && <TranslateView translations={translations} />}
        {tab === 'chat' && <ChatView />}
      </main>
    </>
  );
}
