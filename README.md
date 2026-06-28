<div align="center">

# 🕯️ Limn

**照亮每一页 · Illuminate every page.**

AI 驱动的网页阅读助手 —— 一键摘要、划词解读、多轮追问、多模型自由切换。

[English](./README.en.md) · 简体中文

[功能](#-核心功能) · [架构](#-架构) · [快速开始](#-快速开始) · [配置](#-模型配置) · [技术栈](#-技术栈)

</div>

---

## ✨ 核心功能

Limn 是一个 **Chrome 浏览器扩展**（Manifest V3），把任意网页变成可被 AI 理解的内容，提供三种即时能力：

| 能力 | 说明 |
|------|------|
| **📄 一键摘要** | 智能提取网页正文 → 结构化摘要（核心观点 / 关键要点 / 适用人群），**流式逐字输出**，并显示本次 **token 消耗** |
| **💬 问一问 AI** | 划词后 AI 给出**大意 + 关键信息解读**（替代纯翻译）；所有划词和追问汇入**单一对话流**，可基于页面内容多轮追问 |
| **🔀 多模型接入** | OpenAI / DeepSeek / 智谱 GLM / Anthropic Claude / Ollama（本地），开箱即用，自由切换 |
| **🗂 多页面隔离** | 每个标签页独立保留各自的摘要和对话，切换标签页状态不丢失（基于 `chrome.storage.session`） |

> **隐私优先**：API Key 与配置仅存储在本地浏览器（`chrome.storage`），不经过任何第三方服务器。选用 Ollama 时数据完全不出本机。

---

## 🏗️ 架构

采用 Manifest V3 多组件架构，职责清晰、消息驱动：

```
┌─────────────────┐   EXTRACT_CONTENT    ┌──────────────────────┐
│  content-script │ ───────────────────▶ │  background (worker) │
│  · 正文抽取      │◀──── streaming ──────│  · 消息总线 / 路由      │
│  · 划词气泡      │                      │  · LLM 调用（流式）     │
└─────────────────┘                      │  · TabState 管理       │
                                         │  · 缓存 / 错误处理      │
                                         └──────────┬───────────┘
        ┌───────────────────────────────────────────┘
        ▼
┌─────────────────┐  SUMMARIZE / CHAT   ┌──────────────────────┐
│   sidePanel     │ ──────────────────▶ │   LLM 适配层          │
│   (React)       │◀──── streaming ─────│  openai-compat        │
│  · 摘要 / token │                     │  claude               │
│  · 问一问 AI    │                     │  ollama               │
└─────────────────┘                     └──────────────────────┘
        │  TAB_CHANGED / CHAT_UPDATED 事件
        │ optionsPage (React)
        ▼
   模型配置 / Provider 管理
```

**设计要点：**

- **content-script** —— 用 Readability 抽取正文，分段、语言检测，识别 GitHub / arXiv / 普通文章等内容类型；划词气泡用 Shadow DOM 隔离样式，点击后流式显示 AI 的完整解读。
- **background service worker** —— 作为消息总线和流式调用中枢，负责路由请求、调用 LLM、维护 `TabState`（按 tabId 隔离的状态）、统一错误码。
- **LLM 适配层** —— 三种协议适配器（`openai-compat` / `claude` / `ollama`）屏蔽厂商差异，统一解析 token 用量，新增模型只需实现 `LLMProtocol`。
- **TabState（多页面隔离）** —— 按 tabId 把 `{ pageContent, summary, chat }` 存入 `chrome.storage.session`，跨 service worker 重启保留。切标签页时 sidepanel 自动加载对应状态。
- **sidePanel (React)** —— 主交互界面，两个 Tab（摘要 / 问一问 AI）；监听 `TAB_CHANGED` / `CHAT_UPDATED` 事件实时刷新，划词解读到达时自动切换到对话 Tab。

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
│   ├── background.ts           # 入口（摘要 / 对话 port handler）
│   ├── tab-state.ts            # 按 tabId 隔离的状态管理（session 存储）
│   └── message-router.ts
├── content-script/             # 注入页面的脚本
│   ├── extractor-runner.ts     # 响应正文抽取请求
│   ├── selection-bubble/       # 划词气泡（Shadow DOM，流式显示 AI 解读）
│   └── index.ts
├── extractor/                  # 正文抽取：readability + 分段 + 语种检测
├── llm/                        # LLM 适配层
│   ├── adapters/               # openai-compat / claude / ollama（均解析 token usage）
│   ├── client-factory.ts       # 按协议路由
│   ├── providers.ts            # 内置 Provider 模板
│   └── types.ts
├── prompts/                    # 提示词构建（summary / chat）
├── sidepanel/                  # 主界面（React）
│   ├── views/                  # Summary / Ask
│   ├── components/
│   └── hooks/                  # useStreamingSummary / useChat
├── options/                    # 配置页（React）：Provider 列表 + 详情表单 + 语言切换
├── i18n/                       # 轻量国际化（zh / en，跟随浏览器或手动覆盖）
├── storage/                    # chrome.storage 封装 + schema
└── shared/                     # 共享类型与消息协议（TabState / 流式 chunk）
```

---

## 🧪 测试

```bash
npm test            # 单次运行
npm run test:watch  # 监听模式
```

覆盖正文抽取、三个 LLM adapters（含流式解析与 token usage）、消息路由、TabState 多页面隔离、Prompt 构建、存储层，共 34 个用例。

---

## 🗺 路线图

| 版本 | 状态 | 内容 |
|------|------|------|
| **v1.0** | ✅ 已完成 | 摘要（流式 + token） / 问一问 AI（划词解读 + 多轮对话） / 多模型 / 多页面隔离 / 中英双语 |
| **v1.1** | 📋 待定 | 站点定制抽取（GitHub README / arXiv）、流式中断、对话历史截断策略 |

---

## 📝 命名由来

**Limn** /lɪm/ —— 动词，意为「描绘、为手抄本加彩饰」。

Limn 延续这个意象：**用 AI 为每一页网页「点亮」要义**。

> Tagline: *Limn — Illuminate every page.*

---

## 📄 License

[GPL-3.0](./LICENSE) © 2026 gentBai
