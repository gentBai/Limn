# 改造方案：合并"翻译+对话"为"问一问 AI"

> **日期**: 2026-06-28
> **状态**: Approved
> **作者**: plan mode 协作产出

---

## 1. 背景与目标

### 1.1 问题陈述

当前扩展有三个 Tab：摘要 / 翻译 / 对话。其中：
- **翻译**：划词后只做纯翻译（流式逐字），结果记录为翻译列表
- **对话**：空壳占位（v1.1 计划），无实际功能

用户希望把这两个功能合并，升级为更强大的「**问一问 AI**」——划词后 AI 不只翻译，而是给出**大意 + 关键信息解读**，并且能通过**多轮对话**继续追问。

### 1.2 产品目标

把"翻译"和"对话"合并为一个统一入口"问一问 AI"，提供：
- **划词解读**：选中任意文字，AI 给出大意概括 + 关键信息提取（替代纯翻译）
- **多轮对话**：基于页面内容的连续追问，所有划词和追问串成单一对话流
- **气泡轻量 + 侧边栏深度**：气泡显示完整解读（不截断），追问在侧边栏

---

## 2. 设计决策（已确认）

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | Tab 结构 | 两 Tab 合为一（摘要 + 问一问 AI）| 结构最简，符合合并诉求 |
| 2 | 气泡交互 | 气泡轻量 + 侧边栏追问 | 复杂交互留在侧边栏，气泡保持轻量 |
| 3 | 对话上下文 | 单一对话流 | 所有划词+追问串在一起，上下文连贯 |
| 4 | AI 解读格式 | 大意 + 关键信息 | 结构清晰，适合快速理解 |
| 5 | 气泡内容 | 完整显示不截断 | 自适应高度 + 可滚动 |

---

## 3. 最终行为

### 3.1 Tab 结构变化

```
改造前：摘要 / 翻译 / 对话（三个 Tab）
改造后：摘要 / 问一问 AI（两个 Tab）
```

### 3.2 划词气泡行为

- 选中文字 → 浮现气泡（"🌐 问一问"）
- 点击 → 流式显示 AI 解读（完整内容，不截断）
- 气泡自适应高度，超长内容可滚动
- 完整解读同时进入侧边栏对话流
- 追问需到侧边栏（气泡不承载多轮对话）

### 3.3 侧边栏行为

- 对话界面：消息流（用户/AI 交替）+ 底部输入框
- 所有划词解读和追问都在同一个对话流里
- 划词触发的消息用特殊样式标记（区分主动提问 vs 划词解读）
- 切 Tab（摘要/问一问）不丢失对话状态

### 3.4 AI 解读格式

划词触发时，AI 输出：
```
【大意】
一句话概括选中内容的主旨。

【关键信息】
· 要点 1
· 要点 2
· 要点 3
```

---

## 4. 数据模型（核心改动）

### 4.1 ChatMessage

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** 是否由划词触发（用于 UI 区分展示） */
  fromSelection?: boolean;
  at: number;
}
```

### 4.2 TabState 变化

```typescript
// 改造前
interface TabState {
  tabId: number;
  pageContent: PageContent | null;
  summary: SummaryState;
  translations: TranslationRecord[];   // ← 删除
}

// 改造后
interface TabState {
  tabId: number;
  pageContent: PageContent | null;
  summary: SummaryState;
  chat: ChatMessage[];                 // ← 新增，单一对话流
}
```

### 4.3 ChatStreamChunk

```typescript
type ChatStreamChunk =
  | { kind: 'userAdded'; message: ChatMessage }   // 用户消息已加入对话流
  | { kind: 'streaming'; delta: string }          // AI 回复增量
  | { kind: 'done'; message: ChatMessage }        // AI 回复完成
  | { kind: 'error'; error: ErrorResponse };
```

---

## 5. 数据流

### 5.1 划词 → AI 解读 → 对话流

```
用户划词 → 气泡点击
  → content-script 发 chat:<tabId> port（带 selectedText）
  → background:
     1. selectedText 包装成 user message（"用户选中了这段文字：xxx，请解读..."）
        fromSelection: true，加入 chat[]
     2. 构建多轮对话 prompt：pageContent 做 system + 完整 chat[] 历史
     3. 调用 LLM 流式
     4. 每个 delta：
        - 推给气泡（完整 partial）
        - 推给侧边栏（如果打开）
     5. 完成后 assistant 回复加入 chat[]
     6. 广播 CHAT_UPDATED，侧边栏实时刷新
  → 气泡显示完整解读
  → 侧边栏对话流出现这条解读
```

### 5.2 侧边栏追问

```
用户在侧边栏输入 → 发 chat:<tabId> port（带 userMessage）
  → background:
     1. userMessage 加入 chat[]（fromSelection: false）
     2. 用完整 chat[] 历史 + pageContent 调 LLM 流式
     3. assistant 回复加入 chat[]
     4. 广播 CHAT_UPDATED
  → 侧边栏实时刷新
```

---

## 6. 文件改动清单

### 6.1 修改（10 个）

| 文件 | 改动 |
|------|------|
| `src/shared/messages.ts` | TranslationRecord→ChatMessage；TabState.chat；ChatStreamChunk；CHAT_UPDATED；删除 TRANSLATE_* 类型和 TranslateStreamChunk |
| `src/background/tab-state.ts` | addTranslation/updateTranslation → addChatMessage；emptyTabState 字段改 chat |
| `src/background/background.ts` | translate: port handler → chat: port handler；删除孤儿 TRANSLATE/TRANSLATE_AND_RECORD handler；广播改 CHAT_UPDATED |
| `src/content-script/index.ts` | 气泡回调改为发 chat: port，port 名带 tabId |
| `src/content-script/selection-bubble/Bubble.ts` | 气泡文案改"问一问"风格，完整显示解读（onDelta 不再 slice）|
| `src/content-script/selection-bubble/bubble.css` | 气泡加 max-height + overflow-y:auto，自适应高度 |
| `src/sidepanel/App.tsx` | translations 状态 → chat 状态；监听 CHAT_UPDATED；传 chat 给 AskView |
| `src/sidepanel/components/TabNav.tsx` | Tab 类型 `summary\|translate\|chat` → `summary\|ask`；列表两项 |
| `src/sidepanel/views/TranslateView.tsx` → 重写为 `AskView.tsx` | 对话界面（消息流 + 输入框）|
| `src/i18n/zh.ts` + `src/i18n/en.ts` | translate/chat key → ask key（新对话界面文案）|

### 6.2 新增（2 个）

| 文件 | 职责 |
|------|------|
| `src/prompts/chat.ts` | 解读 prompt（大意+关键信息）+ 多轮对话 prompt |
| `src/sidepanel/views/AskView.tsx` | 对话界面（消息流 + 输入框）|

### 6.3 删除（3 个）

| 文件 | 原因 |
|------|------|
| `src/prompts/translate.ts` | 翻译功能合并到对话，prompt 不再需要 |
| `src/background/handlers/translate.ts` | 孤儿代码（无调用方）|
| `src/sidepanel/views/ChatView.tsx` | 空壳占位，被 AskView 替代 |

---

## 7. 执行步骤

| Step | 内容 |
|------|------|
| **1** | 数据层：messages.ts 改 ChatMessage + TabState.chat + ChatStreamChunk + CHAT_UPDATED |
| **2** | tab-state.ts：chat 操作方法（addChatMessage 等）|
| **3** | prompts/chat.ts：解读 prompt + 多轮对话 prompt |
| **4** | background.ts：translate: port → chat: port；清理孤儿 handler；广播改 CHAT_UPDATED |
| **5** | content-script：气泡发 chat: port，完整显示解读；bubble.css 自适应高度 |
| **6** | sidepanel：TabNav 两项；App.tsx chat 状态；AskView 对话界面；删 ChatView |
| **7** | i18n：ask 相关文案 |
| **8** | 清理孤儿文件 + 验证 tsc + 测试 + build |

---

## 8. 折中点（需知晓）

1. **Token 累积**：单一对话流每轮带完整历史，长对话 token 增长。本次不加截断策略，后续可按需加"超过 N 轮截断"。
2. **不迁移旧数据**：原 translations[] 字段消失。session 存储本就浏览器关闭即清空，且这是功能重构，不做数据迁移。
3. **气泡完整显示**：气泡不截断，靠 max-height + overflow 滚动处理长内容。

---

## 9. 参考实现

对话功能可复用摘要功能的流式模式（port + hook + 广播）：

| 摘要（已有） | 对话（待实现） |
|------------|--------------|
| `summarize:${tabId}` port | `chat:${tabId}` port |
| `SummarizeChunk` 类型 | `ChatStreamChunk` 类型 |
| `useStreamingSummary` hook | 对话状态管理在 AskView |
| `TabState.summary: SummaryState` | `TabState.chat: ChatMessage[]` |
| `updateSummary` 持久化 | `addChatMessage` 持久化 |
| `buildSummaryPrompt`（一次性） | `buildChatPrompt`（拼接 pageContent + 历史）|

---

## 10. 验收标准

改造完成，当且仅当：
- [ ] 侧边栏只有两个 Tab：摘要 / 问一问 AI
- [ ] 划词后气泡点击能流式显示 AI 完整解读（大意 + 关键信息）
- [ ] 划词解读自动进入侧边栏对话流
- [ ] 侧边栏能多轮追问，AI 基于完整历史回答
- [ ] 切摘要/问一问 Tab 不丢失对话状态
- [ ] 切标签页对话状态按 tabId 隔离保留
- [ ] tsc 无错误，测试全过，build 成功
