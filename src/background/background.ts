import { createLLMClient } from '@/llm/client-factory';
import { buildSummaryPrompt } from '@/prompts/summary';
import { buildTranslatePrompt } from '@/prompts/translate';
import { getActiveProviderSettings } from '@/storage';
import { handleTranslate } from './handlers/translate';
import type { RequestMessage, SummarizeChunk, BackgroundEvent, TranslateStreamChunk, TranslationRecord } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';
import {
  getTabState,
  setPageContent,
  updateSummary,
  addTranslation,
  updateTranslation,
  clearTabState,
} from './tab-state';

// 缓存：tabId -> PageContent（内存级，避免重复抽取的等待）
const contentCache = new Map<number, any>();

async function extractFromTab(tabId: number): Promise<any> {
  const cached = contentCache.get(tabId);
  if (cached) return cached;
  let response: any;
  try {
    response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
  } catch (e: any) {
    console.error('[AI Reader] sendMessage to tab failed:', e?.message);
    throw new Error('无法连接到当前页面（页面可能不支持注入，或尚未加载完成）');
  }
  if (!response?.text) {
    console.error('[AI Reader] extract returned empty, response:', response);
    throw new Error('未能从当前页面提取到有效正文');
  }
  contentCache.set(tabId, response);
  // 同步持久化到 session，供 sidepanel 切回时取用
  await setPageContent(tabId, response);
  return response;
}

function errChunk(code: ErrorCode, message: string, retryable = false): SummarizeChunk {
  return { kind: 'error', error: { code, message, retryable } };
}

function asError(e: any) {
  if (typeof e?.toResponse === 'function') return e.toResponse();
  return { code: ErrorCode.MODEL_ERROR, message: e?.message ?? String(e), retryable: false };
}

/** 广播事件给所有 sidepanel（sidepanel 监听 BackgroundEvent） */
function broadcast(event: BackgroundEvent) {
  chrome.runtime.sendMessage(event).catch(() => {
    // 没有接收方时会抛错，忽略即可（正常情况，不是所有时刻都有 sidepanel 开着）
  });
}

// 普通请求路由（非流式）
chrome.runtime.onMessage.addListener((req: RequestMessage | BackgroundEvent, sender, sendResponse) => {
  // BackgroundEvent 是 background 自己广播的，background 不应处理自己发的消息
  if (req && typeof req === 'object' && 'type' in req) {
    const t = (req as any).type;
    if (t === 'TAB_CHANGED' || t === 'TRANSLATION_ADDED') return;
  }

  const r = req as RequestMessage;
  if (r.type === 'TRANSLATE') {
    handleTranslate(r.text).then(
      (data) => sendResponse({ type: 'SUCCESS', data }),
      (e: any) => sendResponse({ type: 'ERROR', error: asError(e) })
    );
    return true;
  }
  if (r.type === 'TRANSLATE_AND_RECORD') {
    // content-script 无法直接知道自己的 tabId，从 sender.tab.id 获取
    const tabId = sender.tab?.id ?? r.tabId;
    (async () => {
      try {
        const data = await handleTranslate(r.text);
        const record = {
          id: `tr-${Date.now().toString(36)}`,
          source: r.text,
          target: data.translated,
          at: Date.now(),
        };
        await addTranslation(tabId, record);
        // 通知 sidepanel 有新翻译（如果它正显示该 tab）
        broadcast({ type: 'TRANSLATION_ADDED', tabId, record });
        sendResponse({ type: 'SUCCESS', data });
      } catch (e: any) {
        sendResponse({ type: 'ERROR', error: asError(e) });
      }
    })();
    return true;
  }
  if (r.type === 'GET_PAGE_CONTENT') {
    extractFromTab(r.tabId).then(
      (content) => sendResponse({ type: 'SUCCESS', data: { content } }),
      (e: any) => sendResponse({ type: 'ERROR', error: asError(e) })
    );
    return true;
  }
  if (r.type === 'GET_TAB_STATE') {
    getTabState(r.tabId).then(
      (state) => sendResponse({ type: 'SUCCESS', data: state }),
      () => sendResponse({ type: 'ERROR', error: asError(new Error('读取状态失败')) })
    );
    return true;
  }
});

// 流式摘要：长连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('summarize:')) {
    (async () => {
      const tabId = Number(port.name.split(':')[1]);
      try {
        const settings = await getActiveProviderSettings();
        if (!settings || !settings.apiKey) {
          await updateSummary(tabId, { status: 'error', error: { code: ErrorCode.MISSING_API_KEY, message: '尚未配置 API Key', retryable: false } });
          port.postMessage(errChunk(ErrorCode.MISSING_API_KEY, '尚未配置 API Key'));
          return port.disconnect();
        }
        port.postMessage({ kind: 'extracting' });
        await updateSummary(tabId, { status: 'extracting', text: '', error: null });
        const content = await extractFromTab(tabId);
        const client = createLLMClient(settings);
        let full = '';
        let usage: { input: number; output: number } | undefined;
        for await (const c of client.stream({ messages: buildSummaryPrompt(content) })) {
          if (c.delta) {
            full += c.delta;
            port.postMessage({ kind: 'streaming', delta: c.delta });
          }
          if (c.usage) usage = c.usage;
        }
        await updateSummary(tabId, { status: 'done', text: full, usage: usage ?? null });
        port.postMessage({ kind: 'done', full, usage });
      } catch (e: any) {
        console.error('[AI Reader] summarize error:', e);
        await updateSummary(tabId, { status: 'error', error: { code: ErrorCode.MODEL_ERROR, message: e?.message ?? '生成失败', retryable: false } });
        port.postMessage(errChunk(ErrorCode.MODEL_ERROR, e?.message ?? '生成失败'));
      } finally {
        port.disconnect();
      }
    })();
  }
  // 流式翻译：长连接，port 名格式 translate:<text>（tabId 从 sender 获取）
  if (port.name.startsWith('translate:')) {
    const text = port.name.slice('translate:'.length);
    const tabId = port.sender?.tab?.id ?? 0;
    (async () => {
      try {
        const settings = await getActiveProviderSettings();
        if (!settings || !settings.apiKey) {
          port.postMessage({ kind: 'error', error: { code: ErrorCode.MISSING_API_KEY, message: '尚未配置 API Key', retryable: false } });
          return port.disconnect();
        }
        // 1. 立即建空记录并广播
        const record: TranslationRecord = {
          id: `tr-${Date.now().toString(36)}`,
          source: text,
          target: '',
          at: Date.now(),
        };
        await addTranslation(tabId, record);
        broadcast({ type: 'TRANSLATION_ADDED', tabId, record });
        port.postMessage({ kind: 'created', record });

        // 2. 流式翻译，逐 delta 更新记录 + 广播 + 推给气泡
        const client = createLLMClient(settings);
        let target = '';
        for await (const c of client.stream({ messages: buildTranslatePrompt(text) })) {
          if (c.delta) {
            target += c.delta;
            await updateTranslation(tabId, record.id, { target });
            broadcast({ type: 'TRANSLATION_UPDATED', tabId, record: { ...record, target } });
            port.postMessage({ kind: 'streaming', delta: c.delta });
          }
        }
        // 3. 完成
        const finalRecord = { ...record, target };
        await updateTranslation(tabId, record.id, { target });
        broadcast({ type: 'TRANSLATION_UPDATED', tabId, record: finalRecord });
        port.postMessage({ kind: 'done', record: finalRecord });
      } catch (e: any) {
        console.error('[AI Reader] translate stream error:', e);
        port.postMessage({ kind: 'error', error: asError(e) });
      } finally {
        port.disconnect();
      }
    })();
  }
});

// 监听标签页激活（切换）——通知 sidepanel 刷新
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  broadcast({ type: 'TAB_CHANGED', tabId: activeInfo.tabId });
});

// 监听标签页关闭——清理对应的 TabState
chrome.tabs.onRemoved.addListener((tabId) => {
  contentCache.delete(tabId);
  clearTabState(tabId);
});

// 点击图标打开 sidePanel
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
