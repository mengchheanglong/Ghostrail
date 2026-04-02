import { useEffect, useState, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scoreGoalQuality } from '../lib/goalQualityScore';
import type { GoalQualityResult } from '../lib/goalQualityScore';
import { generatePack, fetchClarifyingQuestions } from '../api';

const QUALITY_LABELS: Record<GoalQualityResult['level'], string> = {
  vague:   'Needs more detail',
  partial: 'Getting there',
  clear:   'Looks good',
};

const QUALITY_CONFIRMATION = 'Your goal is specific enough to generate a high-quality pack.';

const GOAL_EXAMPLES = [
  {
    label: 'Billing Safety',
    goal: 'Add subscription upgrade flow without breaking existing billing behavior or admin permissions.',
  },
  {
    label: 'Search Performance',
    goal: 'Improve issue search performance for repositories with 100k+ files, but do not change ranking behavior.',
  },
  {
    label: 'Auth Hardening',
    goal: 'Add audit logging for admin role changes and preserve backward compatibility for existing token flows.',
  },
] as const;

const GENERATE_SHORTCUT_HINT = 'Tip: Press Ctrl+Enter (or Cmd+Enter) to generate.';
const DRAFT_GOAL_KEY = 'ghostrail.generator.draft.goal';
const DRAFT_CONTEXT_KEY = 'ghostrail.generator.draft.context';

function readDraftValue(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraftValue(key: string, value: string): void {
  try {
    if (value.trim().length > 0) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures (private mode, quota, disabled storage).
  }
}

function toUserMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message.split('\n')[0] || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function GeneratorForm({ onPackCreated }: { onPackCreated: () => void }) {
  const [goal, setGoal]           = useState(() => readDraftValue(DRAFT_GOAL_KEY));
  const [context, setContext]     = useState(() => readDraftValue(DRAFT_CONTEXT_KEY));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError]         = useState('');
  const [draftHint, setDraftHint] = useState(false);
  const [draftRestored, setDraftRestored] = useState(() => {
    return readDraftValue(DRAFT_GOAL_KEY).trim().length > 0 || readDraftValue(DRAFT_CONTEXT_KEY).trim().length > 0;
  });

  // Clarifying questions state
  const [stage, setStage]       = useState<'input' | 'clarifying'>('input');
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers]   = useState<string[]>([]);

  const quality    = scoreGoalQuality(goal);
  const showQuality = goal.trim().length > 0;
  const hasDraftContent = goal.trim().length > 0 || context.trim().length > 0;

  const levelColor = quality.level === 'vague' ? 'var(--red)' : quality.level === 'partial' ? 'var(--amber)' : 'var(--green)';
  const levelBadge = quality.level === 'vague' ? 'badge-red' : quality.level === 'partial' ? 'badge-amber' : 'badge-green';

  useEffect(() => {
    writeDraftValue(DRAFT_GOAL_KEY, goal);
  }, [goal]);

  useEffect(() => {
    writeDraftValue(DRAFT_CONTEXT_KEY, context);
  }, [context]);

  const resetForm = () => {
    setGoal('');
    setContext('');
    setDraftHint(false);
    setDraftRestored(false);
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
    if (!goal.trim()) { setError('Please describe what you want to build or change first.'); return; }
    setError('');
    setIsGenerating(true);
    try {
      if (stage === 'clarifying') {
        await doGenerate(answers.filter(a => a.trim()));
        return;
      }

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

      await doGenerate([]);
    } catch (err: unknown) {
      setError(toUserMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkipClarifying = async () => {
    setError('');
    setIsGenerating(true);
    try {
      await doGenerate([]);
    } catch (err: unknown) {
      setError(toUserMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToInput = () => {
    setStage('input');
    setQuestions([]);
    setAnswers([]);
  };

  const prefill = (g: string, c: string) => {
    setGoal(g);
    setContext(c);
    setDraftHint(true);
    setDraftRestored(false);
    setStage('input');
    setQuestions([]);
    setAnswers([]);
  };

  const handleUseExample = (exampleGoal: string) => {
    setGoal(exampleGoal);
    setDraftHint(false);
    setError('');
  };

  const handleClearDraft = () => {
    setGoal('');
    setContext('');
    setError('');
    setDraftHint(false);
    setDraftRestored(false);
    setStage('input');
    setQuestions([]);
    setAnswers([]);
    writeDraftValue(DRAFT_GOAL_KEY, '');
    writeDraftValue(DRAFT_CONTEXT_KEY, '');
  };

  const handleGenerateShortcut = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isGenerating) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleGenerate();
    }
  };

  (window as any).__ghostrailPrefill = prefill;

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <p className="section-title" style={{ marginBottom: '4px' }}>Generate a Pack</p>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.5 }}>
        Describe a feature or change in plain language. Ghostrail will extract a structured pack with goal, constraints, acceptance criteria, risks, and touched areas.
      </p>

      {draftRestored && !draftHint && stage === 'input' && (
        <div
          id="draftRestoredHint"
          className="alert"
          style={{ marginBottom: '10px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#6ee7b7' }}
        >
          <span>↺</span>
          <span>Restored your unsent draft from this browser.</span>
        </div>
      )}

      {/* Goal label + textarea */}
      <label
        htmlFor="goal"
        style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}
      >
        What do you want to build or change?
      </label>

      {stage === 'input' && (
        <div id="goalExamples" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Try an example:</span>
          {GOAL_EXAMPLES.map((example, idx) => (
            <button
              key={example.label}
              id={`goalExample-${idx}`}
              type="button"
              className="btn btn-ghost"
              onClick={() => handleUseExample(example.goal)}
              disabled={isGenerating}
              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
            >
              {example.label}
            </button>
          ))}
          {hasDraftContent && (
            <button
              id="clearDraftBtn"
              type="button"
              className="btn btn-ghost"
              onClick={handleClearDraft}
              disabled={isGenerating}
              style={{ fontSize: '0.72rem', padding: '4px 10px', marginLeft: 'auto' }}
            >
              Clear draft
            </button>
          )}
        </div>
      )}

      <div style={{ opacity: stage === 'clarifying' ? 0.6 : 1, pointerEvents: stage === 'clarifying' ? 'none' : 'auto' }}>
        <textarea
          id="goal"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={handleGenerateShortcut}
          placeholder="e.g. 'Add subscription upgrade flow but do not break current billing or admin behavior.'"
          disabled={isGenerating}
          readOnly={stage === 'clarifying'}
          style={{ minHeight: '90px', marginBottom: '0' }}
        />
      </div>

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
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${quality.score}%`, background: levelColor }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', borderRadius: '2px' }}
                  />
                </div>
                <span id="qualityLabel" className={`badge ${levelBadge}`}>
                  {QUALITY_LABELS[quality.level]}
                </span>
              </div>

              {/* Positive confirmation when clear */}
              {quality.level === 'clear' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontSize: '0.78rem', color: 'var(--green)', margin: '6px 0 0', lineHeight: 1.5 }}
                >
                  ✓ {QUALITY_CONFIRMATION}
                </motion.p>
              )}

              {/* Suggestions for vague/partial */}
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
      <div style={{ opacity: stage === 'clarifying' ? 0.6 : 1, pointerEvents: stage === 'clarifying' ? 'none' : 'auto' }}>
        <textarea
          id="context"
          value={context}
          onChange={e => setContext(e.target.value)}
          onKeyDown={handleGenerateShortcut}
          placeholder="Optional context: tech stack, sensitive areas, business rules…"
          disabled={isGenerating}
          readOnly={stage === 'clarifying'}
          style={{ minHeight: '60px', marginTop: '12px' }}
        />
      </div>

      {/* Draft hint */}
      {draftHint && stage === 'input' && (
        <div id="draftHint" className="alert" style={{ marginTop: '10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <span>📋</span> Re-running from a saved pack. Edit the goal above and click Generate.
        </div>
      )}

      {/* ── Clarifying questions section ── */}
      {stage === 'clarifying' && (
        <div id="clarifyingQuestions" className="clarifying-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <p className="section-title" style={{ margin: 0 }}>Step 2 of 2 — Answer a few questions</p>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
              {questions.length} {questions.length === 1 ? 'question' : 'questions'}
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Your goal needs a bit more detail. Answering these will make the generated pack more precise — or skip to use what you have.
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
                onKeyDown={handleGenerateShortcut}
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
        <div className="alert alert-error" style={{ marginTop: '12px', alignItems: 'center' }}>
          <span style={{ flexShrink: 0 }}>✕</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button
            className="btn btn-ghost"
            onClick={() => { setError(''); handleGenerate(); }}
            style={{ fontSize: '0.75rem', padding: '3px 10px', flexShrink: 0 }}
          >
            Try again
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setError('')}
            aria-label="Dismiss error"
            style={{ fontSize: '0.75rem', padding: '3px 8px', flexShrink: 0 }}
          >
            ✕
          </button>
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
              {stage === 'clarifying' ? 'Generating your pack…' : 'Loading…'}
            </>
          ) : '⚡ Generate Pack'}
        </button>

        {stage === 'clarifying' && !isGenerating && (
          <>
            <button
              id="skipClarifyingBtn"
              className="btn btn-ghost"
              onClick={handleSkipClarifying}
              title="Generate the pack using only your original goal, without extra context."
            >
              Skip &amp; use my goal as-is
            </button>
            <button
              id="backToInputBtn"
              className="btn btn-ghost"
              onClick={handleBackToInput}
              style={{ fontSize: '0.78rem' }}
            >
              ← Back to goal
            </button>
          </>
        )}

        {isGenerating && (
          <span className="muted" style={{ fontSize: '0.8rem' }}>This may take 15–30s…</span>
        )}

        {!isGenerating && (
          <span className="muted" style={{ fontSize: '0.74rem' }}>{GENERATE_SHORTCUT_HINT}</span>
        )}
      </div>
    </div>
  );
}
