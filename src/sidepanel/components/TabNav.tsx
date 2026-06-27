export type Tab = 'summary' | 'translate' | 'chat';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: '摘要' },
  { id: 'translate', label: '翻译' },
  { id: 'chat', label: '对话' },
];

export function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="sp-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`sp-tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
