export type DetailTab = 'design' | 'audit' | 'sync';

const TABS: { id: DetailTab; label: string; icon: string; desc: string; title: string }[] = [
  { id: 'design', label: 'Design', icon: '✏',  desc: 'Goal · Constraints · Criteria', title: 'View and edit the intent pack fields: goal, context, constraints, acceptance criteria, and more' },
  { id: 'audit',  label: 'Audit',  icon: '🔍', desc: 'Health · Drift · History',      title: 'Check pack health score, analyze diff drift, and view version history' },
  { id: 'sync',   label: 'Sync',   icon: '🔗', desc: 'GitHub Issues',                 title: 'Create a linked GitHub issue from this intent pack' },
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
          title={tab.title}
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
            fontFamily: 'var(--font-primary)',
            transition: 'all var(--t-fast)',
            marginBottom: '-1px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '1px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: active === tab.id ? 700 : 500, letterSpacing: '0.01em' }}>
            <span style={{ fontSize: '0.75rem' }}>{tab.icon}</span>
            {tab.label}
          </span>
          <span style={{ fontSize: '0.62rem', color: active === tab.id ? 'rgba(165,180,252,0.75)' : 'var(--text-faint)', fontWeight: 400, letterSpacing: '0.01em', paddingLeft: '18px' }}>
            {tab.desc}
          </span>
        </button>
      ))}
    </div>
  );
}
