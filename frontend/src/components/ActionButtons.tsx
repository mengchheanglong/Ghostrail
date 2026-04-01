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
  const exportRef = useRef<HTMLDivElement>(null);

  // Close the export dropdown when clicking outside of it
  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  const handleExport = async () => {
    setExportOpen(false);
    setExportStatus('');
    try {
      const md = await exportIssueMarkdown(pack.id);
      await navigator.clipboard.writeText(md);
      setExportStatus('Copied!');
      setTimeout(() => setExportStatus(''), 2500);
    } catch {
      setExportStatus('Failed');
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
      setExportStatus('Failed');
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
      setExportStatus('Failed');
    }
  };

  const toggleStar    = async () => onUpdate(await updatePack(pack.id, { starred: !pack.starred }));
  const toggleArchive = async () => onUpdate(await updatePack(pack.id, { archived: !pack.archived }));

  const handleDelete = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    await deletePack(pack.id);
    setDeleteConfirm(false);
    onDelete();
  };

  const handleDuplicate = async () => {
    const dup = await duplicatePack(pack.id);
    if (onDuplicate) onDuplicate(dup);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>

        {/* ── Export dropdown ─────────────────────────────────── */}
        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            id="exportDropdownBtn"
            className="btn btn-ghost"
            onClick={() => setExportOpen(o => !o)}
          >
            📤 Export {exportOpen ? '▲' : '▾'}
          </button>

          {/* Panel is always in the DOM so IDs remain reachable for tests.
              Visibility is controlled purely via CSS properties. */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 20,
            background: 'var(--bg-card)',
            border: `1px solid ${exportOpen ? 'var(--border-hover)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
            maxHeight: exportOpen ? '200px' : '0',
            opacity: exportOpen ? 1 : 0,
            pointerEvents: exportOpen ? 'auto' : 'none',
            transition: 'max-height 0.18s var(--ease-out), opacity 0.18s var(--ease-out)',
            minWidth: '190px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: exportOpen ? '4px' : '0',
            backdropFilter: 'blur(8px)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <button
              id="exportBtn"
              className="btn btn-ghost"
              onClick={handleExport}
              style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              tabIndex={exportOpen ? 0 : -1}
            >
              📋 Copy as Issue
            </button>
            <button
              id="taskPacketBtn"
              className="btn btn-ghost"
              onClick={handleTaskPacket}
              style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              tabIndex={exportOpen ? 0 : -1}
            >
              📦 Task Packet
            </button>
            <button
              id="prDescBtn"
              className="btn btn-ghost"
              onClick={handlePrDesc}
              style={{ justifyContent: 'flex-start', fontSize: '0.8rem' }}
              tabIndex={exportOpen ? 0 : -1}
            >
              📝 PR Description
            </button>
          </div>
        </div>

        <button id="rerunBtn" className="btn btn-ghost" onClick={() => onRerun?.()}>
          ↻ Re-run
        </button>
        <button id="duplicateBtn" className="btn btn-ghost" onClick={handleDuplicate}>
          ⧉ Duplicate
        </button>
        <button id="starBtn" className="btn btn-warning" onClick={toggleStar}>
          {pack.starred ? '★ Unstar' : '☆ Star'}
        </button>
        <button id="archiveBtn" className="btn btn-ghost" onClick={toggleArchive}>
          {pack.archived ? '↩ Unarchive' : '⊙ Archive'}
        </button>

        {/* Delete with inline confirmation */}
        <button id="deleteBtn" className="btn btn-danger" onClick={handleDelete}>
          {deleteConfirm ? '⚠ Confirm delete?' : 'Delete'}
        </button>
        {deleteConfirm && (
          <button id="cancelDeleteBtn" className="btn btn-ghost" onClick={() => setDeleteConfirm(false)} style={{ fontSize: '0.78rem' }}>
            Cancel
          </button>
        )}
      </div>

      {exportStatus && (
        <span id="exportStatus" style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 600, marginLeft: '4px', display: 'block', marginTop: '6px' }}>
          ✓ {exportStatus}
        </span>
      )}
    </div>
  );
}
