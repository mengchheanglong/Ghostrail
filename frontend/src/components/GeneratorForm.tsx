import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scoreGoalQuality } from '../lib/goalQualityScore';
import { generatePack, fetchClarifyingQuestions } from '../api';

export function GeneratorForm({ onPackCreated }: { onPackCreated: () => void }) {
  const [goal, setGoal]           = useState('');
  const [context, setContext]     = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [draftHint, setDraftHint] = useState(false);

  // Clarifying questions state
  const [stage, setStage]       = useState<'input' | 'clarifying'>('input');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers]   = useState<string[]>([]);

  const quality    = scoreGoalQuality(goal);
  const showQuality = goal.trim().length > 0;

  const levelColor = quality.level === 'vague' ? 'var(--red)' : quality.level === 'partial' ? 'var(--amber)' : 'var(--green)';
  const levelBadge = quality.level === 'vague' ? 'badge-red' : quality.level === 'partial' ? 'badge-amber' : 'badge-green';

  const resetForm = () => {
    setGoal('');
    setContext('');
    setDraftHint(false);
    setStage('input');
    setQuestions([]);
    setAnswers([]);
  };

  const doGenerate = async (withAnswers: string[]) => {
    await generatePack(goal, context, withAnswers.length > 0 ? withAnswers : undefined);
    resetForm();
    onPackCreated();
  };

  const handleGenerate = async () => {
    if (!goal.trim()) { setError('Please enter a feature request first.'); return; }
    setError('');
    setIsGenerating(true);
    try {
      if (stage === 'clarifying') {
        // Submit with the user's answers (filter blanks)
        await doGenerate(answers.filter(a => a.trim()));
        return;
      }

      // In 'input' stage: show clarifying questions only for vague goals when not re-running
      const shouldAsk = !draftHint && quality.level === 'vague';
      if (shouldAsk) {
        const qs = await fetchClarifyingQuestions(goal, context);
        if (qs.length > 0) {
          setIsGenerating(false);
          setQuestions(qs);
          setAnswers(qs.map(() => ''));
          setStage('clarifying');
          return;
        }
      }

      // Direct generate (clear goal, re-run, or no questions returned)
      await doGenerate([]);
    } catch (err: any) {
      setError(err.message || 'Error generating pack');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkipClarifying = async () => {
    setError('');
    setIsGenerating(true);
    try {
      await doGenerate([]);
    } catch (err: any) {
      setError(err.message || 'Error generating pack');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToInput = () => {
    setStage('input');
    setQuestions([]);
    setAnswers([]);
  };

  /** Called by parent to prefill the form (re-run from saved pack) */
  const prefill = (g: string, c: string) => {
    setGoal(g);
    setContext(c);
    setDraftHint(true);
    setStage('input');
    setQuestions([]);
    setAnswers([]);
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
        readOnly={stage === 'clarifying'}
        style={{ minHeight: '90px', marginBottom: '0', opacity: stage === 'clarifying' ? 0.6 : 1 }}
      />

      {/* Quality bar — only shown in input stage */}
      {stage === 'input' && (
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
      )}

      {/* Context textarea */}
      <textarea
        id="context"
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder="Optional context: tech stack, sensitive areas, business rules…"
        disabled={isGenerating}
        readOnly={stage === 'clarifying'}
        style={{ minHeight: '60px', marginTop: '12px', opacity: stage === 'clarifying' ? 0.6 : 1 }}
      />

      {/* Draft hint */}
      {draftHint && stage === 'input' && (
        <div id="draftHint" className="alert" style={{ marginTop: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span>📋</span> Re-running from a saved pack. Edit the goal above and click Generate.
        </div>
      )}

      {/* ── Clarifying questions section ── */}
      {stage === 'clarifying' && (
        <div id="clarifyingQuestions" style={{ marginTop: '16px' }}>
          <p className="section-title" style={{ marginBottom: '4px' }}>A few quick questions</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Your goal is a bit vague. Answering these will make the generated pack more precise — or skip to use what you have.
          </p>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600, margin: '0 0 5px', lineHeight: 1.4 }}>
                {i + 1}. {q}
              </p>
              <textarea
                id={`clarifyingAnswer-${i}`}
                value={answers[i] ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  setAnswers(prev => { const next = [...prev]; next[i] = val; return next; });
                }}
                placeholder="Optional — leave blank to skip this question."
                disabled={isGenerating}
                style={{ minHeight: '54px' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error" style={{ marginTop: '12px' }}>
          <span>✕</span> {error}
        </div>
      )}

      {/* Submit row */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button
          id="generate"
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
              {stage === 'clarifying' ? 'Generating…' : 'Loading…'}
            </>
          ) : '⚡ Generate Intent Pack'}
        </button>

        {stage === 'clarifying' && !isGenerating && (
          <>
            <button
              id="skipClarifyingBtn"
              className="btn btn-ghost"
              onClick={handleSkipClarifying}
            >
              Skip questions
            </button>
            <button
              id="backToInputBtn"
              className="btn btn-ghost"
              onClick={handleBackToInput}
              style={{ fontSize: '0.78rem' }}
            >
              ← Edit goal
            </button>
          </>
        )}

        {isGenerating && (
          <span className="muted" style={{ fontSize: '0.8rem' }}>This may take 15–30s…</span>
        )}
      </div>
    </div>
  );
}
