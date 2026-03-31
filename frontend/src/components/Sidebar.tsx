import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IntentPack } from '../types';

const STATUS_META: Record<string, { label: string; badge: string }> = {
  draft:       { label: 'Draft',       badge: 'badge-muted'  },
  approved:    { label: 'Approved',    badge: 'badge-green'  },
  'in-progress':{ label: 'In Progress', badge: 'badge-accent' },
  done:        { label: 'Done',        badge: 'badge-green'  },
  blocked:     { label: 'Blocked',     badge: 'badge-red'    },
  abandoned:   { label: 'Abandoned',   badge: 'badge-muted'  },
};

export function Sidebar({
  packs, isLoading, error, selectedId, onSelect, showArchived, onToggleArchived, acknowledgedPacks,
}: {
  packs: IntentPack[];
  isLoading: boolean;
  error: string;
  selectedId: string | null;
  onSelect: (pack: IntentPack) => void;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  acknowledgedPacks?: Set<string>;
}) {
  const [search, setSearch] = useState('');

  const visiblePacks = packs.filter(p => {
    if (!showArchived && p.archived) return false;
    return true;
  });

  const filtered = visiblePacks.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.goal?.toLowerCase().includes(q) || p.objective?.toLowerCase().includes(q);
  });

  return (
    <aside className="sidebar">
      <div className="card no-top-margin">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p className="section-title" style={{ margin: 0 }}>Saved Packs</p>
          <span className="badge badge-muted">{packs.length}</span>
        </div>

        <input
          id="packSearch"
          type="search"
          placeholder="Search packs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: '8px' }}
        />

        {/* Show archived toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: '10px', cursor: 'pointer' }}>
          <input
            id="showArchivedToggle"
            type="checkbox"
            checked={showArchived || false}
            onChange={() => onToggleArchived?.()}
            style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }}
          />
          Show archived
        </label>

        {isLoading && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>Loading…</span>
          </div>
        )}
        {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}
        {!isLoading && !error && filtered.length === 0 && (
          <p id="packListState" className="muted" style={{ fontSize: '0.82rem', textAlign: 'center', padding: '16px 0' }}>
            {search ? 'No packs match your search.' : 'No saved packs yet'}
          </p>
        )}

        <ul id="packList" style={{ listStyle: 'none', padding: 0, margin: 0, display: filtered.length > 0 ? 'flex' : 'none', flexDirection: 'column', gap: '6px' }}>
          <AnimatePresence>
            {filtered.map(pack => {
              const isSelected = selectedId === pack.id;
              const statusMeta = STATUS_META[pack.status || 'draft'] ?? STATUS_META.draft;
              return (
                <motion.li
                  key={pack.id}
                  className={`pack-item${isSelected ? ' selected' : ''}`}
                  data-id={pack.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={() => onSelect(pack)}
                  style={{
                    padding: '11px 13px',
                    borderRadius: '10px',
                    border: isSelected
                      ? '1px solid rgba(99,102,241,0.5)'
                      : '1px solid var(--border)',
                    background: isSelected
                      ? 'rgba(99,102,241,0.12)'
                      : 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.15s var(--ease-in-out)',
                  }}
                  whileHover={{ scale: 1.005, borderColor: isSelected ? 'rgba(99,102,241,0.6)' : 'var(--border-hover)' }}
                  whileTap={{ scale: 0.995 }}
                >
                  {/* Objective title */}
                  <div style={{
                    fontSize: '0.875rem', fontWeight: 600, color: isSelected ? '#e0e7ff' : 'var(--text)',
                    lineHeight: 1.35, marginBottom: '4px',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {pack.objective}
                  </div>

                  {/* Goal snippet */}
                  {pack.goal && (
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: '7px',
                    }}>
                      {pack.goal}
                    </div>
                  )}

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge ${pack.confidence === 'high' ? 'badge-green' : pack.confidence === 'medium' ? 'badge-amber' : 'badge-red'}`}>
                      {pack.confidence}
                    </span>
                    <span className={`badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                    {pack.starred && <span className="star-indicator" title="Starred" style={{ fontSize: '0.75rem' }}>★</span>}
                    {pack.archived && <span className="archived-indicator badge badge-muted" style={{ fontSize: '0.65rem' }}>Archived</span>}
                    {pack.policyWarnings && pack.policyWarnings.length > 0 && !acknowledgedPacks?.has(pack.id) && (
                      <span className="policy-warning-indicator" title="Unacknowledged policy warnings" style={{ color: 'var(--amber)', fontSize: '0.75rem' }}>⚠</span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </aside>
  );
}
