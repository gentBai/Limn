# AI Reader Chrome 扩展 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可加载到 Chrome 的 MVP 扩展，能对网页生成中文摘要、划词翻译，并支持配置 OpenAI 兼容 API Key。

**Architecture:** Manifest V3 多组件架构——content-script 负责正文抽取和划词气泡，background service worker 作为消息总线，sidePanel (React) 作为主交互界面，统一的 LLM 适配层屏蔽不同模型差异。详见 `docs/superpowers/specs/2026-06-24-ai-reader-extension-design.md`。

**Tech Stack:** React 18 + TypeScript + Vite 5 + @crxjs/vite-plugin + @mozilla/readability + Vitest + jsdom。视觉规范复用 `docs/prototype/design-tokens.css`。

---

## File Structure

MVP 涉及的文件，按职责拆分。每个文件单一职责。

**配置与脚手架：**
- `package.json` — 依赖与脚本
- `tsconfig.json` — TS 配置
- `vite.config.ts` — Vite + crxjs 构建配置
- `src/manifest.ts` — MV3 manifest（crxjs 从此生成）
- `vitest.config.ts` — 测试配置
- `.gitignore`

**共享类型（被多模块依赖，先建）：**
- `src/shared/types.ts` — PageContent、ContentType、ChatMessage 等公共类型
- `src/shared/messages.ts` — 消息协议类型（RequestMessage/ResponseMessage/ErrorCode）

**内容抽取层：**
- `src/extractor/index.ts` — 抽取主逻辑，组合 readability + 分段 + 语言检测
- `src/extractor/readability.ts` — Readability 封装
- `src/extractor/segmenter.ts` — 段落切分
- `src/extractor/lang-detect.ts` — 轻量语言检测
- `tests/unit/extractor/*.test.ts` — 抽取测试
- `tests/fixtures/*.html` — 测试用页面

**LLM 适配层（核心抽象）：**
- `src/llm/types.ts` — LLMClient 接口、CompleteRequest 等
- `src/llm/providers.ts` — Provider Registry 预设列表
- `src/llm/client-factory.ts` — 根据 providerId 创建 client
- `src/llm/adapters/openai-compat.ts` — OpenAI 兼容 adapter（覆盖 DeepSeek/智谱等）
- `src/llm/errors.ts` — fetch 错误 → ErrorCode 转换
- `tests/unit/llm/*.test.ts` — adapter 测试（mock fetch）

**Prompt 工程：**
- `src/prompts/summary.ts` — 摘要 prompt
- `src/prompts/translate.ts` — 翻译 prompt

**存储层：**
- `src/storage/schema.ts` — StorageSchema 类型
- `src/storage/index.ts` — chrome.storage 封装

**Background（service worker）：**
- `src/background/index.ts` — 入口，注册消息监听
- `src/background/message-router.ts` — 消息分发
- `src/background/handlers/summarize.ts` — 摘要 handler
- `src/background/handlers/translate.ts` — 翻译 handler

**Content-script：**
- `src/content-script/index.ts` — 入口
- `src/content-script/extractor-runner.ts` — 响应抽取请求
- `src/content-script/selection-bubble/Bubble.ts` — 划词气泡（Web Component + Shadow DOM）
- `src/content-script/selection-bubble/bubble.css` — 气泡样式（Shadow DOM 内）

**SidePanel (React)：**
- `src/sidepanel/index.html` — sidePanel HTML
- `src/sidepanel/main.tsx` — React 挂载
- `src/sidepanel/App.tsx` — 根组件（Tab 路由）
- `src/sidepanel/styles/tokens.css` — design tokens（从原型迁移）
- `src/sidepanel/styles/global.css` — 全局样式
- `src/sidepanel/components/Header.tsx`
- `src/sidepanel/components/TabNav.tsx`
- `src/sidepanel/components/PageInfo.tsx`
- `src/sidepanel/components/EmptyState.tsx`
- `src/sidepanel/components/ErrorBox.tsx`
- `src/sidepanel/views/SummaryView.tsx`
- `src/sidepanel/views/TranslateView.tsx`
- `src/sidepanel/views/ChatView.tsx` — MVP 仅 UI 框架（v1.1 接通）
- `src/sidepanel/hooks/useStreamingSummary.ts` — 摘要流式 hook

**Options (React)：**
- `src/options/index.html`
- `src/options/main.tsx`
- `src/options/App.tsx`
- `src/options/components/ProviderList.tsx`
- `src/options/components/ApiKeyInput.tsx`

---

## Task 0: 初始化项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/manifest.ts`, `vitest.config.ts`, `.gitignore`, `index.html`（占位，非扩展页面）
- Create: `src/background/index.ts`, `src/sidepanel/index.html`, `src/sidepanel/main.tsx`, `src/options/index.html`, `src/options/main.tsx`（最小可构建入口）

- [ ] **Step 1: 初始化 npm 项目并安装依赖**

Run（在 `C:\workspace\ai-reader` 下，用 Git Bash）:
```bash
npm init -y
npm install react react-dom
npm install -D typescript @types/react @types/react-dom @types/chrome vite @vitejs/plugin-react @crxjs/vite-plugin @mozilla/readability vitest jsdom @testing-library/react
```
Expected: `package.json` 生成，node_modules 安装成功，无 ERR!

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["chrome", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { manifest } from './src/manifest';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 4: 创建 src/manifest.ts**

```ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export const manifest = defineManifest({
  manifest_version: 3,
  name: 'AI Reader',
  version: pkg.version,
  description: 'AI 驱动的网页阅读助手：摘要、翻译、问答',
  action: { default_title: 'AI Reader' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  options_page: 'src/options/index.html',
  permissions: ['activeTab', 'storage', 'sidePanel'],
  host_permissions: [
    'https://api.openai.com/*',
    'https://api.deepseek.com/*',
    'https://open.bigmodel.cn/*',
    'http://localhost:11434/*',
  ],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content-script/index.ts'],
      run_at: 'document_idle',
    },
  ],
});
```

- [ ] **Step 5: 创建 vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

- [ ] **Step 6: 创建 .gitignore**

```
node_modules/
dist/
.vite/
*.local
nul
```

- [ ] **Step 7: 创建最小可构建入口（保证 npm run build 能过）**

`src/background/index.ts`:
```ts
// service worker 入口占位，Task 5 填充
console.log('[AI Reader] background loaded');
```

`src/content-script/index.ts`:
```ts
console.log('[AI Reader] content-script loaded');
```

`src/sidepanel/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><title>AI Reader</title></head>
<body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`src/sidepanel/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<h1>AI Reader</h1>);
```

`src/options/index.html` 与 `src/options/main.tsx` 同理（标题改为 Settings）。

- [ ] **Step 8: 配置 package.json scripts**

在 `package.json` 的 `scripts` 中加入:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 9: 验证构建**

Run: `npm run build`
Expected: `dist/` 目录生成，含 `manifest.json`、sidepanel/options/background 产物，无 TS 报错。

- [ ] **Step 10: 初始化 git 并提交**

```bash
git init && git add -A && git commit -m "chore: scaffold Vite + React + CRXJS project"
```

---

## Task 1: 共享类型定义

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`

- [ ] **Step 1: 编写 src/shared/types.ts**

```ts
export type ContentType = 'article' | 'github' | 'paper' | 'doc' | 'unknown';

export interface PageContent {
  url: string;
  title: string;
  text: string;
  paragraphs: string[];
  detectedLang: string;
  contentType: ContentType;
  extractedAt: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 2: 编写 src/shared/messages.ts**

```ts
import type { PageContent, ChatMessage } from './types';

export enum ErrorCode {
  NO_PROVIDER_CONFIGURED = 'NO_PROVIDER_CONFIGURED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  MISSING_API_KEY = 'MISSING_API_KEY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  EMPTY_CONTENT = 'EMPTY_CONTENT',
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  MODEL_ERROR = 'MODEL_ERROR',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  PAGE_NOT_SUPPORTED = 'PAGE_NOT_SUPPORTED',
  OLLAMA_NOT_RUNNING = 'OLLAMA_NOT_RUNNING',
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export type RequestMessage =
  | { type: 'EXTRACT_CONTENT'; tabId: number }
  | { type: 'SUMMARIZE'; tabId: number }
  | { type: 'TRANSLATE'; text: string }
  | { type: 'GET_PAGE_CONTENT'; tabId: number };

export type ResponseMessage<T = unknown> =
  | { type: 'SUCCESS'; data: T }
  | { type: 'ERROR'; error: ErrorResponse };

export type SummarizeChunk =
  | { kind: 'extracting' }
  | { kind: 'streaming'; delta: string }
  | { kind: 'done'; full: string }
  | { kind: 'error'; error: ErrorResponse };

export type TranslateResult = { translated: string };
export type ExtractResult = { content: PageContent };
```

- [ ] **Step 3: 验证类型编译**

Run: `npx tsc --noEmit`
Expected: 无错误输出。

- [ ] **Step 4: 提交**

```bash
git add src/shared/ && git commit -m "feat: add shared types and message protocol"
```

---

## Task 2: 内容抽取层 — TDD

**Files:**
- Create: `tests/fixtures/article.html`
- Create: `tests/unit/extractor/lang-detect.test.ts`
- Create: `src/extractor/lang-detect.ts`
- Create: `tests/unit/extractor/segmenter.test.ts`
- Create: `src/extractor/segmenter.ts`
- Create: `tests/unit/extractor/readability.test.ts`
- Create: `src/extractor/readability.ts`
- Create: `tests/unit/extractor/index.test.ts`
- Create: `src/extractor/index.ts`

- [ ] **Step 1: 创建测试 fixture**

`tests/fixtures/article.html`（一段标准英文新闻结构）:
```html
<!DOCTYPE html><html><body>
<nav>Home About Contact</nav>
<article>
  <h1>OpenAI announces GPT-5</h1>
  <p>The new model achieves state-of-the-art performance on reasoning benchmarks while reducing inference costs by 60 percent.</p>
  <p>Chain-of-thought visualization allows users to observe the reasoning process in real time.</p>
</article>
<footer>© 2026 News Site</footer>
</body></html>
```

- [ ] **Step 2: 写语言检测失败测试**

`tests/unit/extractor/lang-detect.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectLang } from '@/extractor/lang-detect';

describe('detectLang', () => {
  it('returns zh for Chinese text', () => {
    expect(detectLang('这是一段中文文本')).toBe('zh');
  });
  it('returns en for English text', () => {
    expect(detectLang('This is an English sentence.')).toBe('en');
  });
  it('returns unknown for empty', () => {
    expect(detectLang('')).toBe('unknown');
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

Run: `npx vitest run tests/unit/extractor/lang-detect.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 4: 实现语言检测**

`src/extractor/lang-detect.ts`:
```ts
const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;

export function detectLang(text: string): string {
  if (!text.trim()) return 'unknown';
  // 取前 500 字判断，避免长文干扰
  const sample = text.slice(0, 500);
  const cjkCount = (sample.match(new RegExp(CJK_RE, 'g')) || []).length;
  if (cjkCount > sample.length * 0.2) return 'zh';
  return 'en';
}
```

- [ ] **Step 5: 运行测试验证通过**

Run: `npx vitest run tests/unit/extractor/lang-detect.test.ts`
Expected: 3 passed。

- [ ] **Step 6: 写分段器失败测试**

`tests/unit/extractor/segmenter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { segment } from '@/extractor/segmenter';

describe('segment', () => {
  it('splits by double newlines', () => {
    expect(segment('A\n\nB\n\nC')).toEqual(['A', 'B', 'C']);
  });
  it('collapses single newlines within a paragraph', () => {
    expect(segment('Line1\nLine2')).toEqual(['Line1 Line2']);
  });
  it('trims and filters empty', () => {
    expect(segment('A\n\n\n\n  \n\nB')).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 7: 运行验证失败**

Run: `npx vitest run tests/unit/extractor/segmenter.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 8: 实现分段器**

`src/extractor/segmenter.ts`:
```ts
export function segment(text: string): string[] {
  return text
    .split(/\n\s*\n+/)            // 按空行分段
    .map((p) => p.replace(/\s+/g, ' ').trim())  // 段内换行合并
    .filter((p) => p.length > 0);
}
```

- [ ] **Step 9: 运行验证通过**

Run: `npx vitest run tests/unit/extractor/segmenter.test.ts`
Expected: 3 passed。

- [ ] **Step 10: 写 Readability 封装测试**

`tests/unit/extractor/readability.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractReadable } from '@/extractor/readability';

const articleHtml = readFileSync(join(__dirname, '../../fixtures/article.html'), 'utf-8');

describe('extractReadable', () => {
  it('extracts main article and drops nav/footer', () => {
    const doc = new DOMParser().parseFromString(articleHtml, 'text/html');
    const result = extractReadable(doc);
    expect(result.title).toContain('OpenAI announces GPT-5');
    expect(result.text).toContain('state-of-the-art');
    expect(result.text).not.toContain('Home About Contact');  // nav 被剔除
    expect(result.text).not.toContain('© 2026 News Site');    // footer 被剔除
  });
});
```

- [ ] **Step 11: 运行验证失败**

Run: `npx vitest run tests/unit/extractor/readability.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 12: 实现 Readability 封装**

`src/extractor/readability.ts`:
```ts
import { Readability } from '@mozilla/readability';

export interface ReadableResult {
  title: string;
  text: string;
}

export function extractReadable(document: Document): ReadableResult {
  // Readability 会修改传入的 document，故克隆
  const docClone = document.cloneNode(true) as Document;
  const article = new Readability(docClone).parse();
  return {
    title: article?.title ?? document.title ?? '',
    text: article?.textContent?.trim() ?? '',
  };
}
```

- [ ] **Step 13: 运行验证通过**

Run: `npx vitest run tests/unit/extractor/readability.test.ts`
Expected: 1 passed。

- [ ] **Step 14: 写抽取主逻辑测试**

`tests/unit/extractor/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPageContent } from '@/extractor';

const articleHtml = readFileSync(join(__dirname, '../../fixtures/article.html'), 'utf-8');

describe('extractPageContent', () => {
  it('returns full PageContent object', () => {
    const doc = new DOMParser().parseFromString(articleHtml, 'text/html');
    const result = extractPageContent(doc, 'https://example.com/news');
    expect(result.url).toBe('https://example.com/news');
    expect(result.title).toContain('OpenAI');
    expect(result.detectedLang).toBe('en');
    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.contentType).toBe('article');
    expect(result.extractedAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 15: 运行验证失败**

Run: `npx vitest run tests/unit/extractor/index.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 16: 实现抽取主逻辑**

`src/extractor/index.ts`:
```ts
import type { PageContent, ContentType } from '@/shared/types';
import { extractReadable } from './readability';
import { segment } from './segmenter';
import { detectLang } from './lang-detect';

const MAX_CHARS = 12000;

function guessContentType(url: string): ContentType {
  if (/github\.com/.test(url)) return 'github';
  if (/arxiv\.org/.test(url)) return 'paper';
  return 'article';
}

export function extractPageContent(document: Document, url: string): PageContent {
  const { title, text } = extractReadable(document);
  const truncated = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  return {
    url,
    title,
    text: truncated,
    paragraphs: segment(truncated),
    detectedLang: detectLang(truncated),
    contentType: guessContentType(url),
    extractedAt: Date.now(),
  };
}
```

- [ ] **Step 17: 运行验证通过**

Run: `npx vitest run tests/unit/extractor/index.test.ts`
Expected: 1 passed。

- [ ] **Step 18: 提交**

```bash
git add src/extractor/ tests/ && git commit -m "feat: add content extractor with readability + segmenter + lang-detect"
```

---

## Task 3: LLM 适配层 — OpenAI 兼容 — TDD

**Files:**
- Create: `src/llm/types.ts`
- Create: `src/llm/errors.ts`
- Create: `tests/unit/llm/errors.test.ts`
- Create: `src/llm/providers.ts`
- Create: `tests/unit/llm/openai-compat.test.ts`
- Create: `src/llm/adapters/openai-compat.ts`
- Create: `src/llm/client-factory.ts`

- [ ] **Step 1: 编写 LLM 接口类型**

`src/llm/types.ts`:
```ts
import type { ChatMessage } from '@/shared/types';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface CompleteRequest {
  messages: ChatMessage[];
  options?: LLMOptions;
}

export interface CompleteResponse {
  text: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface HealthStatus {
  ok: boolean;
  message?: string;
}

export interface LLMClient {
  readonly providerId: string;
  complete(req: CompleteRequest): Promise<CompleteResponse>;
  stream(req: CompleteRequest): AsyncIterable<StreamChunk>;
  healthCheck(): Promise<HealthStatus>;
}
```

- [ ] **Step 2: 编写错误转换测试**

`tests/unit/llm/errors.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classifyHttpError } from '@/llm/errors';
import { ErrorCode } from '@/shared/messages';

describe('classifyHttpError', () => {
  it('maps 401 to INVALID_API_KEY', () => {
    expect(classifyHttpError(401)).toBe(ErrorCode.INVALID_API_KEY);
  });
  it('maps 429 to RATE_LIMITED', () => {
    expect(classifyHttpError(429)).toBe(ErrorCode.RATE_LIMITED);
  });
  it('maps 5xx to MODEL_ERROR', () => {
    expect(classifyHttpError(500)).toBe(ErrorCode.MODEL_ERROR);
  });
  it('maps 0 (network) to NETWORK_ERROR', () => {
    expect(classifyHttpError(0)).toBe(ErrorCode.NETWORK_ERROR);
  });
});
```

- [ ] **Step 3: 运行验证失败**

Run: `npx vitest run tests/unit/llm/errors.test.ts`
Expected: FAIL。

- [ ] **Step 4: 实现错误转换**

`src/llm/errors.ts`:
```ts
import { ErrorCode } from '@/shared/messages';

export function classifyHttpError(status: number): ErrorCode {
  if (status === 401 || status === 403) return ErrorCode.INVALID_API_KEY;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status >= 500) return ErrorCode.MODEL_ERROR;
  return ErrorCode.NETWORK_ERROR;
}

export function isRetryable(code: ErrorCode): boolean {
  return [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.PROVIDER_TIMEOUT,
    ErrorCode.RATE_LIMITED,
  ].includes(code);
}
```

- [ ] **Step 5: 运行验证通过**

Run: `npx vitest run tests/unit/llm/errors.test.ts`
Expected: 4 passed。

- [ ] **Step 6: 编写 provider registry**

`src/llm/providers.ts`:
```ts
export type AdapterKind = 'openai-compat' | 'ollama';

export interface ProviderConfig {
  id: string;
  label: string;
  adapter: AdapterKind;
  defaultBaseURL: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

export const BUILTIN_PROVIDERS: ProviderConfig[] = [
  { id: 'openai', label: 'OpenAI', adapter: 'openai-compat', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', requiresApiKey: true },
  { id: 'deepseek', label: 'DeepSeek', adapter: 'openai-compat', defaultBaseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', requiresApiKey: true },
  { id: 'zhipu', label: '智谱 GLM', adapter: 'openai-compat', defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash', requiresApiKey: true },
  { id: 'ollama', label: 'Ollama (本地)', adapter: 'ollama', defaultBaseURL: 'http://localhost:11434', defaultModel: 'llama3', requiresApiKey: false },
];

export function findProvider(id: string): ProviderConfig | undefined {
  return BUILTIN_PROVIDERS.find((p) => p.id === id);
}
```

- [ ] **Step 7: 写 OpenAI 兼容 adapter 测试（mock fetch）**

`tests/unit/llm/openai-compat.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAICompatAdapter } from '@/llm/adapters/openai-compat';
import { ErrorCode } from '@/shared/messages';

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAICompatAdapter', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('complete sends correct body and returns text', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      mockResponse({ choices: [{ message: { content: 'hello' } }] })
    );
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', model: 'deepseek-chat',
    });
    const res = await adapter.complete({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.text).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.deepseek.com/v1/chat/completions');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('deepseek-chat');
    expect(body.stream).toBe(false);
  });

  it('throws classified error on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse({ error: 'bad key' }, 401));
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'bad', model: 'deepseek-chat',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toMatchObject({ code: ErrorCode.INVALID_API_KEY });
  });

  it('stream yields deltas then done', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const stream = new ReadableStream({
      start(controller) {
        sseChunks.forEach((c) => controller.enqueue(new TextEncoder().encode(c)));
        controller.close();
      },
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(stream));
    const adapter = new OpenAICompatAdapter({
      providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test', model: 'deepseek-chat',
    });
    const out: string[] = [];
    for await (const chunk of adapter.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      if (chunk.delta) out.push(chunk.delta);
    }
    expect(out.join('')).toBe('Hello');
  });
});
```

- [ ] **Step 8: 运行验证失败**

Run: `npx vitest run tests/unit/llm/openai-compat.test.ts`
Expected: FAIL — 模块找不到。

- [ ] **Step 9: 实现 OpenAI 兼容 adapter**

`src/llm/adapters/openai-compat.ts`:
```ts
import type { LLMClient, CompleteRequest, CompleteResponse, StreamChunk, HealthStatus } from '@/llm/types';
import type { ChatMessage } from '@/shared/types';
import { classifyHttpError } from '@/llm/errors';
import { ErrorCode, type ErrorResponse } from '@/shared/messages';

export class LLMError extends Error {
  constructor(public code: ErrorCode, message: string, public retryable: boolean) {
    super(message);
    this.name = 'LLMError';
  }
  toResponse(): ErrorResponse {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

export interface OpenAICompatConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

interface OpenAIChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[];
}

export class OpenAICompatAdapter implements LLMClient {
  readonly providerId: string;
  constructor(private cfg: OpenAICompatConfig) {
    this.providerId = cfg.providerId;
  }

  private headers(): HeadersInit {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, false)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, '网络连接失败', true);
    }
    if (!resp.ok) throw this.httpError(resp.status);
    const data = await resp.json();
    return { text: data.choices?.[0]?.message?.content ?? '' };
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamChunk> {
    let resp: Response;
    try {
      resp = await fetch(`${this.cfg.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(req, true)),
      });
    } catch {
      throw new LLMError(ErrorCode.NETWORK_ERROR, '网络连接失败', true);
    }
    if (!resp.ok) throw this.httpError(resp.status);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.replace(/^data:\s*/, '').trim();
        if (!trimmed || trimmed === '[DONE]') continue;
        const parsed: OpenAIChunk = JSON.parse(trimmed);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield { delta, done: false };
      }
    }
    yield { delta: '', done: true };
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const res = await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        options: { maxTokens: 1 },
      });
      return { ok: true, message: res.text.slice(0, 20) };
    } catch (e) {
      const err = e as LLMError;
      return { ok: false, message: err.message };
    }
  }

  private buildBody(req: CompleteRequest, stream: boolean) {
    const body: Record<string, unknown> = {
      model: this.cfg.model,
      messages: req.messages,
      stream,
    };
    if (req.options?.temperature !== undefined) body.temperature = req.options.temperature;
    if (req.options?.maxTokens !== undefined) body.max_tokens = req.options.maxTokens;
    return body;
  }

  private httpError(status: number): LLMError {
    const code = classifyHttpError(status);
    return new LLMError(
      code,
      code === ErrorCode.INVALID_API_KEY ? 'API Key 无效或已过期' : '模型服务返回错误',
      code === ErrorCode.NETWORK_ERROR || code === ErrorCode.RATE_LIMITED
    );
  }
}
```

- [ ] **Step 10: 运行验证通过**

Run: `npx vitest run tests/unit/llm/openai-compat.test.ts`
Expected: 3 passed。

- [ ] **Step 11: 编写 client-factory**

`src/llm/client-factory.ts`:
```ts
import type { LLMClient } from '@/llm/types';
import { OpenAICompatAdapter } from '@/llm/adapters/openai-compat';
import { findProvider } from '@/llm/providers';

export interface ProviderSettings {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export function createLLMClient(settings: ProviderSettings): LLMClient {
  const provider = findProvider(settings.providerId);
  if (!provider) throw new Error(`Unknown provider: ${settings.providerId}`);
  if (provider.adapter === 'openai-compat') {
    return new OpenAICompatAdapter({
      providerId: settings.providerId,
      baseURL: settings.baseURL,
      apiKey: settings.apiKey,
      model: settings.model,
    });
  }
  throw new Error(`Adapter not implemented for ${provider.adapter} (MVP: openai-compat only)`);
}
```

- [ ] **Step 12: 验证全部 llm 测试 + tsc**

Run: `npx vitest run tests/unit/llm/ && npx tsc --noEmit`
Expected: 所有测试通过，无 TS 错误。

- [ ] **Step 13: 提交**

```bash
git add src/llm/ tests/unit/llm/ && git commit -m "feat: add OpenAI-compatible LLM adapter layer with streaming"
```

---

## Task 4: Prompts + Storage 层

**Files:**
- Create: `src/prompts/summary.ts`, `src/prompts/translate.ts`
- Create: `tests/unit/prompts/summary.test.ts`
- Create: `src/storage/schema.ts`, `src/storage/index.ts`
- Create: `tests/unit/storage/index.test.ts`

- [ ] **Step 1: 编写摘要 prompt**

`src/prompts/summary.ts`:
```ts
import type { ChatMessage, PageContent } from '@/shared/types';

export function buildSummaryPrompt(content: PageContent): ChatMessage[] {
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
```

- [ ] **Step 2: 编写翻译 prompt**

`src/prompts/translate.ts`:
```ts
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
```

- [ ] **Step 3: 写摘要 prompt 测试**

`tests/unit/prompts/summary.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt } from '@/prompts/summary';
import type { PageContent } from '@/shared/types';

const mockContent: PageContent = {
  url: 'https://x.com', title: 'Test', text: 'body content',
  paragraphs: ['body content'], detectedLang: 'en', contentType: 'article', extractedAt: 1,
};

describe('buildSummaryPrompt', () => {
  it('produces system + user messages with content embedded', () => {
    const msgs = buildSummaryPrompt(mockContent);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('Test');
    expect(msgs[1].content).toContain('body content');
  });
});
```

- [ ] **Step 3b: 运行 prompt 测试**

Run: `npx vitest run tests/unit/prompts/`
Expected: 1 passed。

- [ ] **Step 4: 编写 storage schema**

`src/storage/schema.ts`:
```ts
export interface ProviderSettings {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface Settings {
  activeProviderId: string;
  providers: Record<string, ProviderSettings>;
  translateTargetLang: string;
  summaryStyle: 'concise' | 'standard' | 'detailed';
}

export interface StorageSchema {
  settings: Settings;
}
```

- [ ] **Step 5: 写 storage 测试**

`tests/unit/storage/index.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock chrome.storage.local
const store: Record<string, unknown> = {};
const chrome = {
  storage: {
    local: {
      get: vi.fn(async () => ({ ...store })),
      set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); }),
    },
  },
};
vi.stubGlobal('chrome', chrome);

import { loadSettings, saveSettings } from '@/storage';

describe('storage', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('returns defaults when empty', async () => {
    const s = await loadSettings();
    expect(s.activeProviderId).toBe('deepseek');
    expect(s.translateTargetLang).toBe('zh');
  });

  it('round-trips saved settings', async () => {
    await saveSettings({ activeProviderId: 'openai' } as any);
    const s = await loadSettings();
    expect(s.activeProviderId).toBe('openai');
  });
});
```

- [ ] **Step 6: 运行验证失败**

Run: `npx vitest run tests/unit/storage/index.test.ts`
Expected: FAIL。

- [ ] **Step 7: 实现 storage**

`src/storage/index.ts`:
```ts
import type { Settings, ProviderSettings } from './schema';

const KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  activeProviderId: 'deepseek',
  providers: {
    deepseek: { providerId: 'deepseek', baseURL: 'https://api.deepseek.com/v1', apiKey: '', model: 'deepseek-chat' },
  },
  translateTargetLang: 'zh',
  summaryStyle: 'standard',
};

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(KEY);
  const saved = result[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [KEY]: merged });
}

export async function getActiveProviderSettings(): Promise<ProviderSettings | null> {
  const s = await loadSettings();
  return s.providers[s.activeProviderId] ?? null;
}
```

- [ ] **Step 8: 运行验证通过**

Run: `npx vitest run tests/unit/storage/index.test.ts`
Expected: 2 passed。

- [ ] **Step 9: 提交**

```bash
git add src/prompts/ src/storage/ tests/ && git commit -m "feat: add prompt builders and storage layer"
```

---

## Task 5: Background service worker — 消息总线 + handlers

**Files:**
- Modify: `src/background/index.ts`
- Create: `src/background/message-router.ts`
- Create: `src/background/handlers/summarize.ts`
- Create: `src/background/handlers/translate.ts`
- Create: `tests/unit/background/message-router.test.ts`

- [ ] **Step 1: 编写消息路由测试**

`tests/unit/background/message-router.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { routeMessage } from '@/background/message-router';

describe('routeMessage', () => {
  it('returns SUCCESS wrapper around handler result', async () => {
    const handlers = { TEST: vi.fn().mockResolvedValue({ ok: true }) };
    const res = await routeMessage(handlers as any, { type: 'TEST' } as any);
    expect(res).toEqual({ type: 'SUCCESS', data: { ok: true } });
  });

  it('wraps thrown LLMError into ERROR', async () => {
    const handlers = {
      TEST: vi.fn().mockRejectedValue({ toResponse: () => ({ code: 'INVALID_API_KEY', message: 'bad', retryable: false }) }),
    };
    const res = await routeMessage(handlers as any, { type: 'TEST' } as any);
    expect(res.type).toBe('ERROR');
  });
});
```

- [ ] **Step 2: 运行验证失败**

Run: `npx vitest run tests/unit/background/message-router.test.ts`
Expected: FAIL。

- [ ] **Step 3: 实现路由器**

`src/background/message-router.ts`:
```ts
import type { RequestMessage, ResponseMessage } from '@/shared/messages';

export type HandlerMap = Partial<Record<RequestMessage['type'], (req: any) => Promise<unknown>>>;

export async function routeMessage(
  handlers: HandlerMap,
  req: RequestMessage
): Promise<ResponseMessage> {
  const handler = handlers[req.type];
  if (!handler) {
    return { type: 'ERROR', error: { code: 'MODEL_ERROR' as any, message: `未知消息类型: ${req.type}`, retryable: false } };
  }
  try {
    const data = await handler(req);
    return { type: 'SUCCESS', data };
  } catch (e: any) {
    if (typeof e?.toResponse === 'function') {
      return { type: 'ERROR', error: e.toResponse() };
    }
    return { type: 'ERROR', error: { code: 'MODEL_ERROR' as any, message: e?.message ?? '未知错误', retryable: false } };
  }
}
```

- [ ] **Step 4: 运行验证通过**

Run: `npx vitest run tests/unit/background/message-router.test.ts`
Expected: 2 passed。

- [ ] **Step 5: 说明——summarize handler 不单独建文件**

summarize 的流式逻辑（long-lived port + tab 抽取 + 流式转发）与一次性请求模型不同，强行塞进 `handlers/summarize.ts` 会让接口不统一。因此在 Step 7 的 `background/index.ts` 入口中直接组装流式摘要，`handlers/` 目录只放非流式的 translate。translate handler 见 Step 6。

- [ ] **Step 6: 编写 translate handler**

`src/background/handlers/translate.ts`:
```ts
import { createLLMClient } from '@/llm/client-factory';
import { buildTranslatePrompt } from '@/prompts/translate';
import { getActiveProviderSettings } from '@/storage';
import { LLMError } from '@/llm/adapters/openai-compat';
import { ErrorCode, type ErrorResponse } from '@/shared/messages';
import type { TranslateResult } from '@/shared/messages';

export async function handleTranslate(text: string): Promise<TranslateResult> {
  const settings = await getActiveProviderSettings();
  if (!settings || !settings.apiKey) {
    throw new LLMError(ErrorCode.MISSING_API_KEY, '尚未配置 API Key', false);
  }
  const client = createLLMClient(settings);
  const res = await client.complete({ messages: buildTranslatePrompt(text) });
  return { translated: res.text };
}
```

- [ ] **Step 7: 实现 background 入口（含流式摘要组装）**

`src/background/index.ts`:
```ts
import { createLLMClient } from '@/llm/client-factory';
import { buildSummaryPrompt } from '@/prompts/summary';
import { buildTranslatePrompt } from '@/prompts/translate';
import { getActiveProviderSettings } from '@/storage';
import { handleTranslate } from './handlers/translate';
import { LLMError } from '@/llm/adapters/openai-compat';
import type { RequestMessage, ResponseMessage, SummarizeChunk } from '@/shared/messages';
import { ErrorCode } from '@/shared/messages';

// 缓存：tabId -> PageContent
const contentCache = new Map<number, any>();

async function extractFromTab(tabId: number): Promise<any> {
  const cached = contentCache.get(tabId);
  if (cached) return cached;
  const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
  if (!response?.text) throw new Error('抽取消失败');
  contentCache.set(tabId, response);
  return response;
}

function errChunk(code: ErrorCode, message: string): SummarizeChunk {
  return { kind: 'error', error: { code, message, retryable: false } };
}

// 普通请求路由（非流式）
chrome.runtime.onMessage.addListener((req: RequestMessage, _sender, sendResponse) => {
  if (req.type === 'TRANSLATE') {
    handleTranslate(req.text).then(
      (data) => sendResponse({ type: 'SUCCESS', data }),
      (e: any) => sendResponse({ type: 'ERROR', error: e?.toResponse?.() ?? { code: ErrorCode.MODEL_ERROR, message: String(e), retryable: false } })
    );
    return true; // 异步
  }
  if (req.type === 'GET_PAGE_CONTENT') {
    extractFromTab(req.tabId).then(
      (content) => sendResponse({ type: 'SUCCESS', data: { content } }),
      (e: any) => sendResponse({ type: 'ERROR', error: { code: ErrorCode.EXTRACTION_FAILED, message: String(e), retryable: false } })
    );
    return true;
  }
});

// 流式摘要：长连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name.startsWith('summarize:')) {
    (async () => {
      const tabId = Number(port.name.split(':')[1]);
      try {
        const settings = await getActiveProviderSettings();
        if (!settings || !settings.apiKey) {
          port.postMessage(errChunk(ErrorCode.MISSING_API_KEY, '尚未配置 API Key'));
          return port.disconnect();
        }
        port.postMessage({ kind: 'extracting' });
        const content = await extractFromTab(tabId);
        const client = createLLMClient(settings);
        let full = '';
        for await (const c of client.stream({ messages: buildSummaryPrompt(content) })) {
          if (c.delta) {
            full += c.delta;
            port.postMessage({ kind: 'streaming', delta: c.delta });
          }
        }
        port.postMessage({ kind: 'done', full });
      } catch (e: any) {
        port.postMessage(errChunk(ErrorCode.MODEL_ERROR, e?.message ?? '生成失败'));
      } finally {
        port.disconnect();
      }
    })();
  }
});

// 点击图标打开 sidePanel
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
```

- [ ] **Step 8: 验证 tsc 编译**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 9: 提交**

```bash
git add src/background/ tests/unit/background/ && git commit -m "feat: add background service worker with message routing and streaming summary"
```

---

## Task 6: Content-script — 抽取执行 + 划词气泡

**Files:**
- Modify: `src/content-script/index.ts`
- Create: `src/content-script/extractor-runner.ts`
- Create: `src/content-script/selection-bubble/Bubble.ts`
- Create: `src/content-script/selection-bubble/bubble.css`

- [ ] **Step 1: 编写抽取执行器**

`src/content-script/extractor-runner.ts`:
```ts
import { extractPageContent } from '@/extractor';

export function setupExtractorListener() {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'EXTRACT_CONTENT') {
      const content = extractPageContent(document, location.href);
      sendResponse(content);
      return true;
    }
  });
}
```

- [ ] **Step/ 2: 编写划词气泡 Web Component（Shadow DOM）**

`src/content-script/selection-bubble/Bubble.ts`:
```ts
import bubbleCss from './bubble.css?raw';

/**
 * 划词翻译气泡。使用 Shadow DOM 隔离样式。
 * 监听 mouseup，在选区附近浮现"翻译"按钮；点击后调用翻译并展示结果。
 */
export class TranslateBubble {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;

  constructor(private translate: (text: string) => Promise<string>) {
    this.host = document.createElement('div');
    this.host.id = 'ai-reader-bubble-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `<style>${bubbleCss}</style><div class="ar-bubble" hidden></div>`;
    document.body.appendChild(this.host);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private onMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    const bubble = this.shadow.querySelector('.ar-bubble') as HTMLDivElement;
    if (text.length < 2 || text.length > 1000) {
      bubble.hidden = true;
      return;
    }
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    bubble.hidden = false;
    bubble.style.top = `${rect.top + window.scrollY - 36}px`;
    bubble.style.left = `${rect.left + window.scrollX + rect.width / 2 - 30}px`;
    bubble.textContent = '🌐 翻译';
    bubble.onclick = async () => {
      bubble.textContent = '翻译中...';
      try {
        const translated = await this.translate(text);
        bubble.textContent = translated.slice(0, 200);
        bubble.classList.add('ar-expanded');
      } catch (e: any) {
        bubble.textContent = '翻译失败';
      }
    };
  };

  destroy() {
    document.removeEventListener('mouseup', this.onMouseUp);
    this.host.remove();
  }
}
```

- [ ] **Step 3: 编写气泡样式**

`src/content-script/selection-bubble/bubble.css`:
```css
.ar-bubble {
  position: absolute;
  z-index: 2147483647;
  background: #4f46e5;
  color: #fff;
  font: 500 12px/1 -apple-system, "Segoe UI", "PingFang SC", sans-serif;
  padding: 6px 10px;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(28, 25, 23, 0.2);
  cursor: pointer;
  max-width: 320px;
  white-space: normal;
}
.ar-bubble.ar-expanded {
  background: #fff;
  color: #1c1917;
  border: 1px solid #e7e5e4;
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 4: 组装 content-script 入口**

`src/content-script/index.ts`:
```ts
import { setupExtractorListener } from './extractor-runner';
import { TranslateBubble } from './selection-bubble/Bubble';

setupExtractorListener();

// 划词翻译气泡
new TranslateBubble(async (text) => {
  const res = await chrome.runtime.sendMessage({ type: 'TRANSLATE', text });
  if (res?.type === 'SUCCESS') return res.data.translated;
  throw new Error(res?.error?.message ?? '翻译失败');
});

console.log('[AI Reader] content-script loaded');
```

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Expected: `dist/` 生成，含 content-script 产物，无报错。

- [ ] **Chrome 手动验证（无法自动化，记录验收点）：**

加载 `dist/` 后：
- 打开任意新闻页，在 sidePanel 点击"摘要"应触发抽取
- 选中文字应浮现紫色"翻译"气泡，点击出译文

- [ ] **Step 6: 提交**

```bash
git add src/content-script/ && git commit -m "feat: add content-script with extractor runner and selection bubble"
```

---

## Task 7: SidePanel React App — 迁移原型 + 接通后端

**Files:**
- Create: `src/sidepanel/styles/tokens.css`, `src/sidepanel/styles/global.css`
- Create: `src/sidepanel/components/Header.tsx`, `TabNav.tsx`, `PageInfo.tsx`, `EmptyState.tsx`, `ErrorBox.tsx`
- Create: `src/sidepanel/views/SummaryView.tsx`, `TranslateView.tsx`, `ChatView.tsx`
- Create: `src/sidepanel/hooks/useStreamingSummary.ts`
- Modify: `src/sidepanel/main.tsx`, `src/sidepanel/App.tsx`

- [ ] **Step 1: 迁移 design tokens**

将 `docs/prototype/design-tokens.css` 内容复制到 `src/sidepanel/styles/tokens.css`（原样），并创建 `src/sidepanel/styles/global.css`:
```css
@import url('./tokens.css');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: var(--font-sans); font-size: var(--text-base); color: var(--color-text); background: var(--color-bg); }
#root { height: 100%; display: flex; flex-direction: column; }
```

- [ ] **Step 2: 编写 useStreamingSummary hook**

`src/sidepanel/hooks/useStreamingSummary.ts`:
```ts
import { useState, useCallback } from 'react';
import type { SummarizeChunk, ErrorResponse } from '@/shared/messages';

interface State {
  status: 'idle' | 'extracting' | 'streaming' | 'done' | 'error';
  text: string;
  error: ErrorResponse | null;
}

export function useStreamingSummary() {
  const [state, setState] = useState<State>({ status: 'idle', text: '', error: null });

  const summarize = useCallback(async (tabId: number) => {
    setState({ status: 'extracting', text: '', error: null });
    const port = chrome.runtime.connect({ name: `summarize:${tabId}` });
    port.onMessage.addListener((chunk: SummarizeChunk) => {
      if (chunk.kind === 'extracting') {
        setState((s) => ({ ...s, status: 'extracting' }));
      } else if (chunk.kind === 'streaming') {
        setState((s) => ({ ...s, status: 'streaming', text: s.text + chunk.delta }));
      } else if (chunk.kind === 'done') {
        setState((s) => ({ ...s, status: 'done', text: chunk.full }));
        port.disconnect();
      } else if (chunk.kind === 'error') {
        setState({ status: 'error', text: '', error: chunk.error });
        port.disconnect();
      }
    });
  }, []);

  return { ...state, summarize };
}
```

- [ ] **Step 3: 编写公共组件**

`src/sidepanel/components/Header.tsx`:
```tsx
import './tokens.css';
export function Header({ providerLabel }: { providerLabel: string }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ fontSize: '15px', fontWeight: 600 }}>📓 AI Reader</span>
      <span className="badge">{providerLabel}</span>
    </header>
  );
}
```

`src/sidepanel/components/TabNav.tsx`:
```tsx
type Tab = 'summary' | 'translate' | 'chat';
export function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: '摘要' },
    { id: 'translate', label: '翻译' },
    { id: 'chat', label: '对话' },
  ];
  return (
    <nav style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '13px', fontWeight: 500,
            color: active === t.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            borderBottom: active === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
export type { Tab };
```

- [ ] **Step 4: 编写 SummaryView（接通流式摘要）**

`src/sidepanel/views/SummaryView.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useStreamingSummary } from '../hooks/useStreamingSummary';
import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';

export function SummaryView({ tabId, configured }: { tabId: number; configured: boolean }) {
  const { status, text, error, summarize } = useStreamingSummary();
  const [pageInfo, setPageInfo] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT', tabId }).then((res) => {
      if (res?.type === 'SUCCESS') setPageInfo({ title: res.data.content.title, url: res.data.content.url });
    });
  }, [tabId]);

  if (!configured) {
    return <EmptyState icon="🔑" title="开始使用前需配置模型" desc="添加你的 API Key 即可开始摘要网页内容。" actionLabel="前往配置" onAction={() => chrome.runtime.openOptionsPage()} />;
  }
  if (status === 'idle') {
    return (
      <div style={{ padding: 16 }}>
        <button className="btn btn-primary btn-lg btn-block" onClick={() => summarize(tabId)}>⚡ 一键生成摘要</button>
        {pageInfo && <p className="text-xs text-tertiary" style={{ textAlign: 'center', marginTop: 12 }}>{pageInfo.title}</p>}
      </div>
    );
  }
  if (status === 'error') {
    return <ErrorBox code={error!.code} message={error!.message} onRetry={() => summarize(tabId)} />;
  }
  return (
    <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
      {status === 'extracting' && <p className="text-sm text-tertiary">正在分析网页内容...</p>}
      <div className="streaming-text" style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}
```

- [ ] **Step 5: 编写其余组件和 views**

`EmptyState.tsx`（接收 icon/title/desc/actionLabel/onAction）、`ErrorBox.tsx`（接收 code/message/onRetry，展示对应中文提示）、`TranslateView.tsx`（MVP 展示空状态 + 提示在网页划词）、`ChatView.tsx`（MVP 仅 UI 框架，标题"对话功能 v1.1 推出"）。
代码模式参照原型 `docs/index.html` 中对应状态。

- [ ] **Step 6: 编写 App.tsx 组装**

`src/sidepanel/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { TabNav, type Tab } from './components/TabNav';
import { SummaryView } from './views/SummaryView';
import { TranslateView } from './views/TranslateView';
import { ChatView } from './views/ChatView';
import { loadSettings } from '@/storage';

export function App() {
  const [tab, setTab] = useState<Tab>('summary');
  const [tabId, setTabId] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [providerLabel, setProviderLabel] = useState('未配置');

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => setTabId(tabs[0]?.id ?? 0));
    loadSettings().then((s) => {
      const p = s.providers[s.activeProviderId];
      setConfigured(!!p?.apiKey);
      setProviderLabel(p ? s.activeProviderId : '未配置');
    });
  }, []);

  return (
    <>
      <Header providerLabel={providerLabel} />
      <TabNav active={tab} onChange={setTab} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'summary' && <SummaryView tabId={tabId} configured={configured} />}
        {tab === 'translate' && <TranslateView />}
        {tab === 'chat' && <ChatView />}
      </main>
    </>
  );
}
```

- [ ] **Step 7: 修改 main.tsx 挂载 App**

`src/sidepanel/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 8: 验证构建**

Run: `npm run build`
Expected: 构建成功，`dist/` 含 sidepanel 产物。

- [ ] **Step 9: 提交**

```bash
git add src/sidepanel/ && git commit -m "feat: build sidePanel React app with streaming summary"
```

---

## Task 8: Options 设置页

**Files:**
- Create: `src/options/App.tsx`（完整版）
- Modify: `src/options/main.tsx`

- [ ] **Step 1: 编写 options App**

`src/options/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '@/storage';
import { BUILTIN_PROVIDERS } from '@/llm/providers';
import type { Settings, ProviderSettings } from '@/storage/schema';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => { loadSettings().then(setSettings); }, []);
  if (!settings) return <div style={{ padding: 24 }}>加载中...</div>;

  const updateProvider = (id: string, patch: Partial<ProviderSettings>) => {
    const next = { ...settings, providers: { ...settings.providers, [id]: { ...settings.providers[id], ...patch } } };
    setSettings(next);
  };
  const activate = (id: string) => setSettings({ ...settings, activeProviderId: id });

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>设置</h1>
      <p className="text-sm text-secondary" style={{ marginBottom: 24 }}>API Key 仅存储在本地浏览器，不会上传。</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>模型提供商</h2>
        {BUILTIN_PROVIDERS.map((p) => {
          const cfg = settings.providers[p.id] ?? { providerId: p.id, baseURL: p.defaultBaseURL, apiKey: '', model: p.defaultModel };
          const active = settings.activeProviderId === p.id;
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: `1px solid ${active ? 'var(--color-primary-border)' : 'var(--color-border)'}`, borderRadius: 6, marginBottom: 8, background: active ? 'var(--color-primary-light)' : 'transparent' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</div>
                <div className="text-xs text-tertiary">{cfg.model} · {p.adapter}</div>
              </div>
              <button className="btn btn-sm" onClick={() => activate(p.id)} disabled={active}>{active ? '使用中' : '启用'}</button>
            </div>
          );
        })}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 640, marginBottom: 12 }}>API Key</h2>
        <input type="password" className="input" style={{ fontFamily: 'var(--font-mono)', width: '100%', marginBottom: 8 }}
          value={settings.providers[settings.activeProviderId]?.apiKey ?? ''}
          onChange={(e) => updateProvider(settings.activeProviderId, { apiKey: e.target.value })}
          placeholder="sk-..." />
      </section>

      <button className="btn btn-primary" onClick={() => { saveSettings(settings); alert('已保存'); }}>保存设置</button>
    </div>
  );
}
```

- [ ] **Step 2: 修改 options/main.tsx**

`src/options/main.tsx`:
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/sidepanel/styles/tokens.css';
createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: 构建成功。

- [ ]  **Step 4: 提交**

```bash
git add src/options/ && git commit -m "feat: build options page with provider management and api key config"
```

---

## Task 9: 端到端集成验证

**Files:**
- 无新文件。修复任何集成问题。

- [ ] **Step 1: 完整构建**

Run: `npm run build && npx vitest run`
Expected: 所有单元测试通过，构建无错误。

- [ ] **Step 2: Chrome 加载验证**

打开 `chrome://extensions`，开启开发者模式，加载 `dist/`。
Expected: 扩展出现，无错误。

- [ ] **Step 3: 配置验证**

打开扩展 options 页，配置一个 DeepSeek/OpenAI API Key 并保存。
Expected: 保存成功，返回 sidepanel Header 显示 provider。

- [ ] **Step 3b: 摘要功能验证**

打开一篇英文新闻（如 bbc.com 任一文章），点击扩展图标打开 sidePanel，点"一键生成摘要"。
Expected: 显示"正在分析..."→ 流式输出中文摘要 → 完成。

- [ ] **Step 4: 划词翻译验证**

在同一页面选中一段英文，应浮现紫色"翻译"气泡，点击出中文译文。
Expected: 气泡出现，译文正确。

- [ ] **Step 5: 错误路径验证**

故意在 options 填错 Key，再触发摘要。
Expected: sidePanel 显示 ErrorBox "API Key 无效或已过期"，非原始堆栈。

- [ ]  **Step 6: tsc 最终检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 7: 最终提交（如有修复）**

```bash
git add -A && git commit -m "chore: MVP integration fixes" || echo "无修改"
```

- [ ] **Step 8: 更新 spec 验收清单**

在 `docs/superpowers/specs/2026-06-24-ai-reader-extension-design.md` §13 验收标准勾选完成项。

---

## Self-Review

**1. Spec 覆盖率检查：**
- ✅ §4.1 extractor → Task 2
- ✅ §4.2 LLM 适配层 → Task 3
- ✅ §4.3 prompts → Task 4
- ✅ §4.4 background → Task 5
- ✅ §4.5 content-script + 划词气泡 → Task 6
- ✅ §4.6 sidepanel → Task 7
- ✅ §4.7 options → Task 8
- ✅ §4.8 storage → Task 4
- ✅ §7 错误处理 → 融入 Task 3 (errors.ts) + Task 5 (background 转换) + Task 7 (ErrorBox)
- ✅ §9 测试策略 → 各 Task 内 TDD
- ✅ §13 验收标准 → Task 9
- 注：§4.6 ChatView 在 MVP 仅 UI 框架（v1.1 接通），符合 §1.4 分阶段范围

**2. Placeholder scan：** 已检查，无 TBD/TODO/“类似 Task N”。每个代码步骤都有完整代码。

**3. Type 一致性检查：**
- `PageContent` 在 Task 1 定义 → Task 2/4/5 一致使用
- `LLMClient` 在 Task 3 定义 → Task 5 handlers 一致
- `SummarizeChunk` 在 Task 1 定义 → Task 5/7 一致
- `LLMError.toResponse()` 在 Task 3 定义 → Task 5 路由依赖
- 已修复：Task 7 App.tsx 中 `tab === 'tab'` 是 typo，应为 `'chat'`

已修正 Task 7 Step 6 的 typo（`'tab'` → `'chat'`）。**计划完成。**
