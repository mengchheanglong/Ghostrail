import { useState, useRef, useEffect } from 'react';
import { deletePack, updatePack, exportIssueMarkdown, duplicatePack, fetchTaskPacket, fetchPrDescription } from '../api';
import type { IntentPack } from '../types';

export function ActionButtons({
  pack, onUpdate, onDelete, onRerun, onDuplicate,
}: {
  pack: IntentPack;
  onUpdate: (updated: IntentPack) => void;
  onDelete: () => void;
  onRerun?: () => void;
  onDuplicate?: (newPack: IntentPack) => void;
}) {
  const [exportStatus, setExportStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!exportOpen && !moreOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen, moreOpen]);

  const handleExport = async () => {
    setExportOpen(false);
    setExportStatus('');
    try {
      const md = await exportIssueMarkdown(pack.id);
      await navigator.clipboard.writeText(md);
      setExportStatus('Copied as GitHub Issue!');
      setTimeout(() => setExportStatus(''), 2500);
    } catch {
      setExportStatus('Failed to copy');
    }
  };

  const handleTaskPacket = async () => {
    setExportOpen(false);
    setExportStatus('');
    try {
      const data = await fetchTaskPacket(pack.id);
      await navigator.clipboard.writeText(data.prompt);
      setExportStatus('Task packet copied!');
      setTimeout(() => setExportStatus(''), 2500);
    } catch {
      setExportStatus('Failed to copy');
    }
  };

  const handlePrDesc = async () => {
    setExportOpen(false);
    setExportStatus('');
    try {
      const data = await fetchPrDescription(pack.id);
      await navigator.clipboard.writeText(data.markdown);
      setExportStatus('PR description copied!');
      setTimeout(() => setExportStatus(''), 2500);
    } catch {
      setExportStatus('Failed to copy');
    }
  };

  const toggleStar    = async () => { setMoreOpen(false); onUpdate(await updatePack(pack.id, { starred: !pack.starred })); };
  const toggleArchive = async () => { setMoreOpen(false); onUpdate(await updatePack(pack.id, { archived: !pack.archived })); };

  const handleDelete = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    await deletePack(pack.id);
    setDeleteConfirm(false);
    setMoreOpen(false);
    onDelete();
  };

  const handleDuplicate = async () => {
    setMoreOpen(false);
    const dup = await duplicatePack(pack.id);
    if (onDuplicate) onDuplicate(dup);
  };

  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>

        {/* ── Tier 1: Export dropdown ── */}
        <div ref={exportRef} style={{ position: 'relative', zIndex: 10 }}>
          <button
            id="exportDropdownBtn"
            className="btn btn-ghost"
            onClick={() => { setExportOpen(o => !o); setMoreOpen(false); }}
            title="Export this pack as a GitHub issue, task packet, or PR description"
          >
            📤 Export {exportOpen ? '▲' : '▾'}
          </button>

          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 200,
            background: 'var(--bg-card)',
            border: `1px solid ${exportOpen ? 'var(--border-hover)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            maxHeight: exportOpen ? '200px' : '0',
            opacity: exportOpen ? 1 : 0,
            pointerEvents: exportOpen ? 'auto' : 'none',
            transition: 'max-height 0.18s var(--ease-out), opacity 0.18s var(--ease-out)',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: exportOpen ? '4px' : '0',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <button id="exportBtn" className="btn btn-ghost" onClick={handleExport} style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }} tabIndex={exportOpen ? 0 : -1}>
              📋 Copy as GitHub Issue
            </button>
            <button id="taskPacketBtn" className="btn btn-ghost" onClick={handleTaskPacket} style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }} tabIndex={exportOpen ? 0 : -1}>
              📦 Copy as Task Packet
            </button>
            <button id="prDescBtn" className="btn btn-ghost" onClick={handlePrDesc} style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }} tabIndex={exportOpen ? 0 : -1}>
              📝 Copy as PR Description
            </button>
          </div>
        </div>

        {/* ── Tier 1: Re-run (hidden on mobile via CSS) ── */}
        <button
          id="rerunBtn"
          className="btn btn-ghost action-rerun-desktop"
          onClick={() => onRerun?.()}
          title="Pre-fill the generator form with this pack's goal and context"
        >
          ↻ Re-run
        </button>

        {/* ── Tier 2: More actions overflow menu ── */}
        <div ref={moreRef} style={{ position: 'relative', zIndex: 10 }}>
          <button
            id="moreActionsBtn"
            className="btn btn-ghost"
            onClick={() => { setMoreOpen(o => !o); setExportOpen(false); }}
            title="More actions"
          >
            More {moreOpen ? '▲' : '▾'}
          </button>

          {moreOpen && (
            <div className="action-overflow-menu" style={{ zIndex: 200 }}>
              {/* Re-run inside overflow on mobile */}
              <button
                id="rerunBtnMobile"
                className="btn btn-ghost action-rerun-mobile"
                onClick={() => { setMoreOpen(false); onRerun?.(); }}
                style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              >
                ↻ Re-run
              </button>
              <button
                id="duplicateBtn"
                className="btn btn-ghost"
                onClick={handleDuplicate}
                style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              >
                ⧉ Duplicate
              </button>
              <button
                id="starBtn"
                className="btn btn-warning"
                onClick={toggleStar}
                style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              >
                {pack.starred ? '★ Unstar' : '☆ Star'}
              </button>
              <button
                id="archiveBtn"
                className="btn btn-ghost"
                onClick={toggleArchive}
                style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              >
                {pack.archived ? '↩ Unarchive' : '⊙ Archive'}
              </button>

              <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />

              {/* Delete with two-step confirmation */}
              <button
                id="deleteBtn"
                className="btn btn-danger"
                onClick={handleDelete}
                style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              >
                {deleteConfirm ? '⚠ Confirm delete?' : '🗑 Delete'}
              </button>
              {deleteConfirm && (
                <button
                  id="cancelDeleteBtn"
                  className="btn btn-ghost"
                  onClick={() => setDeleteConfirm(false)}
                  style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {exportStatus && (
        <span id="exportStatus" style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 600, marginLeft: '4px', display: 'block', marginTop: '6px' }}>
          ✓ {exportStatus}
        </span>
      )}
    </div>
  );
}
