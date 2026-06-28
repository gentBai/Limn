/**
 * Error code → localized message mapping.
 * Adapters throw ErrorCode; the display layer translates it via getErrorMessage().
 */
import { ErrorCode } from '@/shared/messages';
import type { Locale } from '@/i18n';

const messages: Record<Locale, Record<ErrorCode, string>> = {
  zh: {
    [ErrorCode.NO_PROVIDER_CONFIGURED]: '尚未配置模型提供商',
    [ErrorCode.INVALID_API_KEY]: 'API Key 无效或已过期',
    [ErrorCode.MISSING_API_KEY]: '尚未配置 API Key',
    [ErrorCode.NETWORK_ERROR]: '网络连接失败',
    [ErrorCode.PROVIDER_TIMEOUT]: '请求超时',
    [ErrorCode.RATE_LIMITED]: '请求过于频繁，请稍后再试',
    [ErrorCode.EXTRACTION_FAILED]: '未能从当前页面提取到有效正文',
    [ErrorCode.EMPTY_CONTENT]: '当前页面无有效正文',
    [ErrorCode.CONTENT_TOO_LONG]: '内容过长，已自动截断',
    [ErrorCode.MODEL_ERROR]: '模型服务返回错误',
    [ErrorCode.CONTEXT_LENGTH_EXCEEDED]: '内容超出模型上下文长度',
    [ErrorCode.PAGE_NOT_SUPPORTED]: '当前页面不支持（浏览器内置页面）',
    [ErrorCode.OLLAMA_NOT_RUNNING]: '本地模型服务未运行，请检查 Ollama 是否已启动',
  },
  en: {
    [ErrorCode.NO_PROVIDER_CONFIGURED]: 'No model provider configured',
    [ErrorCode.INVALID_API_KEY]: 'API key is invalid or expired',
    [ErrorCode.MISSING_API_KEY]: 'No API key configured',
    [ErrorCode.NETWORK_ERROR]: 'Network connection failed',
    [ErrorCode.PROVIDER_TIMEOUT]: 'Request timed out',
    [ErrorCode.RATE_LIMITED]: 'Too many requests, please try again later',
    [ErrorCode.EXTRACTION_FAILED]: 'Failed to extract valid content from this page',
    [ErrorCode.EMPTY_CONTENT]: 'No valid content on this page',
    [ErrorCode.CONTENT_TOO_LONG]: 'Content too long, automatically truncated',
    [ErrorCode.MODEL_ERROR]: 'Model service returned an error',
    [ErrorCode.CONTEXT_LENGTH_EXCEEDED]: 'Content exceeds the model context length',
    [ErrorCode.PAGE_NOT_SUPPORTED]: 'This page is not supported (browser built-in page)',
    [ErrorCode.OLLAMA_NOT_RUNNING]: 'Local model service is not running. Make sure Ollama is started.',
  },
};

export function getErrorMessage(code: ErrorCode, locale: Locale): string {
  return messages[locale]?.[code] ?? messages.zh[code] ?? code;
}
