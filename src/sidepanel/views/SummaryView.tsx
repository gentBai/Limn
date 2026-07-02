import { EmptyState } from '../components/EmptyState';
import { ErrorBox } from '../components/ErrorBox';
import { Markdown } from '../components/Markdown';
import { t } from '@/i18n';
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
        title={t('summary.emptyTitle')}
        desc={t('summary.emptyDesc')}
        actionLabel={t('summary.emptyAction')}
        onAction={() => chrome.runtime.openOptionsPage()}
      />
    );
  }

  if (status === 'idle') {
    return (
      <div className="sp-content sp-content-centered">
        <button className="btn btn-primary btn-lg btn-block" onClick={() => summarize(tabId)}>
          {t('summary.generate')}
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
          <span className="text-xs text-tertiary">{t('summary.analyzing')}</span>
        </div>
      )}
      <div className={`summary-text${status === 'streaming' ? ' streaming-text' : ''}`}>
        <Markdown content={text} />
      </div>
      {status === 'done' && (
        <>
          <div className="action-bar">
            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(text)}>{t('summary.copy')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => summarize(tabId)}>{t('summary.regenerate')}</button>
          </div>
          {usage && (
            <div className="token-usage-row">
              {t('summary.tokens', { total: usage.input + usage.output })}
              <span className="token-usage-sep">·</span>
              {t('summary.tokenDetail', { input: usage.input, output: usage.output })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
