import { Tooltip } from './Tooltip';

const STATUSES = [
  { value: 'draft',       label: 'Draft',       badge: 'badge-muted'   },
  { value: 'approved',    label: 'Approved',    badge: 'badge-green'   },
  { value: 'in-progress', label: 'In Progress', badge: 'badge-accent'  },
  { value: 'done',        label: 'Done',        badge: 'badge-green'   },
  { value: 'blocked',     label: 'Blocked',     badge: 'badge-red'     },
  { value: 'abandoned',   label: 'Abandoned',   badge: 'badge-muted'   },
];

export function StatusDropdown({
  status, onChange,
}: {
  status: string | undefined;
  onChange: (s: string) => void;
}) {
  const current = STATUSES.find(s => s.value === (status || 'draft')) ?? STATUSES[0];

  return (
    <div id="statusRow" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <Tooltip content="Draft (planning), Approved (ready), In Progress (agent working), Done (complete), Blocked (needs help), Abandoned." position="top">
        <span className="field-label" style={{ cursor: 'help', borderBottom: '1px dotted rgba(255,255,255,0.3)' }}>Status</span>
      </Tooltip>
      <span className={`badge ${current.badge}`}>{current.label}</span>
      <select
        id="statusSelect"
        value={current.value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 'auto', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '6px' }}
      >
        {STATUSES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}
