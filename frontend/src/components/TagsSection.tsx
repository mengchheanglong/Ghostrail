import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TagsSection({
  tags, onAddTag, onRemoveTag,
}: {
  tags: string[];
  onAddTag: (t: string) => void;
  onRemoveTag: (t: string) => void;
}) {
  const [val, setVal] = useState('');

  const add = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onAddTag(trimmed);
    setVal('');
  };

  return (
    <div id="tagsSection">
      <p className="section-title">Tags</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '28px', marginBottom: '10px' }}>
        <AnimatePresence>
          {tags.map(tag => (
            <motion.span
              key={tag}
              className="tag-chip"
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75, width: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px 3px 10px', borderRadius: '9999px',
                background: 'var(--accent-dim)',
                border: '1px solid rgba(99,102,241,0.3)',
                fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600,
              }}
            >
              {tag}
              <button
                onClick={() => onRemoveTag(tag)}
                aria-label={`Remove tag ${tag}`}
                style={{
                  background: 'none', border: 'none', padding: 0, margin: 0,
                  cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.85rem',
                  lineHeight: 1, display: 'flex', alignItems: 'center',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
              >
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {tags.length === 0 && (
          <span className="muted" style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>No tags yet.</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id="tagInput"
          type="text"
          placeholder="Add tag…"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: 1, padding: '7px 12px', fontSize: '0.85rem' }}
        />
        <button id="addTagBtn" className="btn btn-accent-ghost" onClick={add} style={{ flexShrink: 0 }}>
          + Add
        </button>
      </div>
    </div>
  );
}
