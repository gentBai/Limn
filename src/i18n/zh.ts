/**
 * 中文文案资源
 * 所有用户可见字符串的中文版本
 */

export const zh = {
  // Common
  'common.unconfigured': '未配置',
  'common.loading': '加载中...',

  // Tab navigation
  'tab.summary': '摘要',
  'tab.translate': '翻译',
  'tab.chat': '对话',

  // Summary view
  'summary.emptyTitle': '开始使用前需配置模型',
  'summary.emptyDesc': '添加你的 API Key 即可开始摘要网页内容。数据仅存储在本地浏览器。',
  'summary.emptyAction': '前往配置',
  'summary.generate': '⚡ 一键生成摘要',
  'summary.analyzing': '正在分析网页内容...',
  'summary.copy': '📋 复制',
  'summary.regenerate': '🔄 重新生成',
  'summary.tokens': '消耗 {total} tokens',
  'summary.tokenDetail': '输入 {input} / 输出 {output}',

  // Translate view
  'translate.emptyTitle': '划词翻译',
  'translate.emptyDesc': '在网页上选中任意文字，翻译结果会自动记录到这里。最新的翻译显示在最前面。',
  'translate.records': '翻译记录',
  'translate.count': '{count} 条',

  // Chat view
  'chat.emptyTitle': '网页问答对话',
  'chat.emptyDesc': '基于当前网页内容的多轮对话追问功能将在 v1.1 版本推出，敬请期待。',

  // Error handling
  'error.retry': '重试',
  'error.goSettings': '前往设置',

  // Selection bubble
  'bubble.translate': '🌐 翻译',
  'bubble.translating': '...',
  'bubble.failed': '翻译失败',

  // Options page
  'options.title': '设置',
  'options.subtitle': '配置大模型接入。可自由选择接口协议、填写接口地址和模型名。API Key 仅存储在本地浏览器。',
  'options.models': '模型配置',
  'options.active': '● 启用中',
  'options.configured': '已配置',
  'options.notConfigured': '未配置',
  'options.addFromTemplate': '+ 从模板添加',
  'options.addCustom': '+ 新建自定义',
  'options.template': '模板',
  'options.delete': '🗑 删除',
  'options.setActive': '设为启用',
  'options.enabled': '已启用',
  'options.labelName': '配置名称',
  'options.protocol': '接口协议',
  'options.baseURL': '接口地址 (Base URL)',
  'options.model': '模型名',
  'options.apiKey': 'API Key',
  'options.show': '显示',
  'options.hide': '隐藏',
  'options.save': '保存设置',
  'options.saved': '✓ 已保存',
  'options.lang': '界面语言',
  'options.langAuto': '跟随浏览器',

  // Provider protocol descriptions
  'protocol.openai-compat': 'OpenAI 兼容',
  'protocol.claude': 'Anthropic Claude',
  'protocol.ollama': 'Ollama',
  'protocol.openai-compat.desc': 'OpenAI / DeepSeek / 智谱 / 通义 / Kimi 等',
  'protocol.claude.desc': 'Claude 官方 Messages API',
  'protocol.ollama.desc': '本地模型（localhost）',
  'hint.openai-compat': '填到 /v1 这一级，例如 https://api.deepseek.com/v1',
  'hint.claude': '填到根域名，例e.g. https://api.anthropic.com',
  'hint.ollama': '本地服务地址，例e.g. http://localhost:11434',
  'hint.ollamaNote': '💡 Ollama 无需 API Key。请确保本地已运行 Ollama 并拉取了对应模型（{cmd}）。',
  'placeholder.baseURL': 'https://api.example.com/v1',
  'placeholder.model': '如 deepseek-chat / gpt-4o-mini / claude-3-5-sonnet-20241022',
  'placeholder.apiKey': 'sk-...',
  'placeholder.providerName': '未命名',

  // Built-in provider template labels (brand names kept, descriptions translated)
  'provider.openai': 'OpenAI',
  'provider.deepseek': 'DeepSeek',
  'provider.zhipu': '智谱 GLM',
  'provider.claude': 'Anthropic Claude',
  'provider.ollama': 'Ollama (本地)',
  'provider.openai.hint': 'OpenAI 官方 API',
  'provider.deepseek.hint': '性价比高，兼容 OpenAI 协议',
  'provider.zhipu.hint': '国产，兼容 OpenAI 协议',
  'provider.claude.hint': 'Anthropic 官方 Messages API',
  'provider.ollama.hint': '本地模型，数据不出本机',
};

export type Messages = typeof zh;
