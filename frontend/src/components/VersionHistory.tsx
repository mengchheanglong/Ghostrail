import { useState, useEffect } from 'react';
import { fetchHistory } from '../api';
import { relativeTime } from '../lib/relativeTime';

/** Convert a camelCase or snake_case field name to a readable Title Case label. */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

export function VersionHistory({ packId }: { packId: string }) {
  const [history, setHistory]     = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchHistory(packId);
        if (!cancelled) setHistory(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [packId]);

  return (
    <div id="historySection" style={{ marginTop: '16px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px' }}>
        <span className="section-title" style={{ margin: 0 }}>Version History</span>
      </div>

      <div id="historyContent" style={{ padding: '0 16px 16px' }}>
        {isLoading && <p className="muted" style={{ fontSize: '0.82rem' }}>Loading…</p>}
        {!isLoading && history.length === 0 && (
          <p className="muted" style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>No history yet</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.map((entry, i) => (
            <div key={i} className="history-entry" style={{
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginBottom: '6px' }}
                   title={new Date(entry.patchedAt).toLocaleString()}>
                {relativeTime(entry.patchedAt)}
              </div>
              {entry.before && Object.entries(entry.before).map(([field, oldVal]) => (
                <div key={field} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-faint)' }}>{formatFieldName(field)}:</span>{' '}
                  <span style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{String(oldVal)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
