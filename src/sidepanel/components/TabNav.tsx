import { t } from '@/i18n';

export type Tab = 'summary' | 'translate' | 'chat';

export function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: t('tab.summary') },
    { id: 'translate', label: t('tab.translate') },
    { id: 'chat', label: t('tab.chat') },
  ];
  return (
    <nav className="sp-tabs">
      {tabs.map((tb) => (
        <button
          key={tb.id}
          className={`sp-tab${active === tb.id ? ' active' : ''}`}
          onClick={() => onChange(tb.id)}
        >
          {tb.label}
        </button>
      ))}
    </nav>
  );
}
