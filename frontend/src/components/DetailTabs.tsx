export type DetailTab = 'design' | 'audit' | 'sync';

const TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: 'design', label: 'Design', icon: '✏' },
  { id: 'audit',  label: 'Audit',  icon: '🔍' },
  { id: 'sync',   label: 'Sync',   icon: '↑' },
];

export function DetailTabs({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      borderBottom: '1px solid var(--border)',
      marginTop: '20px',
      marginBottom: '20px',
    }}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          style={{
            padding: '8px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: active === tab.id
              ? '2px solid var(--accent)'
              : '2px solid transparent',
            color: active === tab.id ? 'var(--text)' : 'var(--text-faint)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: active === tab.id ? 700 : 500,
            fontFamily: 'var(--font-primary)',
            transition: 'all var(--t-fast)',
            marginBottom: '-1px',
            letterSpacing: '0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
