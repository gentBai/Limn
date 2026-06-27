import { EmptyState } from '../components/EmptyState';

export function ChatView() {
  // MVP: 对话视图仅 UI 框架，完整对话功能在 v1.1 推出
  return (
    <EmptyState
      icon="💬"
      title="网页问答对话"
      desc="基于当前网页内容的多轮对话追问功能将在 v1.1 版本推出，敬请期待。"
    />
  );
}
