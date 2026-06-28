import { useState } from 'react';
import type { TranslationRecord } from '@/shared/messages';
import { EmptyState } from '../components/EmptyState';
import { t } from '@/i18n';

interface TranslateViewProps {
  translations: TranslationRecord[];
}

function formatTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function TranslateView({ translations }: TranslateViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (translations.length === 0) {
    return (
      <EmptyState
        icon="🌐"
        title={t('translate.emptyTitle')}
        desc={t('translate.emptyDesc')}
      />
    );
  }

  return (
    <div className="sp-content">
      <div className="translate-header">
        <span className="text-sm font-medium">{t('translate.records')}</span>
        <span className="badge">{t('translate.count', { count: translations.length })}</span>
      </div>
      <div className="translate-list">
        {translations.map((tr) => {
          const expanded = expandedId === tr.id;
          return (
            <div key={tr.id} className="translate-item">
              <div className="translate-item-source" onClick={() => setExpandedId(expanded ? null : tr.id)}>
                {tr.source}
              </div>
              <div className="translate-item-target">{tr.target}</div>
              <div className="translate-item-meta">
                <span className="text-xs text-tertiary">{formatTime(tr.at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
