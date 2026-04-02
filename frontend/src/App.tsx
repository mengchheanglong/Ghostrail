import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { GeneratorForm } from './components/GeneratorForm';
import { ActionButtons } from './components/ActionButtons';
import { StatusDropdown } from './components/StatusDropdown';
import { EditableField } from './components/EditableField';
import { TagsSection } from './components/TagsSection';
import { PackHealthScore } from './components/PackHealthScore';
import { DriftAnalysis } from './components/DriftAnalysis';
import { GithubIssue } from './components/GithubIssue';
import { VersionHistory } from './components/VersionHistory';
import { PackDetailList } from './components/PackDetailList';
import { DetailTabs } from './components/DetailTabs';
import { OnboardingBanner } from './components/OnboardingBanner';
import { Tooltip } from './components/Tooltip';
import type { DetailTab } from './components/DetailTabs';
import { fetchPacks, updatePack } from './api';
import { relativeTime } from './lib/relativeTime';
import type { IntentPack } from './types';

const DISMISSED_KEY = 'ghostrail.onboarding.dismissed';

function truncateId(id: string): string {
  return `Pack #${id.slice(0, 6).toUpperCase()}`;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high:   'High confidence',
  medium: 'Medium confidence',
  low:    'Low confidence',
};

const CONFIDENCE_TOOLTIPS: Record<string, string> = {
  high:   'High confidence means the goal was specific enough for Ghostrail to produce reliable constraints and criteria.',
  medium: 'Medium confidence means the goal had some specificity but could benefit from more detail.',
  low:    'Low confidence means the goal was vague. Consider adding constraints or acceptance criteria.',
};

const REASONING_LABELS: Record<string, string> = {
  heuristic: 'Rule-based',
  llm:       'AI-powered',
  stub:      'Preview mode',
};

const REASONING_TOOLTIPS: Record<string, string> = {
  heuristic: 'Rule-based mode uses pattern analysis to generate the pack. No AI model is required.',
  llm:       'AI-powered mode uses a language model for deeper reasoning and more precise outputs.',
  stub:      'Preview mode uses a deterministic stub for testing purposes.',
};

function App() {
  const [packs, setPacks]         = useState<IntentPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [acknowledgedPacks, setAcknowledgedPacks] = useState<Set<string>>(new Set());
  const [historyKey, setHistoryKey] = useState(0);
  const [policyError, setPolicyError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('design');
  const [showBanner, setShowBanner] = useState<boolean>(
    () => localStorage.getItem(DISMISSED_KEY) !== 'true'
  );
  const [acknowledgeMsg, setAcknowledgeMsg] = useState('');

  const loadPacks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPacks();
      setPacks(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load packs. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadPacks(); }, []);

  const selectedPack = packs.find(p => p.id === selectedId);

  useEffect(() => { setPolicyError(''); setActiveTab('design'); }, [selectedId]);

  const handleDismissBanner = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setShowBanner(false);
  };

  const handlePackCreated = () => {
    handleDismissBanner();
    loadPacks();
  };

  const handleUpdatePack = async (updates: Partial<IntentPack>) => {
    if (!selectedId) return;
    const updated = await updatePack(selectedId, updates);
    setPacks(prev => prev.map(p => p.id === selectedId ? updated : p));
    setHistoryKey(k => k + 1);
    if (updates.archived === true && !showArchived) {
      setSelectedId(null);
    }
  };

  const handleStatusChange = (s: string) => {
    if (
      s === 'approved' &&
      selectedPack?.policyWarnings &&
      selectedPack.policyWarnings.length > 0 &&
      !acknowledgedPacks.has(selectedPack.id)
    ) {
      setPolicyError('Acknowledge the policy warnings below before approving this pack.');
      return;
    }
    setPolicyError('');
    handleUpdatePack({ status: s });
  };

  const handleAcknowledge = () => {
    if (!selectedPack) return;
    setAcknowledgedPacks(prev => new Set(prev).add(selectedPack.id));
    setAcknowledgeMsg('Warnings acknowledged — you can now approve this pack.');
    setTimeout(() => setAcknowledgeMsg(''), 3000);
  };

  const handleRerun = () => {
    if (!selectedPack) return;
    const prefill = (window as any).__ghostrailPrefill;
    if (prefill) {
      prefill(selectedPack.goal || '', selectedPack.repositoryContext || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="logo">
            <div className="logo-icon" aria-hidden="true">🛡</div>
            Ghostrail
          </div>
          <span className="logo-tagline">AI Guardrails for Coding Work</span>
          <div style={{ marginLeft: 'auto' }}>
            <a
              href="https://github.com/ghostrail/ghostrail#readme"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Help — open documentation"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                border: '1px solid var(--border)',
                color: 'var(--text-faint)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all var(--t-fast)',
              }}
            >
              ?
            </a>
          </div>
        </div>
      </header>

      <div className="wrap">
        {/* Onboarding banner — first-visit only */}
        <AnimatePresence>
          {showBanner && packs.length === 0 && (
            <OnboardingBanner onDismiss={handleDismissBanner} />
          )}
        </AnimatePresence>

        <GeneratorForm onPackCreated={handlePackCreated} />

        {/* Section separator */}
        <hr className="section-separator" />
        <p className="section-label">Your Saved Packs</p>

        <div className="layout" style={{ marginTop: 0 }}>
          <Sidebar
            packs={packs}
            isLoading={isLoading}
            error={error}
            selectedId={selectedId}
            onSelect={p => setSelectedId(p.id)}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(v => !v)}
            acknowledgedPacks={acknowledgedPacks}
            onRetry={loadPacks}
          />

          <main className="main">
            {selectedPack ? (
              <div id="detailCard" className="card no-top-margin">
                <ActionButtons
                  pack={selectedPack}
                  onUpdate={updated => {
                    setPacks(prev => prev.map(p => p.id === updated.id ? updated : p));
                    if (updated.archived && !showArchived) setSelectedId(null);
                  }}
                  onDelete={() => { loadPacks(); setSelectedId(null); }}
                  onRerun={handleRerun}
                  onDuplicate={newPack => {
                    loadPacks().then(() => setSelectedId(newPack.id));
                  }}
                />

                <div className="divider" style={{ marginTop: '4px' }} />

                {/* Pack metadata — truncated ID with tooltip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: '8px' }}>
                  <Tooltip content={selectedPack.id} position="bottom">
                    <code style={{ fontFamily: 'monospace', color: 'var(--text-muted)', cursor: 'help' }}>
                      {truncateId(selectedPack.id)}
                    </code>
                  </Tooltip>
                  <span>·</span>
                  <span title={new Date(selectedPack.createdAt).toLocaleString()}>
                    {relativeTime(selectedPack.createdAt)}
                  </span>
                </div>

                <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0 0 4px' }}>
                  Objective
                </p>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: '0 0 16px' }}>
                  {selectedPack.objective}
                </p>

                <StatusDropdown
                  status={selectedPack.status}
                  onChange={handleStatusChange}
                />

                {policyError && (
                  <div className="alert alert-warning" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '0.82rem' }}>
                    <span>⚠</span>
                    <span>{policyError}</span>
                  </div>
                )}

                {/* Tab bar */}
                <DetailTabs active={activeTab} onChange={setActiveTab} />

                {/* ── Design tab ── */}
                {activeTab === 'design' && (
                  <div id="designContent">
                    {/* Policy warnings */}
                    {selectedPack.policyWarnings && selectedPack.policyWarnings.length > 0 && (
                      <div id="policyWarnings" className="alert alert-warning" style={{ marginBottom: '16px', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <span>⚠</span>
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block', marginBottom: '4px' }}>Protected Area Warnings</strong>
                            <p style={{ margin: '0 0 8px', fontSize: '0.82rem', lineHeight: 1.5 }}>
                              This pack touches areas marked as protected in your repository policy. Review carefully before approving.
                            </p>
                            <ul style={{ margin: '0 0 8px', paddingLeft: '16px' }}>
                              {selectedPack.policyWarnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                            <details style={{ fontSize: '0.78rem', color: 'var(--amber)' }}>
                              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>What is this?</summary>
                              <p style={{ margin: '6px 0 0', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                                Ghostrail can enforce repository-level rules via a <code>ghostrail-policy.json</code> file.
                                When a pack's touched areas match a protected zone, a warning is raised so you can review
                                the impact before approving the work.
                              </p>
                            </details>
                            {!acknowledgedPacks.has(selectedPack.id) && (
                              <button
                                id="acknowledgeWarningsBtn"
                                className="btn btn-warning"
                                style={{ marginTop: '8px', padding: '4px 12px', fontSize: '0.78rem' }}
                                onClick={handleAcknowledge}
                              >
                                Acknowledge Warnings
                              </button>
                            )}
                            {acknowledgeMsg && (
                              <div className="alert alert-success" style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.78rem' }}>
                                ✓ {acknowledgeMsg}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div id="detailContent">
                      <EditableField fieldId="goal"    label="Original Goal"      value={selectedPack.goal || ''}               multiline onSave={v => handleUpdatePack({ goal: v })}                placeholder="No goal defined." />
                      <EditableField fieldId="context" label="Repository Context" value={selectedPack.repositoryContext || ''}  multiline onSave={v => handleUpdatePack({ repositoryContext: v })} placeholder="No context defined." />
                      <EditableField fieldId="notes"   label="Notes"              value={selectedPack.notes || ''}              multiline onSave={v => handleUpdatePack({ notes: v })}               placeholder="Add notes…" />

                      <div className="divider" />

                      <div className="inset-panel">
                        <PackDetailList label="Constraints"         items={selectedPack.constraints} />
                        <PackDetailList label="Acceptance Criteria" items={selectedPack.acceptanceCriteria} />
                        <PackDetailList label="Non-Goals"           items={selectedPack.nonGoals} />
                        <PackDetailList label="Touched Areas"       items={selectedPack.touchedAreas} />
                        <PackDetailList label="Risks"               items={selectedPack.risks} />
                        <PackDetailList label="Open Questions"      items={selectedPack.openQuestions} />
                      </div>

                      {/* Confidence & reasoning mode badges with tooltips */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <Tooltip content={CONFIDENCE_TOOLTIPS[selectedPack.confidence] ?? ''}>
                          <span className={`badge ${selectedPack.confidence === 'high' ? 'badge-green' : selectedPack.confidence === 'medium' ? 'badge-amber' : 'badge-red'}`}>
                            {CONFIDENCE_LABELS[selectedPack.confidence] ?? selectedPack.confidence}
                          </span>
                        </Tooltip>
                        <Tooltip content={REASONING_TOOLTIPS[selectedPack.reasoningMode] ?? ''}>
                          <span className="badge badge-muted">
                            {REASONING_LABELS[selectedPack.reasoningMode] ?? selectedPack.reasoningMode}
                          </span>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="divider" />

                    <TagsSection
                      tags={selectedPack.tags || []}
                      onAddTag={tag => {
                        const cur = selectedPack.tags || [];
                        if (!cur.includes(tag)) handleUpdatePack({ tags: [...cur, tag] });
                      }}
                      onRemoveTag={tag => handleUpdatePack({ tags: (selectedPack.tags || []).filter(t => t !== tag) })}
                    />
                  </div>
                )}

                {/* ── Health & History tab ── */}
                {activeTab === 'audit' && (
                  <div id="auditContent">
                    <PackHealthScore pack={selectedPack} />
                    <DriftAnalysis packId={selectedPack.id} onReportGenerated={() => {}} />
                    <VersionHistory key={`${selectedPack.id}-${historyKey}`} packId={selectedPack.id} />
                  </div>
                )}

                {/* ── Publish tab ── */}
                {activeTab === 'sync' && (
                  <div id="syncContent">
                    <GithubIssue pack={selectedPack} onIssueCreated={url => handleUpdatePack({ githubIssueUrl: url })} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {isLoading && (
                  <div className="card no-top-margin" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <p className="muted">Loading…</p>
                  </div>
                )}

                {/* First-visit empty state */}
                {!isLoading && packs.length === 0 && (
                  <div className="card no-top-margin" style={{ padding: '32px 28px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⬆️</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Start by generating your first pack</h3>
                    <p className="muted" style={{ marginBottom: '20px' }}>
                      Use the form above to describe what you want to build. Ghostrail will structure it into a pack with constraints, acceptance criteria, and risks.
                    </p>
                    <ol style={{ paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 2, margin: 0 }}>
                      <li>Write your feature request in the form above</li>
                      <li>Click <strong style={{ color: 'var(--text)' }}>Generate Pack</strong></li>
                      <li>Review the structured output here in the detail view</li>
                      <li>Use <strong style={{ color: 'var(--text)' }}>Health &amp; History</strong> to check quality, <strong style={{ color: 'var(--text)' }}>Publish</strong> to send to GitHub</li>
                    </ol>
                  </div>
                )}

                {/* Select-a-pack hint */}
                {!isLoading && packs.length > 0 && (
                  <div className="card no-top-margin" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.4 }}>←</div>
                    <p className="muted">Select a pack from the list to view its details.</p>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
