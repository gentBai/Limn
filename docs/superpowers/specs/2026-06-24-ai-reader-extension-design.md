# AI Reader Chrome 扩展 - 系分设计

> **状态**: Draft v1
> **日期**: 2026-06-24
> **作者**: brainstorming 协作产出
> **等待**: 用户审阅 → 通过后进入 writing-plans 生成实施计划

---

## 1. 背景与目标

### 1.1 问题陈述

在使用 AI 搜索工具获取资讯时，用户会面临大量网页结果——新闻资讯、GitHub 项目、学术论文等。这些网页常存在两个障碍：

1. **语言障碍**：内容可能为英文或其他语言，阅读成本高。
2. **篇幅障碍**：单篇内容可能很长，逐篇精读不现实。

用户无法对每一篇都完整阅读，需要一个工具帮助**快速理解、翻译、追问**。

### 1.2 产品目标

构建一个 Chrome 浏览器扩展，接入大模型，对当前网页提供：

- **一键摘要**：快速生成结构化中文摘要，用于筛选是否值得精读。
- **划词翻译**：选中任意文本即时翻译，不离开当前页面。
- **网页问答**：基于当前网页内容进行多轮对话追问。
- **智能内容抽取**：识别正文主体，剔除广告/导航等噪声。

### 1.3 非目标 (Out of Scope - 当前阶段)

以下能力明确**不在本次设计范围内**，避免范围蔓延：

- 多标签页批量摘要（已确认 MVP 为单页手动触发）。
- 针对特定站点（GitHub/arXiv 等）的定制解析规则（MVP 用通用抽取）。
- 用户账号体系、云端同步、付费计费。
- 服务端中转的自建模型服务（架构预留但不在 MVP 实现）。
- 语音朗读、PDF 解析、视频字幕处理等多模态能力。

### 1.4 分阶段范围 (MVP → 完整版)

| 阶段 | 功能 | 说明 |
|------|------|------|
| **MVP** | 内容抽取 + 一键摘要 + 划词翻译 | 让插件先跑起来，验证核心链路 |
| **v1.1** | 网页问答对话（多轮） | 在摘要基础上加入追问能力 |
| **v1.2** | 本地模型(Ollama)支持 | 完善混合模式 |
| **未来** | 批量处理、站点定制、服务端模式 | 按需迭代 |

**本设计文档覆盖 MVP + v1.1 + v1.2 的完整架构**，使后续迭代不需要推翻重来。实施计划会聚焦 MVP。

---

## 2. 关键决策记录 (ADR 摘要)

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 模型接入方式 | **混合模式**：用户自带 API Key 为主 + 兼容本地 Ollama | 隐私好、无服务器成本，本地模型兜底离线场景 |
| 2 | 交互方式 | **混合**：划词气泡(翻译) + 原生 sidePanel(摘要/对话) | 翻译低干扰，深度交互用隔离面板 |
| 3 | 侧边栏实现 | **Chrome 原生 `sidePanel` API** | 样式完全隔离，兼容性坑最少 |
| 4 | 内容抽取策略 | **通用抽取(Readability) + 大模型理解** | MVP 通用性强，后续按需加站点规则 |
| 5 | 技术栈 | **React + TypeScript + Vite + MV3** | 开发体验好，类型安全，现代插件主流 |
| 6 | 处理范围 | **MVP 单页手动触发** | 控制复杂度，先验证核心价值 |
| 7 | 架构 | **方案 C**：sidePanel + content-script + 独立 LLM 适配层 | 职责分离，可测试，可扩展 |

---

## 3. 系统架构

### 3.1 组件总览

扩展采用 Manifest V3 多组件协作架构，核心原则是**职责分离 + 消息总线 + 模型适配层抽象**。

```
┌─────────────────────────────────────────────────────────────┐
│  Browser Tab (任意网页)                                       │
│  ┌────────────────────────┐    ┌──────────────────────────┐ │
│  │ content-script.ts      │    │ selection-bubble.ts      │ │
│  │ - Readability 正文抽取  │    │ - 监听 selectionchange   │ │
│  │ - 页面元信息采集(标题等) │    │ - 浮现翻译气泡            │ │
│  │ - 返回 PageContent 对象 │    │ - Shadow DOM 样式隔离     │ │
│  └──────────┬─────────────┘    └────────────┬─────────────┘ │
│             │ chrome.runtime.sendMessage      │              │
└─────────────┼─────────────────────────────────┼────────────┘
              │                                 │
              ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  background.ts (service worker)  —— 消息总线 + 调度          │
│  - 路由消息到对应 handler                                     │
│  - 管理 sidePanel 生命周期                                    │
│  - 持有跨标签页的 PageContent 缓存                            │
└─────────────┬───────────────────────────────────────────────┘
              │ chrome.runtime / chrome.storage
              ▼
┌─────────────────────────────────────────────────────────────┐
│  sidepanel/ (React App)  —— 主交互界面                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────────────────────┐  │
│  │ Summary   │ │ Translate │ │ Chat (多轮对话)           │  │
│  │ 视图      │ │ 视图      │ │                          │  │
│  └───────────┘ └───────────┘ └──────────────────────────┘  │
└─────────────┬───────────────────────────────────────────────┘
              │ 调用模型 (通过统一接口)
              ▼
┌─────────────────────────────────────────────────────────────┐
│  llm/  —— 模型适配层 (核心抽象)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐  │
│  │ OpenAICompat    │  │ OllamaAdapter   │  │ Provider   │  │
│  │ Adapter         │  │                 │  │ Registry   │  │
│  │ (覆盖 OpenAI/   │  │ (本地模型)      │  │            │  │
│  │  Claude/智谱/   │  │                 │  │            │  │
│  │  DeepSeek 等)   │  │                 │  │            │  │
│  └─────────────────┘  └─────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 设计原则

1. **模型适配层是核心抽象**：所有上层功能（摘要/翻译/对话）只面对统一的 `LLMClient` 接口，不感知底层是哪家云模型还是本地模型。这是"混合模式"可行的根基，也使新增模型零成本。
2. **消息总线统一调度**：content-script 与 sidepanel **不直接通信**，统一经 background service worker 中转，避免生命周期错乱（sidepanel 可能在 content-script 注入前/后任意时刻打开）。
3. **状态集中于 `chrome.storage`**：API Key、对话历史、用户设置统一存储，跨组件共享，service worker 重启不丢失。
4. **UI 与逻辑分离**：React 组件只管渲染和交互，业务逻辑（抽取、模型调用）放在可独立测试的模块中。

---

## 4. 模块设计

按职责拆分为以下模块。每个模块单一职责、接口清晰、可独立测试。

### 4.1 `extractor/` — 网页内容抽取

**职责**：从任意网页提取结构化正文，剔除导航/广告/侧边栏噪声。

**输入**：当前页面的 `document` (DOM)。

**输出**：`PageContent` 对象。

```typescript
interface PageContent {
  url: string;
  title: string;
  // 抽取后的纯文本正文，已去噪
  text: string;
  // 按 DOM 结构切分的段落，供分段翻译/定位使用
  paragraphs: string[];
  // 源语言检测结果（如 'en', 'zh', 'unknown'）
  detectedLang: string;
  // 内容类型推测（影响 prompt）: 'article' | 'github' | 'paper' | 'doc' | 'unknown'
  contentType: ContentType;
  // 抽取耗时 ms，用于性能监控
  extractedAt: number;
}
```

**实现要点**：
- 基于 `@mozilla/readability` 库做正文提取（成熟、被广泛验证）。
- 在 content-script 中执行（可访问页面 DOM）。
- 对超长正文（> 阈值，如 12000 字符）做**分段截断策略**，保留开头 + 关键段，避免超出模型上下文窗口。
- 语言检测用轻量启发式（字符集判断 + 常见词匹配），不引入额外依赖；如需更准可后续接 `franc` 库。

**关键边界**：
- extractor **只负责抽取，不调用模型**。语言检测也尽量本地完成，减少 API 调用。
- 抽取结果缓存在 background，同一页面短时间内重复请求摘要不重复抽取。

### 4.2 `llm/` — 模型适配层（核心）

**职责**：屏蔽不同大模型提供商的差异，对上层提供统一调用接口。

#### 4.2.1 统一接口

```typescript
interface LLMClient {
  /** 提供商唯一标识，如 'openai', 'deepseek', 'ollama' */
  readonly providerId: string;

  /**
   * 单次补全（非流式）。用于翻译、短摘要等需要完整结果的场景。
   * @returns 完整文本
   */
  complete(req: CompleteRequest): Promise<CompleteResponse>;

  /**
   * 流式补全。用于摘要/对话的逐字输出，提升体感。
   * @returns 异步迭代器，逐块产出文本
   */
  stream(req: CompleteRequest): AsyncIterable<StreamChunk>;

  /** 健康检查：测试当前配置是否可用（Key 有效、服务可达） */
  healthCheck(): Promise<HealthStatus>;
}

interface CompleteRequest {
  messages: ChatMessage[];
  // 可选：温度、max_tokens 等
  options?: LLMOptions;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamChunk {
  // 本块增量文本
  delta: string;
  // 是否结束
  done: boolean;
}
```

#### 4.2.2 Adapter 实现

| Adapter | 覆盖范围 | 协议 | 说明 |
|---------|---------|------|------|
| `OpenAICompatAdapter` | OpenAI / DeepSeek / 智谱 / 通义 / Moonshot 等 | OpenAI Chat Completions API | 通过配置不同的 `baseURL` + `apiKey` + `model` 适配所有兼容厂商。绝大多数国产模型都兼容此协议。 |
| `ClaudeAdapter` | Anthropic Claude | Anthropic Messages API | Claude 协议与 OpenAI 不完全兼容，单独适配。 |
| `OllamaAdapter` | 本地模型 | Ollama HTTP API (`localhost:11434`) | 离线场景，数据不出本机。 |

#### 4.2.3 Provider Registry（提供商注册表）

```typescript
interface ProviderConfig {
  id: string;                  // 'openai', 'deepseek', ...
  label: string;               // 显示名
  adapter: 'openai-compat' | 'claude' | 'ollama';
  defaultBaseURL: string;
  defaultModel: string;
  // 是否需要 API Key（Ollama 不需要）
  requiresApiKey: boolean;
}
```

内置一份预设列表（OpenAI、DeepSeek、智谱、通义、Moonshot、Claude、Ollama），同时支持用户**自定义 provider**（填 baseURL + Key + model），覆盖未预设的兼容厂商。

**MVP 范围**：先实现 `OpenAICompatAdapter`（覆盖最多厂商）+ `OllamaAdapter`。`ClaudeAdapter` 放 v1.2。

### 4.3 `prompts/` — Prompt 工程

**职责**：集中管理各功能的 prompt 模板，便于迭代和 A/B。

```typescript
// prompts/summary.ts
function buildSummaryPrompt(content: PageContent, lang: string): ChatMessage[] {
  // system: "你是专业的资讯摘要助手，输出结构化中文摘要..."
  // user: 标题 + 正文（已截断）+ 指令（输出要点列表）
}

// prompts/translate.ts
function buildTranslatePrompt(text: string, sourceLang: string): ChatMessage[] {
  // 保留代码块、术语、格式
}

// prompts/chat.ts
function buildChatPrompt(content: PageContent, history: ChatMessage[]): ChatMessage[] {
  // system 注入网页内容作为知识库，history 为历史对话
}
```

**要点**：
- 所有 prompt 显式要求**中文输出**（除非用户设置其他目标语言）。
- 摘要 prompt 要求结构化输出（核心观点 + 关键要点 + 适用人群）。
- 翻译 prompt 强调保留原文格式（代码块、列表、术语）。
- prompt 与代码分离，便于后续不重新发版也能调整（可选：放 chrome.storage 远程加载，但 MVP 先硬编码）。

### 4.4 `background/` — 消息总线与调度

**职责**：service worker，作为各组件的通信中枢和业务编排层。

**消息协议**（统一信封）：

```typescript
type RequestMessage =
  | { type: 'EXTRACT_CONTENT'; tabId: number }
  | { type: 'SUMMARIZE'; tabId: number }
  | { type: 'TRANSLATE'; text: string }
  | { type: 'CHAT'; tabId: number; userMessage: string }
  | { type: 'GET_PAGE_CONTENT'; tabId: number }
  | { type: 'TEST_PROVIDER'; providerId: string };

type ResponseMessage<T = unknown> =
  | { type: 'SUCCESS'; data: T }
  | { type: 'ERROR'; error: ErrorResponse };

interface ErrorResponse {
  code: ErrorCode;        // 见 §7 错误处理
  message: string;        // 用户可读的中文消息
  retryable: boolean;
}
```

**职责边界**：
- background **不直接渲染 UI**，只做路由和编排。
- 持有 `PageContent` 的内存缓存（按 tabId），避免重复抽取。
- 负责 sidePanel 的打开/关闭管理。

### 4.5 `content-script/` — 页面注入层

**职责**：运行在网页上下文，负责 DOM 操作和事件监听。

两个子模块：

1. **`extractor-runner.ts`**：响应 background 的 `EXTRACT_CONTENT` 指令，调用 `extractor/` 抽取并返回。
2. **`selection-bubble.ts`**：监听 `selectionchange` / `mouseup`，当用户选中文字并松开时，在选区附近浮现金色气泡（Shadow DOM 隔离），点击后触发翻译。气泡用 Web Component + Shadow DOM，确保样式不被宿主页面污染。

**兼容性考量**：
- 部分页面（`chrome://`、Chrome Web Store、PDF 预览）不允许注入 content-script，需在 manifest 的 `matches` 和运行时做判断，UI 上给出"本页不支持"的友好提示。
- SPA 页面路由切换不刷新，需要监听 URL 变化重新抽取。

### 4.6 `sidepanel/` — 主交互界面 (React)

**职责**：用户的主要交互入口，承载摘要/翻译/对话三个功能。

**组件结构**：

```
SidePanel (根)
├── Header (当前页面标题 + provider 切换)
├── TabNav (摘要 | 翻译 | 对话)
├── Tab Content
│   ├── SummaryView    —— 一键摘要 + 流式输出 + 复制/重生成
│   ├── TranslateView  —— 翻译片段展示（划词结果也汇聚到这里）
│   └── ChatView       —— 多轮对话 + 流式回复
└── Footer (token 用量提示，可选)
```

**状态管理**：用 React Context + `useReducer`，不引入 Redux（MVP 复杂度不需要）。跨组件共享状态（当前 PageContent、对话历史）通过 Context 下发。

### 4.7 `options/` — 设置页 (React)

**职责**：配置 API Key、选择 provider、模型参数。

**关键设置项**：
- 当前启用的 provider（单选）。
- 每个 provider 的：API Key（密码框，存 chrome.storage.local）、baseURL、model 名、温度。
- 翻译目标语言（默认中文）。
- 摘要长度偏好（简洁 / 标准 / 详细）。

**安全**：API Key 只存 `chrome.storage.local`，**不存 sync**（避免同步到 Google 账号云端）。UI 上对 Key 做掩码显示。

### 4.8 `storage/` — 持久化封装

**职责**：封装 `chrome.storage`，提供类型安全的存取接口。

```typescript
interface StorageSchema {
  settings: {
    activeProviderId: string;
    providers: Record<string, ProviderSettings>;  // 含 apiKey
    translateTargetLang: string;
    summaryStyle: 'concise' | 'standard' | 'detailed';
  };
  history: {
    // 按 url 维度存对话历史，避免混页
    chats: Record<string, ChatMessage[]>;
  };
}
```

**存储分区**：
- `chrome.storage.local`：API Key、敏感配置（不同步）。
- `chrome.storage.session`：当前会话的 PageContent 缓存、临时状态。
- `chrome.storage.sync`：非敏感偏好（语言、摘要风格），可跨设备同步。

---

## 5. 数据流

### 5.1 一键摘要流程

```
用户点击"摘要"按钮 (sidepanel)
   │
   ▼
sidepanel 发送 SUMMARIZE 消息 ──► background
   │                                  │
   │                                  ├─ 缓存命中? ──► 直接用
   │                                  │
   │                                  ▼ 缓存未命中
   │                              background 向 content-script
   │                              发 EXTRACT_CONTENT (tabId)
   │                                  │
   │                                  ▼
   │                              content-script 调用 extractor
   │                              返回 PageContent
   │                                  │
   │                                  ▼
   │                              background 缓存 PageContent
   │                              构建 summary prompt
   │                                  │
   │                                  ▼
   │                              LLMClient.stream(prompt)
   │                                  │
   │                                  ▼ 逐块
   │                              background 转发 StreamChunk
   │                              回 sidepanel
   │                                  │
   ▼◄─────────────────────────────────┘
sidepanel 逐字渲染摘要
```

**关键点**：
- 流式输出通过 background 中转（service worker 支持长连接 `chrome.runtime.connect`）。
- 抽取结果缓存按 `tabId + url + 文档 hash` 作 key，页面内容变化时失效。

### 5.2 划词翻译流程

```
用户在网页选中文字 + 松开鼠标
   │
   ▼
content-script (selection-bubble) 检测有效选区
   │  (选区长度 > 阈值、非纯空白)
   ▼
浮现气泡（Shadow DOM，含"翻译"按钮）
   │
   ▼ 用户点击翻译
content-script 发 TRANSLATE 消息 ──► background
   │                                     │
   │                                     ▼
   │                                 构建 translate prompt
   │                                 LLMClient.complete(text)
   │                                     │
   │                                     ▼
   │◀────────────────────────────────────┘
气泡内显示译文（或 sidepanel 翻译视图同步）
```

**防抖**：选区变化频繁触发，用 debounce（~300ms）避免气泡闪烁。

### 5.3 网页问答流程

```
用户在 sidepanel ChatView 输入问题
   │
   ▼
sidepanel 发 CHAT 消息(tabId, userMessage) ──► background
   │                                             │
   │                                             ▼
   │                                         取 PageContent（缓存或抽取）
   │                                         取历史 history.chats[url]
   │                                         构建 chat prompt
   │                                             │
   │                                             ▼
   │                                         LLMClient.stream(...)
   │                                         流式回复
   │                                             │
   │                                             ▼
   │                                         追加到 history.chats[url] 持久化
   │                                             │
   ▼◄───────────────────────────────────────────┘
sidepanel ChatView 流式渲染 + 滚动到底部
```

---

## 6. 接口契约

### 6.1 消息调用约定

所有跨组件通信走 `chrome.runtime.sendMessage` / `chrome.runtime.connect`，统一信封格式见 §4.4。

**调用方 → background**：发送 `RequestMessage`，background 回 `Promise<ResponseMessage>`。

**background → content-script**：用 `chrome.tabs.sendMessage(tabId, msg)`。

**流式通信**：用长连接 `chrome.runtime.connect({ name: 'stream:<requestId>' })`，通过 `port.postMessage` 逐块推送 `StreamChunk`，结束时 `port.disconnect()`。

### 6.2 LLMClient 实现约束

任何新 Adapter 必须满足：
1. 实现 `LLMClient` 全部方法。
2. `healthCheck()` 必须在 5s 内返回（超时视为不可用）。
3. 网络错误需转换为 §7 定义的 `ErrorCode`，不向上抛裸 `fetch` 错误。
4. 流式实现需正确处理 SSE 解析（OpenAI 兼容）或 NDJSON（Ollama）。

---

## 7. 错误处理

### 7.1 错误码定义

```typescript
enum ErrorCode {
  // 配置类
  NO_PROVIDER_CONFIGURED = 'NO_PROVIDER_CONFIGURED',
  INVALID_API_KEY        = 'INVALID_API_KEY',
  MISSING_API_KEY        = 'MISSING_API_KEY',

  // 网络类
  NETWORK_ERROR          = 'NETWORK_ERROR',
  PROVIDER_TIMEOUT       = 'PROVIDER_TIMEOUT',
  RATE_LIMITED           = 'RATE_LIMITED',

  // 内容类
  EXTRACTION_FAILED      = 'EXTRACTION_FAILED',
  EMPTY_CONTENT          = 'EMPTY_CONTENT',         // 页面无有效正文
  CONTENT_TOO_LONG       = 'CONTENT_TOO_LONG',

  // 模型类
  MODEL_ERROR            = 'MODEL_ERROR',            // 上游返回业务错误
  CONTEXT_LENGTH_EXCEEDED= 'CONTEXT_LENGTH_EXCEEDED',

  // 环境类
  PAGE_NOT_SUPPORTED     = 'PAGE_NOT_SUPPORTED',     // chrome:// 等不可注入页
  OLLAMA_NOT_RUNNING     = 'OLLAMA_NOT_RUNNING',
}
```

### 7.2 用户可见的处理策略

每个错误都映射到**用户可读的中文提示 + 可执行的建议动作**：

| 错误码 | 提示 | 建议动作 |
|--------|------|---------|
| `MISSING_API_KEY` | "尚未配置 API Key" | 跳转设置页按钮 |
| `INVALID_API_KEY` | "API Key 无效或已过期" | 跳转设置页 |
| `NETWORK_ERROR` | "网络连接失败，请检查代理/网络" | 重试按钮 |
| `RATE_LIMITED` | "请求过于频繁，请稍后再试" | 倒计时重试 |
| `EMPTY_CONTENT` | "未能从当前页面提取到有效正文" | 说明（可能是登录墙/JS 渲染） |
| `PAGE_NOT_SUPPORTED` | "当前页面不支持（浏览器内置页面）" | 仅提示 |
| `OLLAMA_NOT_RUNNING` | "本地模型服务未运行" | 引导启动 Ollama 的说明链接 |
| `CONTEXT_LENGTH_EXCEEDED` | "内容过长，已自动截断" | 自动截断后重试 |

**原则**：永远不让用户看到原始的 `fetch failed` 或英文堆栈。所有错误经 background 转换后再到 UI。

### 7.3 重试与降级

- **可重试错误**（网络、限流、超时）：UI 提供重试按钮；限流按 `Retry-After` 头退避。
- **不可重试错误**（Key 无效、页面不支持）：不自动重试，直接提示。
- **长文降级**：`CONTENT_TOO_LONG` 自动触发分段截断策略后重试，不直接报错给用户。

---

## 8. 安全与隐私

| 维度 | 策略 |
|------|------|
| **API Key 存储** | 仅存 `chrome.storage.local`，绝不同步到 cloud。UI 掩码显示。 |
| **数据传输** | 云模型：浏览器直连厂商 HTTPS API，不经第三方。本地模型：全程 localhost。 |
| **网页内容** | 仅在用户主动触发（摘要/翻译/问答）时读取当前页内容并发给模型，不做后台静默上传。 |
| **权限最小化** | manifest 只申请必要权限（activeTab、storage、sidePanel）。不用 `"<all_urls>"` 全站常驻注入，改用 `activeTab` 按需注入或限定 matches。 |
| **CSP** | 遵守 MV3 严格 CSP，不加载远程脚本，不使用 `eval`。 |

### 8.1 权限清单 (manifest)

```jsonc
{
  "permissions": [
    "activeTab",      // 按需访问当前标签页
    "storage",        // 配置与历史持久化
    "sidePanel",      // 原生侧边栏
    "contextMenus"    // 右键菜单（可选，划词翻译入口）
  ],
  "host_permissions": [
    // MVP 内置 provider 所需的 API 域名（用户安装时明确授权）
    "https://api.openai.com/*",
    "https://api.deepseek.com/*",
    "https://open.bigmodel.cn/*",      // 智谱
    "https://dashscope.aliyuncs.com/*", // 通义
    "https://api.moonshot.cn/*",
    "http://localhost:11434/*"          // Ollama 本地
  ],
  "optional_permissions": ["contextMenus"],
  "optional_host_permissions": ["*://*/*"]  // 用户配置自定义 baseURL 时动态申请
}
```

> 说明：MVP 阶段 host_permissions 列出内置 provider 的已知域名；用户配置自定义 baseURL 时，用 `chrome.permissions.request` 动态申请对应域名，避免安装时索要 `"<all_urls>"` 全站权限引发用户警觉。

---

## 9. 测试策略

### 9.1 单元测试

- **`extractor/`**：用 jsdom 构造多种页面 fixture（新闻、GitHub README、论文、含大量噪声的页面），断言抽取结果的正文纯度和分段。
- **`llm/`**：用 `fetch` mock 测试每个 Adapter 的请求构造、流式解析、错误转换。重点测试 SSE 解析（OpenAI 兼容）和 NDJSON 解析（Ollama）。
- **`prompts/`**：快照测试 prompt 生成结果，防止意外改动。
- **`storage/`**：mock `chrome.storage`，测试类型安全存取和分区逻辑。

### 9.2 集成测试

- **消息链路**：mock chrome runtime APIs，测试 sidepanel → background → content-script 的完整消息往返。
- **错误传播**：注入各类错误（Key 无效、超时、空内容），断言 UI 收到正确的 ErrorCode。

### 9.3 手动验收清单 (MVP)

- [ ] 安装后无配置时，点击摘要给出明确的"请先配置"引导。
- [ ] 配置有效 Key 后，对一篇英文新闻能生成中文结构化摘要。
- [ ] 划词翻译在常见网站（知乎、GitHub、维基）正常浮现气泡。
- [ ] 在 `chrome://settings` 等页面，UI 友好提示"不支持"而非崩溃。
- [ ] 切换 SPA 路由（如 GitHub 仓库内切换 tab）后重新摘要能拿到新内容。
- [ ] 流式输出逐字显示，无卡顿。
- [ ] API Key 在设置页掩码显示，不明文暴露。

---

## 10. 项目结构

```
ai-reader/
├── src/
│   ├── background/
│   │   ├── index.ts              # service worker 入口
│   │   ├── message-router.ts     # 消息分发
│   │   └── handlers/             # 各消息类型的 handler
│   │       ├── summarize.ts
│   │       ├── translate.ts
│   │       └── chat.ts
│   ├── content-script/
│   │   ├── index.ts              # content-script 入口
│   │   ├── extractor-runner.ts   # 调用 extractor 并返回
│   │   └── selection-bubble/     # 划词气泡 Web Component
│   │       ├── Bubble.ts
│   │       └── bubble.css
│   ├── extractor/
│   │   ├── index.ts              # 抽取主逻辑
│   │   ├── readability.ts        # Readability 封装
│   │   ├── segmenter.ts          # 段落切分
│   │   └── lang-detect.ts        # 语言检测
│   ├── llm/
│   │   ├── types.ts              # LLMClient 接口定义
│   │   ├── client-factory.ts     # 根据 providerId 创建 client
│   │   ├── adapters/
│   │   │   ├── openai-compat.ts
│   │   │   ├── claude.ts         # v1.2
│   │   │   └── ollama.ts
│   │   └── providers.ts          # Provider Registry 预设列表
│   ├── prompts/
│   │   ├── summary.ts
│   │   ├── translate.ts
│   │   └── chat.ts
│   ├── storage/
│   │   ├── schema.ts             # StorageSchema 类型
│   │   └── index.ts              # 封装 chrome.storage
│   ├── sidepanel/                # React App
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── views/
│   ├── options/                  # React App
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── shared/
│   │   ├── messages.ts           # 消息类型定义（共享）
│   │   └── types.ts              # PageContent 等公共类型
│   └── manifest.ts               # manifest 生成（配合 @crxjs/vite-plugin）
├── tests/
│   ├── unit/
│   └── fixtures/                 # 测试用页面 HTML
├── docs/superpowers/specs/
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 11. 技术依赖清单

| 依赖 | 用途 | MVP 必需 |
|------|------|---------|
| `react` + `react-dom` | UI | ✅ |
| `typescript` | 类型安全 | ✅ |
| `vite` | 构建 | ✅ |
| `@crxjs/vite-plugin` | MV3 构建集成（manifest 处理、HMR） | ✅ |
| `@mozilla/readability` | 正文抽取 | ✅ |
| `vitest` | 单元测试 | ✅ |
| `@testing-library/react` | React 组件测试 | ✅ |
| `jsdom` | DOM 测试环境 | ✅ |

**刻意不引入**：
- 不用 Redux（MVP 状态简单，Context 足够）。
- 不用 Tailwind（避免 MV3 CSP 与构建复杂度，用 CSS Modules）。
- 不用 i18n 框架（MVP 只面向中文用户，硬编码中文文案）。
- 不用状态机库（xstate 等，过度设计）。

---

## 12. 开放问题（待实施阶段确认）

以下不阻塞设计，留待实施时决策：

1. **对话历史的长度管理**：长对话会超上下文窗口。MVP 用简单的"保留最近 N 轮 + 网页内容摘要"策略；未来可加向量化检索。
2. **流式输出的取消**：用户中途想停止生成。需在 background 维护可中断的 AbortController，MVP 可先不支持，v1.1 加。
3. **离线本地 Ollama 的自动发现**：是否扫描常见端口/自动提示启动。MVP 仅在用户配置后调用，不自动发现。
4. **token 用量统计**：是否在 UI 展示花费。MVP 不做，可选。

---

## 13. 验收标准（MVP 完成定义）

MVP 视为完成，当且仅当：

1. ✅ 能在 Chrome 开发者模式加载未打包扩展，无控制台错误。
2. ✅ 配置一个 OpenAI 兼容 API Key 后，对英文新闻/技术博客能生成中文结构化摘要（流式）。
3. ✅ 在普通网页选中文字，浮现气泡，点击翻译得到中文译文。
4. ✅ sidepanel 三视图（摘要/翻译/对话）框架完整，摘要和翻译可用，对话视图至少有 UI 框架。
5. ✅ 在不支持页面（`chrome://`）给出友好提示而非崩溃。
6. ✅ API Key 在 options 页掩码存储，不明文暴露。
7. ✅ extractor、llm adapters、prompts 有单元测试覆盖核心路径。

---

## 14. 后续路线图

- **v1.1**: 网页问答对话完整可用 + 流式中断。
- **v1.2**: Ollama 本地模型 + Claude 适配。
- **v1.3**: 针对高频站点（GitHub README、arXiv）定制抽取规则。
- **v2.0**: 多标签页批量摘要（真正解决"网页太多"痛点）。
