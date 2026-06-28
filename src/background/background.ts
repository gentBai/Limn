import { createLLMClient } from '@/llm/client-factory';
import { buildSummaryPrompt } from '@/prompts/summary';
import { buildTranslatePrompt } from '@/prompts/translate';
import { getActiveProviderSettings } from '@/storage';
import { handleTranslate } from './handlers/translate';
import { LLMError } from '@/llm/adapters/openai-compat';
import type { RequestMessage, SummarizeChunk, BackgroundEvent, TranslateStreamChunk, TranslationRecord } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';
import { initLocale, getLocale } from '@/i18n';
import { getErrorMessage } from '@/llm/error-messages';
import {
  getTabState,
  setPageContent,
  updateSummary,
  addTranslation,
  updateTranslation,
  clearTabState,
} from './tab-state';

// Initialize locale on service worker startup (browser language or user override)
initLocale();

// Cache: tabId -> PageContent (in-memory, avoids re-extraction wait)
const contentCache = new Map<number, any>();

async function extractFromTab(tabId: number): Promise<any> {
  const cached = contentCache.get(tabId);
  if (cached) return cached;
  let response: any;
  try {
    response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
  } catch (e: any) {
    console.error('[AI Reader] sendMessage to tab failed:', e?.message);
    throw new LLMError(ErrorCode.EXTRACTION_FAILED, getErrorMessage(ErrorCode.EXTRACTION_FAILED, getLocale()), false);
  }
  if (!response?.text) {
    console.error('[AI Reader] extract returned empty, response:', response);
    throw new LLMError(ErrorCode.EXTRACTION_FAILED, getErrorMessage(ErrorCode.EXTRACTION_FAILED, getLocale()), false);
  }
  contentCache.set(tabId, response);
  await setPageContent(tabId, response);
  return response;
}

function errChunk(code: ErrorCode, retryable = false): SummarizeChunk {
  return { kind: 'error', error: { code, message: getErrorMessage(code, getLocale()), retryable } };
}

function asError(e: any) {
  // LLMError carries a code; override message with localized text
  if (e?.code && typeof e.code === 'string') {
    return { code: e.code, message: getErrorMessage(e.code as ErrorCode, getLocale()), retryable: e.retryable ?? false };
  }
  if (typeof e?.toResponse === 'function') return e.toResponse();
  return { code: ErrorCode.MODEL_ERROR, message: e?.message ?? String(e), retryable: false };
}

/** Broadcast event to all sidepanels (sidepanel listens for BackgroundEvent) */
function broadcast(event: BackgroundEvent) {
  chrome.runtime.sendMessage(event).catch(() => {
    // Throws when no receiver; ignore (normal, sidepanel may not be open)
  });
}

// Standard request routing (non-streaming)
chrome.runtime.onMessage.addListener((req: RequestMessage | BackgroundEvent, sender, sendResponse) => {
  // BackgroundEvent is broadcast by background itself; do not handle own messages
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
    // content-script cannot know its own tabId; get it from sender.tab.id
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
        // Notify sidepanel of a new translation (if it is showing this tab)
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
      () => sendResponse({ type: 'ERROR', error: asError({ code: ErrorCode.MODEL_ERROR, message: getErrorMessage(ErrorCode.MODEL_ERROR, getLocale()), retryable: false }) })
    );
    return true;
  }
});

// Streaming summary: long-lived connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('summarize:')) {
    (async () => {
      const tabId = Number(port.name.split(':')[1]);
      try {
        const settings = await getActiveProviderSettings();
        if (!settings || !settings.apiKey) {
          await updateSummary(tabId, { status: 'error', error: { code: ErrorCode.MISSING_API_KEY, message: getErrorMessage(ErrorCode.MISSING_API_KEY, getLocale()), retryable: false } });
          port.postMessage(errChunk(ErrorCode.MISSING_API_KEY));
          return port.disconnect();
        }
        port.postMessage({ kind: 'extracting' });
        await updateSummary(tabId, { status: 'extracting', text: '', error: null });
        const content = await extractFromTab(tabId);
        const client = createLLMClient(settings);
        let full = '';
        let usage: { input: number; output: number } | undefined;
        for await (const c of client.stream({ messages: buildSummaryPrompt(content, getLocale()) })) {
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
        await updateSummary(tabId, { status: 'error', error: { code: ErrorCode.MODEL_ERROR, message: getErrorMessage(ErrorCode.MODEL_ERROR, getLocale()), retryable: false } });
        port.postMessage(errChunk(ErrorCode.MODEL_ERROR));
      } finally {
        port.disconnect();
      }
    })();
  }
  // Streaming translate: long-lived connection, port name format translate:<text> (tabId from sender)
  if (port.name.startsWith('translate:')) {
    const text = port.name.slice('translate:'.length);
    const tabId = port.sender?.tab?.id ?? 0;
    (async () => {
      try {
        const settings = await getActiveProviderSettings();
        if (!settings || !settings.apiKey) {
          port.postMessage({ kind: 'error', error: { code: ErrorCode.MISSING_API_KEY, message: getErrorMessage(ErrorCode.MISSING_API_KEY, getLocale()), retryable: false } });
          return port.disconnect();
        }
        // 1. Immediately create an empty record and broadcast
        const record: TranslationRecord = {
          id: `tr-${Date.now().toString(36)}`,
          source: text,
          target: '',
          at: Date.now(),
        };
        await addTranslation(tabId, record);
        broadcast({ type: 'TRANSLATION_ADDED', tabId, record });
        port.postMessage({ kind: 'created', record });

        // 2. Stream translate, update record per delta + broadcast + push to bubble
        const client = createLLMClient(settings);
        let target = '';
        for await (const c of client.stream({ messages: buildTranslatePrompt(text, getLocale()) })) {
          if (c.delta) {
            target += c.delta;
            await updateTranslation(tabId, record.id, { target });
            broadcast({ type: 'TRANSLATION_UPDATED', tabId, record: { ...record, target } });
            port.postMessage({ kind: 'streaming', delta: c.delta });
          }
        }
        // 3. Done
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

// Listen for tab activation (switch) — notify sidepanel to refresh
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  broadcast({ type: 'TAB_CHANGED', tabId: activeInfo.tabId });
});

// Listen for tab close — clean up its TabState
chrome.tabs.onRemoved.addListener((tabId) => {
  contentCache.delete(tabId);
  clearTabState(tabId);
});

// Open sidePanel on icon click
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
