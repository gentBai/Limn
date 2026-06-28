import type { ChatMessage } from '@/shared/types';
import type { PageContent } from '@/shared/types';
import type { Locale } from '@/i18n';
import type { ConversationMessage } from '@/shared/messages';

/**
 * Build the system prompt for chat.
 * Sets the assistant as a reading helper that can interpret selected text
 * and answer follow-up questions based on the page content.
 */
function buildSystemPrompt(pageContent: PageContent | null, locale: Locale): string {
  const langLine = locale === 'en'
    ? 'Respond in English.'
    : '请用中文回复。';

  const formatLine = locale === 'en'
    ? 'When the user selects text, interpret it in this format:\n' +
      '【Gist】\nOne sentence summarizing the selected content.\n\n' +
      '【Key Points】\nList 2-4 key points, one per line starting with "· ".'
    : '当用户选中文字时，按以下格式解读：\n' +
      '【大意】\n一句话概括选中内容的主旨。\n\n' +
      '【关键信息】\n列出 2-4 个关键信息点，每点一行，以 "· " 开头。';

  const pageLine = pageContent
    ? (locale === 'en'
        ? `\n\nThe user is reading this page (use it as context if relevant):\nTitle: ${pageContent.title}\n\n${pageContent.text.slice(0, 4000)}`
        : `\n\n用户正在阅读这个页面（相关时作为上下文使用）：\n标题：${pageContent.title}\n\n${pageContent.text.slice(0, 4000)}`)
    : '';

  return locale === 'en'
    ? `You are an AI reading assistant embedded in a browser extension. You help the user understand web content. ${langLine}\n\n${formatLine}\n\nFor regular follow-up questions, answer directly and concisely.${pageLine}`
    : `你是一个浏览器扩展里的 AI 阅读助手，帮助用户理解网页内容。${langLine}\n\n${formatLine}\n\n对于普通的追问，直接简洁地回答。${pageLine}`;
}

/**
 * Build the full message list for a chat request (LLM API payload).
 * - system: reading-assistant instructions + page content as context
 * - history: prior conversation messages (converted to base ChatMessage)
 * Returns base ChatMessage[] (role/content only) for the LLM API.
 */
export function buildChatPrompt(
  pageContent: PageContent | null,
  history: ConversationMessage[],
  locale: Locale
): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt(pageContent, locale),
  };
  // Strip UI metadata (fromSelection, at) when sending to the LLM API
  const historyBase: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  return [system, ...historyBase];
}

/**
 * Wrap a selected text snippet into a user conversation message.
 * The wrapper tells the model that this is a selection to interpret,
 * not a free-form question.
 */
export function wrapSelectionAsUserMessage(text: string, locale: Locale): ConversationMessage {
  const content = locale === 'en'
    ? `I selected this text, please interpret it:\n\n${text}`
    : `我选中了这段文字，请解读一下：\n\n${text}`;
  return {
    role: 'user',
    content,
    fromSelection: true,
    at: Date.now(),
  };
}
