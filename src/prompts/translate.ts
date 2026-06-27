import type { ChatMessage } from '@/shared/types';

export function buildTranslatePrompt(text: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是专业翻译。将用户提供的文本翻译成简体中文。要求：' +
        '保留原文的代码块、列表、专有名词格式；术语准确；只输出译文，不加解释。',
    },
    { role: 'user', content: text },
  ];
}
