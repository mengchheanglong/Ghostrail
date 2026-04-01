import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scoreGoalQuality } from '../lib/goalQualityScore';
import { generatePack } from '../api';

export function GeneratorForm({ onPackCreated }: { onPackCreated: () => void }) {
  const [goal, setGoal]           = useState('');
  const [context, setContext]     = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [draftHint, setDraftHint] = useState(false);

  const quality    = scoreGoalQuality(goal);
  const showQuality = goal.trim().length > 0;

  const levelColor = quality.level === 'vague' ? 'var(--red)' : quality.level === 'partial' ? 'var(--amber)' : 'var(--green)';
  const levelBadge = quality.level === 'vague' ? 'badge-red' : quality.level === 'partial' ? 'badge-amber' : 'badge-green';

  const handleGenerate = async () => {
    if (!goal.trim()) { setError('Please enter a feature request first.'); return; }
    setError('');
    setIsGenerating(true);
    try {
      await generatePack(goal, context);
      setGoal('');
      setContext('');
      setDraftHint(false);
      onPackCreated();
    } catch (err: any) {
      setError(err.message || 'Error generating pack');
    } finally {
      setIsGenerating(false);
    }
  };

  /** Called by parent to prefill the form (re-run from saved pack) */
  const prefill = (g: string, c: string) => {
    setGoal(g);
    setContext(c);
    setDraftHint(true);
  };

  // Expose prefill via a global for the parent to call
  // (will be replaced with a proper ref/callback pattern later)
  (window as any).__ghostrailPrefill = prefill;

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <p className="section-title" style={{ marginBottom: '4px' }}>Generate Intent Pack</p>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
        Describe a feature or change in plain language. Ghostrail will extract a structured pack with goal, constraints, acceptance criteria, risks, and touched areas.
      </p>

      {/* Goal textarea */}
      <textarea
        id="goal"
        value={goal}
        onChange={e => setGoal(e.target.value)}
        placeholder="Describe the feature, e.g. 'Add subscription upgrade flow but do not break current billing or admin behavior.'"
        disabled={isGenerating}
        style={{ minHeight: '90px', marginBottom: '0' }}
      />

      {/* Quality bar */}
      <AnimatePresence>
        {showQuality && (
          <motion.div
            id="qualityBarWrap"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginTop: '10px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Track */}
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${quality.score}%`, background: levelColor }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', borderRadius: '2px' }}
                />
              </div>
              <span id="qualityLabel" className={`badge ${levelBadge}`}>
                {quality.level.charAt(0).toUpperCase() + quality.level.slice(1)}
              </span>
            </div>

            {/* Suggestions */}
            <AnimatePresence>
              {quality.suggestions.length > 0 && (
                <motion.ul
                  id="qualitySuggestions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ margin: '8px 0 0', paddingLeft: '14px', listStyle: 'none' }}
                >
                  {quality.suggestions.map((s, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '2px', display: 'flex', gap: '6px' }}
                    >
                      <span style={{ color: levelColor, flexShrink: 0 }}>›</span>
                      {s}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context textarea */}
      <textarea
        id="context"
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder="Optional context: tech stack, sensitive areas, business rules…"
        disabled={isGenerating}
        style={{ minHeight: '60px', marginTop: '12px' }}
      />

      {/* Draft hint */}
      {draftHint && (
        <div id="draftHint" className="alert" style={{ marginTop: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span>📋</span> Re-running from a saved pack. Edit the goal above and click Generate.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginTop: '12px' }}>
          <span>✕</span> {error}
        </div>
      )}

      {/* Submit */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          id="generate"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              Generating…
            </>
          ) : '⚡ Generate Intent Pack'}
        </button>
        {isGenerating && (
          <span className="muted" style={{ fontSize: '0.8rem' }}>This may take 15–30s…</span>
        )}
      </div>
    </div>
  );
}
