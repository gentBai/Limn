<div align="center">

# 🕯️ Limn

**Illuminate every page.**

An AI-powered web reading assistant — one-click summaries, selection interpretation, multi-turn chat, and seamless multi-model switching.

English · [简体中文](./README.md)

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Configuration](#-model-configuration) · [Tech Stack](#-tech-stack)

</div>

---

## ✨ Features

Limn is a **Chrome Extension** (Manifest V3) that turns any web page into content an AI can understand, with three instant capabilities:

| Capability | Description |
|------------|-------------|
| **📄 One-Click Summary** | Extracts the main content → structured summary (core ideas / key points / who should read), with **token-by-token streaming** and **token usage** display |
| **💬 Ask AI** | Select any text and the AI gives you the **gist + key points** (not a plain translation); every selection and follow-up flows into a **single conversation stream** where you can keep asking questions based on the page |
| **🔀 Multi-Model** | OpenAI / DeepSeek / Zhipu GLM / Anthropic Claude / Ollama (local) — works out of the box, freely switchable |
| **🗂 Per-Tab Isolation** | Each tab keeps its own summary and conversation independently; switching tabs preserves state (backed by `chrome.storage.session`) |

> **Privacy-first**: API keys and configuration are stored only in the local browser (`chrome.storage`) and never pass through any third-party server. With Ollama, data never leaves your machine.

---

## 🏗️ Architecture

A Manifest V3 multi-component architecture with clear separation of concerns, message-driven:

```
┌─────────────────┐   EXTRACT_CONTENT    ┌──────────────────────┐
│  content-script │ ───────────────────▶ │  background (worker) │
│  · extraction    │◀──── streaming ──────│  · message bus        │
│  · hover bubble  │                      │  · LLM calls (stream) │
└─────────────────┘                      │  · TabState mgmt      │
                                         │  · cache / errors     │
                                         └──────────┬───────────┘
        ┌───────────────────────────────────────────┘
        ▼
┌─────────────────┐  SUMMARIZE / CHAT   ┌──────────────────────┐
│   sidePanel     │ ──────────────────▶ │   LLM Adapter Layer   │
│   (React)       │◀──── streaming ─────│  openai-compat        │
│  · summary/token│                     │  claude               │
│  · Ask AI       │                     │  ollama               │
└─────────────────┘                     └──────────────────────┘
        │  TAB_CHANGED / CHAT_UPDATED events
        │ optionsPage (React)
        ▼
   Model config / Provider management
```

**Design highlights:**

- **content-script** — Extracts main content with Readability, performs segmentation and language detection, recognizes content types (GitHub / arXiv / articles); the selection bubble uses Shadow DOM for style isolation and streams the full AI interpretation token-by-token.
- **background service worker** — The message bus and streaming hub: routes requests, calls the LLM, maintains `TabState` (per-tabId isolation), and unifies error codes.
- **LLM Adapter Layer** — Three protocol adapters (`openai-compat` / `claude` / `ollama`) abstract away vendor differences and uniformly parse token usage; adding a model only requires implementing `LLMProtocol`.
- **TabState (per-tab isolation)** — Stores `{ pageContent, summary, chat }` keyed by tabId in `chrome.storage.session`, surviving service-worker restarts; the sidebar auto-loads the matching state on tab switch.
- **sidePanel (React)** — The main UI with two tabs (Summary / Ask AI); listens to `TAB_CHANGED` / `CHAT_UPDATED` events for real-time refresh, and auto-switches to the conversation tab when a selection interpretation arrives.

---

## 🚀 Quick Start

### Requirements
- Node.js ≥ 18
- Chrome / Edge (Chromium-based)

### Develop & Build

```bash
# Install dependencies
npm install

# Dev mode (watch files)
npm run dev

# Production build (outputs to dist/)
npm run build
```

### Load in Browser

1. Run `npm run build`
2. Open `chrome://extensions/`, enable **Developer mode**
3. Click **Load unpacked**, select the `dist/` folder
4. Click the Limn icon in the toolbar to open the Side Panel

---

## 🔧 Model Configuration

On first use, configure at least one Provider on the **Options page**. Built-in templates fill in fields with one click:

| Provider | Protocol | API Key Required | Notes |
|----------|----------|------------------|-------|
| **OpenAI** | openai-compat | ✅ | gpt-4o-mini |
| **DeepSeek** | openai-compat | ✅ | Cost-effective |
| **Zhipu GLM** | openai-compat | ✅ | OpenAI-compatible |
| **Anthropic Claude** | claude | ✅ | Official Messages API |
| **Ollama** | ollama | ❌ | Local model, data stays on-device |

You can **freely modify any field** (URL / model / key) on top of a template, or create a **fully custom** Provider to adapt to any OpenAI-compatible service (e.g., Qwen, Kimi, Moonshot).

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| Build | Vite + [@crxjs/vite-plugin](https://github.com/crxjs/crxjs) |
| Content extraction | [@mozilla/readability](https://github.com/mozilla/readability) |
| Extension spec | Chrome Manifest V3 |
| Testing | Vitest + Testing Library + jsdom |

---

## 📂 Project Structure

```
src/
├── manifest.ts                 # Manifest V3 manifest (auto-injects version)
├── background/                 # Service Worker: message routing + streaming + TabState
│   ├── background.ts           # Entry (summary / chat port handlers)
│   ├── tab-state.ts            # Per-tab state management (session storage)
│   └── message-router.ts
├── content-script/             # Scripts injected into pages
│   ├── extractor-runner.ts     # Responds to content extraction requests
│   ├── selection-bubble/       # Selection bubble (Shadow DOM, streams AI interpretation)
│   └── index.ts
├── extractor/                  # Content extraction: readability + segmentation + lang detect
├── llm/                        # LLM adapter layer
│   ├── adapters/               # openai-compat / claude / ollama (all parse token usage)
│   ├── client-factory.ts       # Routes by protocol
│   ├── providers.ts            # Built-in Provider templates
│   └── types.ts
├── prompts/                    # Prompt construction (summary / chat)
├── sidepanel/                  # Main UI (React)
│   ├── views/                  # Summary / Ask
│   ├── components/
│   └── hooks/                  # useStreamingSummary / useChat
├── options/                    # Config page (React): provider list + detail form + language switch
├── i18n/                       # Lightweight i18n (zh / en, follows browser or manual override)
├── storage/                    # chrome.storage wrapper + schema
└── shared/                     # Shared types & message protocol (TabState / stream chunks)
```

---

## 🧪 Testing

```bash
npm test            # Run once
npm run test:watch  # Watch mode
```

Covers content extraction, all three LLM adapters (including stream parsing and token usage), message routing, TabState per-tab isolation, prompt construction, and the storage layer — 34 test cases in total.

---

## 🗺 Roadmap

| Version | Status | Scope |
|---------|--------|-------|
| **v1.0** | ✅ Released | Summary (streaming + tokens) / Ask AI (selection interpretation + multi-turn chat) / Multi-model / Per-tab isolation / Chinese & English |
| **v1.1** | 📋 TBD | Site-specific extraction (GitHub README / arXiv), stream interruption, conversation-history truncation |

---

## 📝 Name

**Limn** /lɪm/ — a verb meaning "to depict" or "to illuminate a manuscript".

Limn carries this imagery forward: **using AI to "illuminate" the essence of every page.**

> Tagline: *Limn — Illuminate every page.*

---

## 📄 License

ISC
