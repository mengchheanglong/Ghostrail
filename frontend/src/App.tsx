import { useState, useEffect } from 'react';
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
import { fetchPacks, updatePack } from './api';
import type { IntentPack } from './types';

function App() {
  const [packs, setPacks]         = useState<IntentPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [acknowledgedPacks, setAcknowledgedPacks] = useState<Set<string>>(new Set());
  const [historyKey, setHistoryKey] = useState(0);
  const [policyError, setPolicyError] = useState('');

  const loadPacks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPacks();
      setPacks(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (err: any) {
      setError(err.message || 'Error fetching packs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadPacks(); }, []);

  const selectedPack = packs.find(p => p.id === selectedId);

  // Clear policy error when switching packs
  useEffect(() => { setPolicyError(''); }, [selectedId]);

  const handleUpdatePack = async (updates: Partial<IntentPack>) => {
    if (!selectedId) return;
    const updated = await updatePack(selectedId, updates);
    setPacks(prev => prev.map(p => p.id === selectedId ? updated : p));
    setHistoryKey(k => k + 1);
  };

  const handleStatusChange = (s: string) => {
    if (
      s === 'approved' &&
      selectedPack?.policyWarnings &&
      selectedPack.policyWarnings.length > 0 &&
      !acknowledgedPacks.has(selectedPack.id)
    ) {
      setPolicyError('⚠ Acknowledge policy warnings before approving.');
      return;
    }
    setPolicyError('');
    handleUpdatePack({ status: s });
  };

  const handleAcknowledge = () => {
    if (!selectedPack) return;
    setAcknowledgedPacks(prev => new Set(prev).add(selectedPack.id));
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
            <div className="logo-icon">⚡</div>
            Ghostrail
          </div>
          <span className="logo-tagline">Intent Pack Generator</span>
        </div>
      </header>

      <div className="wrap">
        <h1 className="page-title">Your Intent Packs</h1>
        <p className="page-subtitle">
          Turn a vague software request into a structured intent pack for humans and coding agents.
        </p>

        <GeneratorForm onPackCreated={loadPacks} />

        <div className="layout">
          <Sidebar
            packs={packs}
            isLoading={isLoading}
            error={error}
            selectedId={selectedId}
            onSelect={p => setSelectedId(p.id)}
            showArchived={showArchived}
            onToggleArchived={() => setShowArchived(v => !v)}
            acknowledgedPacks={acknowledgedPacks}
          />

          <main className="main">
            {selectedPack ? (
              <div id="detailCard" className="card no-top-margin">
                <ActionButtons
                  pack={selectedPack}
                  onUpdate={updated => setPacks(prev => prev.map(p => p.id === updated.id ? updated : p))}
                  onDelete={() => { loadPacks(); setSelectedId(null); }}
                  onRerun={handleRerun}
                  onDuplicate={newPack => {
                    loadPacks().then(() => setSelectedId(newPack.id));
                  }}
                />

                <div className="divider" style={{ marginTop: '4px' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-faint)', marginBottom: '8px' }}>
                  <span>ID: <code style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{selectedPack.id}</code></span>
                  <span>·</span>
                  <span>{new Date(selectedPack.createdAt).toLocaleString()}</span>
                </div>

                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: '0 0 16px' }}>
                  {selectedPack.objective}
                </p>

                <StatusDropdown
                  status={selectedPack.status}
                  onChange={handleStatusChange}
                />
                
                {policyError && (
                  <span id="exportStatus" style={{ fontSize: '0.78rem', color: 'var(--amber)', fontWeight: 600, display: 'block', marginBottom: '16px' }}>
                    {policyError}
                  </span>
                )}

                {/* Policy warnings */}
                {selectedPack.policyWarnings && selectedPack.policyWarnings.length > 0 && (
                  <div id="policyWarnings" className="alert alert-warning" style={{ marginBottom: '16px' }}>
                    <span>⚠</span>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '4px' }}>Policy Warnings</strong>
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        {selectedPack.policyWarnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
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
                    </div>
                  </div>
                )}

                <div className="divider" />

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

                  {/* Confidence & reasoning mode badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <span className={`badge ${selectedPack.confidence === 'high' ? 'badge-green' : selectedPack.confidence === 'medium' ? 'badge-amber' : 'badge-red'}`}>
                      confidence: {selectedPack.confidence}
                    </span>
                    <span className="badge badge-muted">
                      {selectedPack.reasoningMode}
                    </span>
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

                <PackHealthScore pack={selectedPack} />
                <DriftAnalysis packId={selectedPack.id} onReportGenerated={() => {}} />
                <GithubIssue pack={selectedPack} onIssueCreated={url => handleUpdatePack({ githubIssueUrl: url })} />
                <VersionHistory key={`${selectedPack.id}-${historyKey}`} packId={selectedPack.id} />
              </div>
            ) : (
              <div className="card no-top-margin" style={{ textAlign: 'center', padding: '60px 24px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.4 }}>📋</div>
                <p className="muted">Select a saved intent pack from the sidebar to view details.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
