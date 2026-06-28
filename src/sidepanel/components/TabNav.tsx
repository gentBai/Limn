import { t } from '@/i18n';

export type Tab = 'summary' | 'ask';

export function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: t('tab.summary') },
    { id: 'ask', label: t('tab.ask') },
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
