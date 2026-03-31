import { useState } from 'react';
import { analyzeDrift } from '../api';

export function DriftAnalysis({
  packId, onReportGenerated,
}: {
  packId: string;
  onReportGenerated: (report: any) => void;
}) {
  const [diffText, setDiffText]     = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport]         = useState<any | null>(null);
  const [error, setError]           = useState('');
  const [emptyPrompt, setEmptyPrompt] = useState(false);

  const handleAnalyze = async () => {
    if (!diffText.trim()) {
      setEmptyPrompt(true);
      return;
    }
    setEmptyPrompt(false);
    setIsAnalyzing(true);
    setError('');
    setReport(null);
    try {
      const result = await analyzeDrift(packId, diffText);
      setReport(result);
      onReportGenerated(result);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const statusColor =
    report?.report?.status === 'clean'          ? 'var(--green)' :
    report?.report?.status === 'warning'        ? 'var(--amber)' :
    report?.report?.status === 'drift-detected' ? 'var(--red)'   : 'var(--text-muted)';

  return (
    <div id="driftSection" style={{ marginTop: '16px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
      <p className="section-title" style={{ marginBottom: '12px' }}>Drift Analysis</p>

      {report ? (
        <div id="driftResult">
          <div style={{ marginBottom: '14px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <div className="drift-status-badge" style={{ fontWeight: 700, color: statusColor, marginBottom: '6px', textTransform: 'capitalize' }}>
              {report.report?.status?.replace('-', ' ') ?? 'Unknown'}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {report.changedFiles?.length ?? 0} file(s) extracted from diff
            </p>
            {report.report?.summary && (
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{report.report.summary}</p>
            )}
          </div>

          {/* Matched files */}
          {report.report?.matchedFiles?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--green)', margin: '0 0 4px' }}>✓ Matched</p>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {report.report.matchedFiles.map((f: string) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Scope creep */}
          {report.report?.scopeCreep?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--red)', margin: '0 0 4px' }}>⚠ Unexpected (possible scope creep)</p>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {report.report.scopeCreep.map((f: string) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Intent gap */}
          {report.report?.intentGap?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--amber)', margin: '0 0 4px' }}>? Missing (intent gap)</p>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {report.report.intentGap.map((a: string) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}

          <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px', marginTop: '6px' }} onClick={() => { setReport(null); setDiffText(''); }}>
            ↩ Analyze another diff
          </button>
        </div>
      ) : (
        <>
          <textarea
            id="driftInput"
            value={diffText}
            onChange={e => { setDiffText(e.target.value); setEmptyPrompt(false); }}
            placeholder="Paste `git diff main...HEAD` output here…"
            disabled={isAnalyzing}
            style={{ minHeight: '80px', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '10px' }}
          />
          {error && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{error}</div>}
          {emptyPrompt && (
            <div id="driftResult" style={{ marginBottom: '10px', fontSize: '0.82rem', color: 'var(--text-faint)', fontStyle: 'italic' }}>
              Paste a git diff above and click Analyze Drift.
            </div>
          )}
          <button
            id="analyzeDriftBtn"
            className="btn btn-accent-ghost"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '⟳ Analyzing…' : '⚡ Analyze Drift'}
          </button>
        </>
      )}
    </div>
  );
}
