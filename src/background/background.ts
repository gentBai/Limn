import { createLLMClient } from '@/llm/client-factory';
import { buildSummaryPrompt } from '@/prompts/summary';
import { buildChatPrompt, wrapSelectionAsUserMessage } from '@/prompts/chat';
import { getActiveProviderSettings } from '@/storage';
import { LLMError } from '@/llm/adapters/openai-compat';
import { hasRequiredCredentials } from '@/llm/provider-auth';
import type { RequestMessage, SummarizeChunk, BackgroundEvent, ChatStreamChunk, ConversationMessage } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';
import { initLocale, getLocale } from '@/i18n';
import { getErrorMessage } from '@/llm/error-messages';
import { getContentForChat, parseChatPortName } from './chat-flow';
import {
  getTabState,
  setPageContent,
  updateSummary,
  addChatMessage,
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

function errSummaryChunk(code: ErrorCode, retryable = false): SummarizeChunk {
  return { kind: 'error', error: { code, message: getErrorMessage(code, getLocale()), retryable } };
}

function errChatChunk(code: ErrorCode, retryable = false): ChatStreamChunk {
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

/** Push the latest chat history to sidepanel for a given tab */
async function broadcastChat(tabId: number) {
  const state = await getTabState(tabId);
  broadcast({ type: 'CHAT_UPDATED', tabId, messages: state.chat });
}

// Standard request routing (non-streaming)
chrome.runtime.onMessage.addListener((req: RequestMessage | BackgroundEvent, _sender, sendResponse) => {
  // BackgroundEvent is broadcast by background itself; do not handle own messages
  if (req && typeof req === 'object' && 'type' in req) {
    const t = (req as any).type;
    if (t === 'TAB_CHANGED' || t === 'CHAT_UPDATED') return;
  }

  const r = req as RequestMessage;
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

// Streaming summary: long-lived connection, port name format summarize:<tabId>
chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('summarize:')) {
    (async () => {
      const tabId = Number(port.name.split(':')[1]);
      try {
        const settings = await getActiveProviderSettings();
        if (!hasRequiredCredentials(settings)) {
          await updateSummary(tabId, { status: 'error', error: { code: ErrorCode.MISSING_API_KEY, message: getErrorMessage(ErrorCode.MISSING_API_KEY, getLocale()), retryable: false } });
          port.postMessage(errSummaryChunk(ErrorCode.MISSING_API_KEY));
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
        port.postMessage(errSummaryChunk(ErrorCode.MODEL_ERROR));
      } finally {
        port.disconnect();
      }
    })();
  }
  // Streaming chat: long-lived connection.
  // sidepanel format: chat:<tabId>:<mode>:<payload>
  // content-script legacy format: chat:<mode>:<payload>, tabId comes from sender.tab.id
  if (port.name.startsWith('chat:')) {
    const parsed = parseChatPortName(port.name, port.sender?.tab?.id);
    if (!parsed) {
      port.postMessage(errChatChunk(ErrorCode.MODEL_ERROR));
      port.disconnect();
      return;
    }
    const { tabId, mode, payload } = parsed;
    (async () => {
      try {
        const settings = await getActiveProviderSettings();
        if (!hasRequiredCredentials(settings)) {
          port.postMessage(errChatChunk(ErrorCode.MISSING_API_KEY));
          return port.disconnect();
        }

        const locale = getLocale();
        // 1. Build the user message and append to the conversation stream
        const userMessage: ConversationMessage = mode === 'selection'
          ? wrapSelectionAsUserMessage(payload, locale)
          : { role: 'user', content: payload, at: Date.now() };
        await addChatMessage(tabId, userMessage);
        // Notify: user message added
        port.postMessage({ kind: 'userAdded', message: userMessage });
        await broadcastChat(tabId);

        // 2. Load current state (page content + full history)
        const state = await getTabState(tabId);
        const content = await getContentForChat(tabId, contentCache.get(tabId), state, extractFromTab);
        const client = createLLMClient(settings);
        const messages = buildChatPrompt(content, state.chat, locale);

        // 3. Stream the assistant reply
        let reply = '';
        for await (const c of client.stream({ messages })) {
          if (c.delta) {
            reply += c.delta;
            port.postMessage({ kind: 'streaming', delta: c.delta });
          }
        }

        // 4. Append assistant reply to the stream, broadcast
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: reply,
          at: Date.now(),
        };
        await addChatMessage(tabId, assistantMessage);
        port.postMessage({ kind: 'done', message: assistantMessage });
        await broadcastChat(tabId);
      } catch (e: any) {
        console.error('[AI Reader] chat stream error:', e);
        port.postMessage(errChatChunk(ErrorCode.MODEL_ERROR));
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
