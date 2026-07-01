# Limn Project Context

这份文档面向后续新会话或接手开发的人，目标是用最短时间理解 Limn 的结构并开始改代码。对外产品介绍见根目录 `README.md` / `README.en.md`；历史设计与计划见 `docs/superpowers/`。

## 1. 项目定位

Limn 是一个 Chrome Manifest V3 扩展，用 AI 帮用户阅读网页：

- 摘要：抽取当前网页正文，流式生成结构化摘要，并显示 token usage。
- 问一问 AI：用户划词后生成“大意 + 关键信息”解读；侧边栏支持基于网页内容的多轮追问。
- 多模型：通过统一 LLM adapter 支持 OpenAI-compatible、Anthropic Claude、Ollama。
- 多页面隔离：每个 tab 的正文、摘要、对话独立保存到 `chrome.storage.session`。

当前实现已从早期“翻译 + 对话”合并为两个 tab：`摘要` 和 `问一问 AI`。不要再新增独立翻译 tab，除非产品方向重新确认。

## 2. 开发命令

```bash
npm install
npm run dev
npm run build
npm test
npm run test:watch
```

- `npm run dev`：Vite watch，用于扩展开发。
- `npm run build`：输出 `dist/`，浏览器加载 unpacked extension 时选择这个目录。
- `npm test`：Vitest 单次运行。

项目当前没有单独的 lint/typecheck 脚本；构建会跑 TypeScript/Vite 编译链。

## 3. 技术栈与配置

- UI：React 19 + TypeScript。
- 构建：Vite + `@crxjs/vite-plugin`。
- 扩展：Chrome Manifest V3，入口定义在 `src/manifest.ts`。
- 正文抽取：`@mozilla/readability`。
- 测试：Vitest + jsdom + Testing Library。
- 路径别名：`@/*` 指向 `src/*`，配置在 `vite.config.ts`、`vitest.config.ts`、`tsconfig.json`。

`package.json` 的 `"type"` 是 `"commonjs"`，源码仍以 ESM/TS 写法由 Vite 处理。

## 4. 目录地图

```text
src/
├── manifest.ts                 Manifest V3 清单
├── background/                 service worker：消息路由、流式 LLM、TabState
├── content-script/             页面注入：正文抽取 listener、划词气泡
├── extractor/                  Readability 封装、分段、语言检测
├── i18n/                       轻量 zh/en 文案和 locale 管理
├── llm/                        LLMClient 接口、adapter、provider 模板
├── options/                    模型配置页 React app
├── prompts/                    摘要和对话 prompt 构建
├── shared/                     跨上下文共享类型与消息协议
├── sidepanel/                  主侧边栏 React app
└── storage/                    chrome.storage.local 设置封装

tests/
└── unit/                       extractor/background/llm/prompts/storage 单元测试
```

重要历史文档：

- `docs/superpowers/specs/2026-06-24-ai-reader-extension-design.md`：最初的系统设计。
- `docs/superpowers/plans/2026-06-24-ai-reader-mvp.md`：MVP 实施计划，部分文件名已和现状不同。
- `docs/superpowers/plans/2026-06-28-merge-translate-chat.md`：合并翻译与对话为“问一问 AI”的决策依据。

## 5. 运行时组件

### 5.1 Manifest

`src/manifest.ts` 定义：

- background service worker：`src/background/background.ts`
- side panel：`src/sidepanel/index.html`
- options page：`src/options/index.html`
- content script：`src/content-script/index.ts`，匹配 `<all_urls>`，`document_idle`
- 权限：`activeTab`、`storage`、`sidePanel`、`tabs`
- host permissions：OpenAI、DeepSeek、智谱、Anthropic、Ollama localhost

### 5.2 Content Script

入口：`src/content-script/index.ts`

- 调用 `setupExtractorListener()`，监听 background 发来的 `{ type: 'EXTRACT_CONTENT' }`。
- 初始化 locale 后创建 `AskBubble`。
- 划词后点击气泡，会建立 port：`chrome.runtime.connect({ name: "chat:selection:<selectedText>" })`。

`src/content-script/extractor-runner.ts` 在页面上下文调用 `extractPageContent(document, location.href)`，把 `PageContent` 返回给 background。

`src/content-script/selection-bubble/Bubble.ts` 使用 Shadow DOM 隔离样式。选中文本长度限制为 2 到 1000 字符。

### 5.3 Background Service Worker

入口：`src/background/background.ts`

职责：

- 初始化 i18n locale。
- 抽取并缓存页面正文：内存 `contentCache: Map<tabId, PageContent>` + `chrome.storage.session`。
- 处理非流式消息：`GET_PAGE_CONTENT`、`GET_TAB_STATE`。
- 处理摘要 port：`summarize:<tabId>`。
- 处理对话 port：sidepanel 使用 `chat:<tabId>:<mode>:<payload>`，content script 划词仍使用 `chat:<mode>:<payload>` 并由 sender tab 推断 tabId。
- 广播 sidepanel 事件：`TAB_CHANGED`、`CHAT_UPDATED`。
- tab 激活时通知 sidepanel 刷新；tab 关闭时清理该 tab 的状态。

对话 port 的解析集中在 `src/background/chat-flow.ts`。侧边栏追问必须显式携带 tabId；content script 划词请求通过 `port.sender.tab.id` 归属到页面 tab。

### 5.4 Sidepanel

入口：`src/sidepanel/App.tsx`

- 初始化时用 `chrome.tabs.query({ active: true, currentWindow: true })` 获取当前 tabId。
- 调 `GET_TAB_STATE` 恢复摘要和对话。
- 监听 `TAB_CHANGED` 切换当前 tab 状态。
- 监听 `CHAT_UPDATED` 更新对话并自动切到 `问一问 AI` tab。
- 摘要逻辑在 `useStreamingSummary()`；对话流式状态在 `useChat()`。

视图：

- `src/sidepanel/views/SummaryView.tsx`：未配置模型、idle、extracting/streaming/done/error 状态。
- `src/sidepanel/views/AskView.tsx`：消息流、pending/streaming assistant bubble、底部输入。

### 5.5 Options

入口：`src/options/App.tsx`

- 加载 `chrome.storage.local` 中的 `settings`。
- 补齐内置 provider 模板；“从模板添加”按钮通过 `src/options/provider-templates.ts` 新增或激活模板。
- 支持 active provider、协议、baseURL、model、API key、UI language。
- 保存后短延时 reload，让语言变化反映到页面。

内置 provider 模板在 `src/llm/providers.ts`，默认设置在 `src/storage/index.ts`。

## 6. 核心数据模型

共享类型：

- `src/shared/types.ts`：`PageContent`、`ContentType`、基础 `ChatMessage`。
- `src/shared/messages.ts`：扩展消息协议、错误码、tab 状态、流式 chunk。

关键模型：

```ts
interface PageContent {
  url: string;
  title: string;
  text: string;
  paragraphs: string[];
  detectedLang: string;
  contentType: 'article' | 'github' | 'paper' | 'doc' | 'unknown';
  extractedAt: number;
}

interface TabState {
  tabId: number;
  pageContent: PageContent | null;
  summary: SummaryState;
  chat: ConversationMessage[];
}
```

`ConversationMessage` 是 UI/状态用的对话消息，包含 `fromSelection` 和 `at`；传给 LLM adapter 时会在 `buildChatPrompt()` 中降级为只有 `role/content` 的基础 `ChatMessage`。

## 7. 主要数据流

### 7.1 摘要

```text
SummaryView 点击生成
  -> useStreamingSummary 建立 port summarize:<tabId>
  -> background 检查 active provider
  -> background 发 EXTRACT_CONTENT 给 content script
  -> extractor 返回 PageContent
  -> setPageContent(tabId, content)
  -> createLLMClient(settings)
  -> buildSummaryPrompt(content, locale)
  -> client.stream(...)
  -> port streaming chunks 回 sidepanel
  -> updateSummary(tabId, done/error)
```

摘要状态保存在 `TabState.summary`，切换 tab 后可恢复。

### 7.2 划词解读

```text
用户在网页划词
  -> AskBubble 显示“问一问”
  -> 点击后 content script 建立 port chat:selection:<text>
  -> background 用 port.sender.tab.id 定位 tab
  -> wrapSelectionAsUserMessage(text, locale)
  -> addChatMessage(tabId, userMessage)
  -> broadcast CHAT_UPDATED
  -> getContentForChat 必要时先抽取页面正文
  -> buildChatPrompt(pageContent, state.chat, locale)
  -> client.stream(...)
  -> delta 同步给气泡
  -> done 后 assistantMessage 进入 TabState.chat
  -> broadcast CHAT_UPDATED
```

划词消息在 UI 状态里只保存选中文本；`buildChatPrompt()` 会在发送给模型时再包装成“请解读选中文本”的用户消息。

### 7.3 侧边栏追问

```text
AskView 提交问题
  -> App.handleAsk
  -> useChat.send(tabId, "question", question, ...)
  -> 建立 port chat:<tabId>:question:<question>
  -> background 追加 user message
  -> getContentForChat 必要时先抽取页面正文
  -> buildChatPrompt(pageContent, state.chat, locale)
  -> client.stream(...)
  -> sidepanel 显示 streamingReply
  -> done 后追加 assistant message
```

`parseChatPortName()` 兼容 payload 内包含冒号。后续若继续扩展 chat 协议，优先考虑连接后用首条 `postMessage` 传结构化 payload，而不是继续加长 port name。

## 8. LLM 适配层

统一接口在 `src/llm/types.ts`：

- `LLMClient.complete(req)`
- `LLMClient.stream(req)`
- `LLMClient.healthCheck()`

工厂在 `src/llm/client-factory.ts`，按 `ProviderSettings.protocol` 路由：

- `openai-compat` -> `src/llm/adapters/openai-compat.ts`
- `claude` -> `src/llm/adapters/claude.ts`
- `ollama` -> `src/llm/adapters/ollama.ts`

新增协议时需要：

1. 扩展 `LLMProtocol`。
2. 新增 adapter 实现 `LLMClient`。
3. 修改 `createLLMClient()`。
4. 在 `PROTOCOL_OPTIONS` 和需要的 provider 模板中加入配置。
5. 增加 adapter 单元测试。

OpenAI-compatible streaming 使用 SSE `data:`；Claude streaming 解析 Anthropic event；Ollama streaming 解析 newline-delimited JSON。三者都尽量在最后一个 chunk 携带 token usage。

## 9. Prompt

- `src/prompts/summary.ts`：根据 locale 输出中文或英文结构化摘要。
- `src/prompts/chat.ts`：构建阅读助手 system prompt，把页面标题和正文前 4000 字符放入上下文；划词消息通过 `wrapSelectionAsUserMessage()` 包装。

当前抽取层正文最多保留 12000 字符；chat prompt 再截到 4000 字符。长对话没有历史截断策略，这是 README 路线图里的 v1.1 待办之一。

## 10. 存储

### 10.1 用户设置

`src/storage/index.ts` 用 `chrome.storage.local` 存 `settings`：

- active provider
- providers map
- translateTargetLang、summaryStyle（历史字段仍在 schema）
- uiLanguage

默认 active provider 是 DeepSeek 模板，但 API key 为空。

### 10.2 Tab 状态

`src/background/tab-state.ts` 用 `chrome.storage.session` 的 `tabStates` key 存所有 tab 状态。

可用操作：

- `getTabState(tabId)`
- `setPageContent(tabId, content)`
- `updateSummary(tabId, patch)`
- `addChatMessage(tabId, message)`
- `setChat(tabId, messages)`
- `clearTabState(tabId)`

`getTabState()` 包含旧数据兼容：如果旧状态没有 `chat` 字段，会初始化为空数组。

## 11. 测试地图

当前单元测试覆盖：

- `tests/unit/extractor/*`：readability、segment、lang-detect、抽取入口。
- `tests/unit/llm/*`：OpenAI-compatible、Claude、Ollama adapter，错误分类。
- `tests/unit/background/*`：message-router、tab-state。
- `tests/unit/prompts/summary.test.ts`：摘要 prompt。
- `tests/unit/storage/index.test.ts`：settings merge 和存储封装。

常见验证：

```bash
npm test
npm run build
```

改动扩展消息流时，优先补 background/tab-state/hook 相关测试。改动 adapter 时，用 mock fetch 测 complete、stream、usage、错误码。

## 12. 常见改动入口

- 新增模型模板：`src/llm/providers.ts` + `src/i18n/zh.ts` + `src/i18n/en.ts`；模板按钮逻辑在 `src/options/provider-templates.ts`。
- 新增协议 adapter：`src/llm/types.ts`、`src/llm/client-factory.ts`、`src/llm/adapters/`、测试。
- 调整摘要格式：`src/prompts/summary.ts`，必要时更新 `tests/unit/prompts/summary.test.ts`。
- 调整划词解读格式：`src/prompts/chat.ts`。
- 修改侧边栏布局：`src/sidepanel/views/*`、`src/sidepanel/styles/*`。
- 修改气泡交互：`src/content-script/selection-bubble/Bubble.ts` 和 `bubble.css`。
- 修改 options 表单：`src/options/App.tsx`、`src/options/styles/options.css`。
- 修改错误提示：`src/shared/messages.ts` 的 `ErrorCode` + `src/llm/error-messages.ts`。
- 修改持久状态：`src/shared/messages.ts` 的 `TabState` + `src/background/tab-state.ts` + 恢复逻辑。

## 13. 当前注意事项

- 工作树里可能有用户未提交改动，动手前先看 `git status --short`。截至本文创建时，`package-lock.json` 已是 modified，不要无意覆盖。
- `docs/.DS_Store` 和 `docs/superpowers/.DS_Store` 存在于工作区列表中；一般不需要触碰。
- `src/background/message-router.ts` 有测试，但主 background 当前直接注册 listener，没有大量使用这个 router。
- `chat:` port 仍把用户文本放进 port name。payload 可包含冒号并由 `parseChatPortName()` 保留，但 port name 不是理想的数据通道，后续可改成连接后首条 `postMessage` 发送结构化 payload。
- provider 凭据判断集中在 `src/llm/provider-auth.ts`。Ollama 不要求 API key，远程协议仍要求非空 key。
- `contentCache` 只在 service worker 内存里，service worker 重启后会丢；`TabState.pageContent` 仍在 session storage。

## 14. 新会话建议开局

1. 读本文件。
2. 跑 `git status --short`，确认用户改动。
3. 根据任务读对应入口文件，不要先全仓库漫游。
4. 改代码后至少跑 `npm test` 和 `npm run build`；如果是 UI/交互改动，再用浏览器加载 `dist/` 做一次人工或自动化验证。
