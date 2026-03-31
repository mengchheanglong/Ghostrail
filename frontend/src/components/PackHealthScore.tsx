import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { computePackHealth } from '../lib/healthScore';
import type { IntentPack } from '../types';

const LEVEL_META = {
  excellent: { label: 'Excellent', badge: 'badge-green',  bar: 'var(--green)' },
  good:      { label: 'Good',      badge: 'badge-accent', bar: '#60a5fa'      },
  fair:      { label: 'Fair',      badge: 'badge-amber',  bar: 'var(--amber)' },
  poor:      { label: 'Poor',      badge: 'badge-red',    bar: 'var(--red)'   },
};

export function PackHealthScore({ pack }: { pack: IntentPack }) {
  const [isOpen, setIsOpen] = useState(false);
  const health = computePackHealth(pack);
  const meta   = LEVEL_META[health.level];

  return (
    <div id="healthSection" style={{
      marginTop: '16px',
      background: 'var(--bg-inset)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="section-title" style={{ margin: 0 }}>Pack Health</span>
          <span className={`badge ${meta.badge}`}>{health.score} — {meta.label}</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}
        >
          ▼
        </motion.span>
      </button>

      {/* Overall bar */}
      <div style={{ padding: '0 16px', marginBottom: isOpen ? 0 : '14px' }}>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${health.score}%`, background: meta.bar }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: '100%', borderRadius: '2px' }}
          />
        </div>
      </div>

      {/* Dimension breakdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {health.dimensions.map((dim, i) => {
                const barColor = dim.score >= 80 ? 'var(--green)' : dim.score >= 50 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{dim.name}</span>
                      <span style={{ fontWeight: 700, color: barColor }}>{dim.score}/100</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dim.score}%`, background: barColor }}
                        transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: '100%', borderRadius: '2px' }}
                      />
                    </div>
                    {dim.suggestions.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '14px', listStyle: 'none' }}>
                        {dim.suggestions.map((s, idx) => (
                          <li key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.5, display: 'flex', gap: '5px' }}>
                            <span style={{ color: 'var(--amber)', flexShrink: 0 }}>›</span> {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
