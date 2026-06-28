/**
 * English message resources
 * English version of all user-visible strings
 */

import type { Messages } from './zh';

export const en: Messages = {
  // Common
  'common.unconfigured': 'Not configured',
  'common.loading': 'Loading...',

  // Tab navigation
  'tab.summary': 'Summary',
  'tab.ask': 'Ask AI',

  // Summary view
  'summary.emptyTitle': 'Configure a model to get started',
  'summary.emptyDesc': 'Add your API key to start summarizing web pages. Data is stored only in your local browser.',
  'summary.emptyAction': 'Go to settings',
  'summary.generate': '⚡ Generate Summary',
  'summary.analyzing': 'Analyzing page content...',
  'summary.copy': '📋 Copy',
  'summary.regenerate': '🔄 Regenerate',
  'summary.tokens': '{total} tokens used',
  'summary.tokenDetail': 'Input {input} / Output {output}',

  // Ask view (merged translate + chat)
  'ask.emptyTitle': 'Ask AI',
  'ask.emptyDesc': 'Select any text on a web page and the AI will give you the gist and key points. You can also ask questions here directly — the AI answers based on the page content.',
  'ask.placeholder': 'Ask about the current page...',
  'ask.selectionTag': 'Selection',

  // Error handling
  'error.retry': 'Retry',
  'error.goSettings': 'Go to settings',

  // Selection bubble
  'bubble.ask': '🌐 Ask',
  'bubble.asking': 'Thinking',
  'bubble.failed': 'Interpretation failed',

  // Options page
  'options.title': 'Settings',
  'options.subtitle': 'Configure model access. Freely choose the protocol, fill in the endpoint URL and model name. API keys are stored only in your local browser.',
  'options.models': 'Model Configuration',
  'options.active': '● Active',
  'options.configured': 'Configured',
  'options.notConfigured': 'Not configured',
  'options.addFromTemplate': '+ Add from template',
  'options.addCustom': '+ New custom',
  'options.template': 'Template',
  'options.delete': '🗑 Delete',
  'options.setActive': 'Set as active',
  'options.enabled': 'Enabled',
  'options.labelName': 'Config name',
  'options.protocol': 'Protocol',
  'options.baseURL': 'Endpoint URL (Base URL)',
  'options.model': 'Model name',
  'options.apiKey': 'API Key',
  'options.show': 'Show',
  'options.hide': 'Hide',
  'options.save': 'Save settings',
  'options.saved': '✓ Saved',
  'options.lang': 'Interface language',
  'options.langAuto': 'Follow browser',

  // Provider protocol descriptions
  'protocol.openai-compat': 'OpenAI-compatible',
  'protocol.claude': 'Anthropic Claude',
  'protocol.ollama': 'Ollama',
  'protocol.openai-compat.desc': 'OpenAI / DeepSeek / Zhipu / Qwen / Kimi, etc.',
  'protocol.claude.desc': 'Claude official Messages API',
  'protocol.ollama.desc': 'Local model (localhost)',
  'hint.openai-compat': 'Up to the /v1 level, e.g. https://api.deepseek.com/v1',
  'hint.claude': 'Root domain only, e.g. https://api.anthropic.com',
  'hint.ollama': 'Local service address, e.g. http://localhost:11434',
  'hint.ollamaNote': '💡 Ollama requires no API key. Make sure Ollama is running locally and the model is pulled ({cmd}).',
  'placeholder.baseURL': 'https://api.example.com/v1',
  'placeholder.model': 'e.g. deepseek-chat / gpt-4o-mini / claude-3-5-sonnet-20241022',
  'placeholder.apiKey': 'sk-...',
  'placeholder.providerName': 'Untitled',

  // Built-in provider template labels (brand names kept, descriptions translated)
  'provider.openai': 'OpenAI',
  'provider.deepseek': 'DeepSeek',
  'provider.zhipu': 'Zhipu GLM',
  'provider.claude': 'Anthropic Claude',
  'provider.ollama': 'Ollama (local)',
  'provider.openai.hint': 'OpenAI official API',
  'provider.deepseek.hint': 'Cost-effective, OpenAI-compatible',
  'provider.zhipu.hint': 'OpenAI-compatible',
  'provider.claude.hint': 'Anthropic official Messages API',
  'provider.ollama.hint': 'Local model, data stays on-device',
};
