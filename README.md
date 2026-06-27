<div align="center">

# 🕯️ Limn

**照亮每一页 · Illuminate every page.**

AI 驱动的网页阅读助手 —— 一键摘要、划词翻译、多模型自由切换。

[功能](#-核心功能) · [架构](#-架构) · [快速开始](#-快速开始) · [配置](#-模型配置) · [技术栈](#-技术栈)

</div>

---

## ✨ 核心功能

Limn 是一个 **Chrome 浏览器扩展**（Manifest V3），把任意网页变成可被 AI 理解的内容，提供三种即时能力：

| 能力 | 说明 |
|------|------|
| **📄 一键摘要** | 智能提取网页正文 → 结构化中文摘要（核心观点 / 关键要点 / 适用人群），**流式逐字输出**，并显示本次 **token 消耗** |
| **🌐 划词翻译** | 选中任意文本即在原位弹出气泡翻译（流式逐字），译文同时**记录到侧边栏翻译 Tab**，按页面隔离留存 |
| **🔀 多模型接入** | OpenAI / DeepSeek / 智谱 GLM / Anthropic Claude / Ollama（本地），开箱即用，自由切换 |
| **🗂 多页面隔离** | 每个标签页独立保留各自的摘要、翻译记录，切换标签页状态不丢失（基于 `chrome.storage.session`） |

> **隐私优先**：API Key 与配置仅存储在本地浏览器（`chrome.storage`），不经过任何第三方服务器。选用 Ollama 时数据完全不出本机。

---

## 🏗️ 架构

采用 Manifest V3 多组件架构，职责清晰、消息驱动：

```
┌─────────────────┐   EXTRACT_CONTENT   ┌──────────────────────┐
│  content-script │ ───────────────────▶│  background (worker) │
│  · 正文抽取      │◀─── streaming ──────│  · 消息总线 / 路由      │
│  · 划词气泡      │                     │  · LLM 调用（流式）     │
└─────────────────┘                     │  · TabState 管理       │
                                        │  · 缓存 / 错误处理      │
                                        └──────────┬───────────┘
        ┌──────────────────────────────────────────┘
        ▼
┌─────────────────┐   SUMMARIZE/TRANSLATE ┌──────────────────────┐
│   sidePanel     │ ────────────────────▶│   LLM 适配层           │
│   (React)       │◀───── streaming ──────│  openai-compat        │
│  · 摘要 / token │                       │  claude               │
│  · 翻译记录     │                       │  ollama               │
│  · 问答 (v1.1)  │                       └──────────────────────┘
└─────────────────┘
        │  TAB_CHANGED / TRANSLATION_UPDATED 事件
        │ optionsPage (React)
        ▼
   模型配置 / Provider 管理
```

**设计要点：**

- **content-script** —— 用 Readability 抽取正文，分段、语言检测，识别 GitHub / arXiv / 普通文章等内容类型；划词翻译气泡用 Shadow DOM 隔离样式，点击后流式逐字填充译文。
- **background service worker** —— 作为消息总线和流式调用中枢，负责路由请求、调用 LLM、维护 `TabState`（按 tabId 隔离的状态）、统一错误码。
- **LLM 适配层** —— 三种协议适配器（`openai-compat` / `claude` / `ollama`）屏蔽厂商差异，统一解析 token 用量，新增模型只需实现 `LLMProtocol`。
- **TabState（多页面隔离）** —— 按 tabId 把 `{ pageContent, summary, translations }` 存入 `chrome.storage.session`，跨 service worker 重启保留。切标签页时 sidepanel 自动加载对应状态。
- **sidePanel (React)** —— 主交互界面，Tab 切换不丢失状态；监听 `TAB_CHANGED` / `TRANSLATION_UPDATED` 事件实时刷新。

---

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18
- Chrome / Edge（Chromium 内核）

### 开发与构建

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建（产物输出到 dist/）
npm run build
```

### 在浏览器加载

1. 运行 `npm run build`
2. 打开 `chrome://extensions/`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择项目根目录的 `dist/` 文件夹
4. 点击工具栏的 Limn 图标，打开 Side Panel

---

## 🔧 模型配置

首次使用需在 **Options 页面**配置至少一个 Provider。内置模板一键填充：

| Provider | 协议 | 是否需 API Key | 备注 |
|----------|------|----------------|------|
| **OpenAI** | openai-compat | ✅ | gpt-4o-mini |
| **DeepSeek** | openai-compat | ✅ | 性价比高 |
| **智谱 GLM** | openai-compat | ✅ | 国产，兼容 OpenAI |
| **Anthropic Claude** | claude | ✅ | 官方 Messages API |
| **Ollama** | ollama | ❌ | 本地模型，数据不出本机 |

支持在模板基础上**自由修改任意字段**（地址 / 模型 / Key），也可**完全自定义新建** Provider，适配任意 OpenAI 兼容服务（如通义千问、Kimi 等）。

---

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| UI | React 19 + TypeScript |
| 构建 | Vite + [@crxjs/vite-plugin](https://github.com/crxjs/crxjs) |
| 正文抽取 | [@mozilla/readability](https://github.com/mozilla/readability) |
| 扩展规范 | Chrome Manifest V3 |
| 测试 | Vitest + Testing Library + jsdom |

---

## 📂 项目结构

```
src/
├── manifest.ts                 # Manifest V3 清单（自动注入版本）
├── background/                 # Service Worker：消息路由 + 流式调用 + TabState
│   ├── background.ts           # 入口（摘要/翻译 port handler）
│   ├── tab-state.ts            # 按 tabId 隔离的状态管理（session 存储）
│   ├── message-router.ts
│   └── handlers/               # translate 处理器
├── content-script/             # 注入页面的脚本
│   ├── extractor-runner.ts     # 响应正文抽取请求
│   ├── selection-bubble/       # 划词翻译气泡（Shadow DOM，流式逐字）
│   └── index.ts
├── extractor/                  # 正文抽取：readability + 分段 + 语种检测
├── llm/                        # LLM 适配层
│   ├── adapters/               # openai-compat / claude / ollama（均解析 token usage）
│   ├── client-factory.ts       # 按协议路由
│   ├── providers.ts            # 内置 Provider 模板
│   └── types.ts
├── prompts/                    # 提示词构建（summary / translate）
├── sidepanel/                  # 主界面（React）
│   ├── views/                  # Summary / Translate / Chat
│   ├── components/
│   └── hooks/                  # useStreamingSummary
├── options/                    # 配置页（React）：Provider 列表 + 详情表单
├── storage/                    # chrome.storage 封装 + schema
└── shared/                     # 共享类型与消息协议（TabState / 流式 chunk）
```

---

## 🧪 测试

```bash
npm test            # 单次运行
npm run test:watch  # 监听模式
```

覆盖正文抽取、三个 LLM adapter（含流式解析）、消息路由、TabState 多页面隔离、Prompt 构建、存储层，共 31 个用例。

---

## 🗺 路线图

| 版本 | 状态 | 内容 |
|------|------|------|
| **MVP** | ✅ 已完成 | 摘要（流式 + token） / 划词翻译（流式 + 记录） / 多模型 / 多页面隔离 |
| **v1.1** | 🚧 规划中 | 网页问答对话（基于当前页面内容的多轮追问） |
| **v1.2** | 📋 待定 | 站点定制抽取（GitHub README / arXiv）、流式中断 |

---

## 📝 命名由来

**Limn** /lɪm/ —— 动词，意为「描绘、为手抄本加彩饰」。

Limn 延续这个意象：**用 AI 为每一页网页「点亮」要义**。

> Tagline: *Limn — Illuminate every page.*

---

## 📄 License

ISC
