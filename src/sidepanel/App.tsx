import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { TabNav, type Tab } from './components/TabNav';
import { SummaryView } from './views/SummaryView';
import { TranslateView } from './views/TranslateView';
import { ChatView } from './views/ChatView';
import { loadSettings } from '@/storage';
import { useStreamingSummary } from './hooks/useStreamingSummary';
import type { BackgroundEvent, TranslationRecord } from '@/shared/messages';

export function App() {
  const [tab, setTab] = useState<Tab>('summary');
  const [tabId, setTabId] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [providerLabel, setProviderLabel] = useState('未配置');
  // 翻译记录按当前 tabId 显示（从 background 加载）
  const [translations, setTranslations] = useState<TranslationRecord[]>([]);

  // 摘要状态提升到 App 层：切 Tab 不丢失，切页面时从 background 恢复
  const summary = useStreamingSummary();

  // 加载配置
  useEffect(() => {
    loadSettings().then((s) => {
      const p = s.providers[s.activeProviderId];
      setConfigured(!!p?.apiKey || p?.protocol === 'ollama');
      setProviderLabel(p?.label ?? '未配置');
    });
  }, []);

  /** 加载指定 tab 的状态（摘要 + 翻译记录），切 tab 时调用 */
  const loadTabState = (id: number) => {
    if (!id) return;
    chrome.runtime.sendMessage({ type: 'GET_TAB_STATE', tabId: id }).then((res) => {
      if (res?.type !== 'SUCCESS') return;
      const ts = res.data;
      // 恢复摘要状态
      summary.restore({
        status: ts.summary.status,
        text: ts.summary.text,
        error: ts.summary.error,
        usage: ts.summary.usage,
      });
      // 恢复翻译记录
      setTranslations(ts.translations ?? []);
    });
  };

  // 初始化：获取当前 tab + 加载状态
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const id = tabs[0]?.id ?? 0;
      setTabId(id);
      loadTabState(id);
    });
  }, []);

  // 监听 tab 切换（background 广播）+ 翻译记录新增/更新
  useEffect(() => {
    const listener = (event: BackgroundEvent) => {
      if (event.type === 'TAB_CHANGED' && event.tabId !== tabId) {
        setTabId(event.tabId);
        loadTabState(event.tabId);
      } else if (event.type === 'TRANSLATION_ADDED' && event.tabId === tabId) {
        // 当前 tab 有新翻译，追加到列表头部
        setTranslations((prev) => [event.record, ...prev]);
      } else if (event.type === 'TRANSLATION_UPDATED' && event.tabId === tabId) {
        // 翻译流式更新，替换对应记录的 target
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
