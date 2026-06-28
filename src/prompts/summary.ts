import type { ChatMessage, PageContent } from '@/shared/types';
import type { Locale } from '@/i18n';

/**
 * Build summary prompt.
 * Output language follows the UI locale: Chinese summary in zh, English summary in en.
 */
export function buildSummaryPrompt(content: PageContent, locale: Locale): ChatMessage[] {
  if (locale === 'en') {
    return [
      {
        role: 'system',
        content:
          'You are a professional content summarization assistant. Based on the web content provided by the user, ' +
          'produce a structured summary in English. Output strictly in the following format:\n\n' +
          '【Core Ideas】\nSummarize the main points in 2-3 bullet points, one per line, starting with "· ".\n\n' +
          '【Key Points】\nList 2-4 key technical details or data points, one per line, starting with "· ".\n\n' +
          '【Who Should Read】\nOne sentence describing the target audience. Output nothing else.',
      },
      {
        role: 'user',
        content: `Title: ${content.title}\n\nBody:\n${content.text}`,
      },
    ];
  }
  return [
    {
      role: 'system',
      content:
        '你是专业的资讯摘要助手。请基于用户提供的网页内容，输出结构化中文摘要。' +
        '严格按以下格式输出：\n\n' +
        '【核心观点】\n用 2-3 个要点概括文章主旨，每点一行，以 "· " 开头。\n\n' +
        '【关键要点】\n列出 2-4 个关键技术细节或数据，每点一行，以 "· " 开头。\n\n' +
        '【适用人群】\n一句话说明适合谁阅读。不要输出其他内容。',
    },
    {
      role: 'user',
      content: `标题：${content.title}\n\n正文：\n${content.text}`,
    },
  ];
}
