// New helper component for pack detail sections (no inline styles)
export function PackDetailList({ label, items }: { label: string; items?: string[] }) {
  const empty = !items || items.length === 0;
  return (
    <div style={{ marginBottom: '20px' }}>
      <p className="section-title">{label}</p>
      <ul className={`detail-list${empty ? ' empty' : ''}`}>
        {empty
          ? <li>None specified</li>
          : items!.map((item, i) => <li key={i}>{item}</li>)
        }
      </ul>
    </div>
  );
}
