import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import type { ErrorResponse, TokenUsage } from '@/shared/messages';

interface SummaryViewProps {
  tabId: number;
  configured: boolean;
  status: 'idle' | 'extracting' | 'streaming' | 'done' | 'error';
  text: string;
  error: ErrorResponse | null;
  usage: TokenUsage | null;
  summarize: (tabId: number) => void;
}

export function SummaryView({ tabId, configured, status, text, error, usage, summarize }: SummaryViewProps) {
  if (!configured) {
    return (
      <EmptyState
        icon="🔑"
        title="开始使用前需配置模型"
        desc="添加你的 API Key 即可开始摘要网页内容。数据仅存储在本地浏览器。"
        actionLabel="前往配置"
        onAction={() => chrome.runtime.openOptionsPage()}
      />
    );
  }

  if (status === 'idle') {
    return (
      <div className="sp-content">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => summarize(tabId)}>
          ⚡ 一键生成摘要
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="sp-content">
        <ErrorBox
          code={error!.code}
          message={error!.message}
          onRetry={() => summarize(tabId)}
          onAction={() => chrome.runtime.openOptionsPage()}
        />
      </div>
    );
  }

  return (
    <div className="sp-content">
      {status === 'extracting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="loading-dots"><span></span><span></span><span></span></span>
          <span className="text-xs text-tertiary">正在分析网页内容...</span>
        </div>
      )}
      <div className={`summary-text${status === 'streaming' ? ' streaming-text' : ''}`}>
        {text}
      </div>
      {status === 'done' && (
        <>
          <div className="action-bar">
            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(text)}>📋 复制</button>
            <button className="btn btn-secondary btn-sm" onClick={() => summarize(tabId)}>🔄 重新生成</button>
            {usage && (
              <span className="token-usage">
                消耗 {usage.input + usage.output} tokens
              </span>
            )}
          </div>
          {usage && (
            <p className="text-xs text-tertiary token-detail">
              输入 {usage.input} / 输出 {usage.output}
            </p>
          )}
        </>
      )}
    </div>
  );
}
