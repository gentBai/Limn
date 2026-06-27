import { useState } from 'react';
import type { TranslationRecord } from '@/shared/messages';
import { EmptyState } from '../components/EmptyState';

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
        title="划词翻译"
        desc="在网页上选中任意文字，翻译结果会自动记录到这里。最新的翻译显示在最前面。"
      />
    );
  }

  return (
    <div className="sp-content">
      <div className="translate-header">
        <span className="text-sm font-medium">翻译记录</span>
        <span className="badge">{translations.length} 条</span>
      </div>
      <div className="translate-list">
        {translations.map((t) => {
          const expanded = expandedId === t.id;
          return (
            <div key={t.id} className="translate-item">
              <div className="translate-item-source" onClick={() => setExpandedId(expanded ? null : t.id)}>
                {t.source}
              </div>
              <div className="translate-item-target">{t.target}</div>
              <div className="translate-item-meta">
                <span className="text-xs text-tertiary">{formatTime(t.at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
