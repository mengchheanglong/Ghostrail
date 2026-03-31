import { useState } from 'react';
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

  const handleExport = async () => {
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
        <button id="exportBtn" className="btn btn-ghost" onClick={handleExport}>
          📋 Copy as Issue
        </button>
        <button id="taskPacketBtn" className="btn btn-ghost" onClick={handleTaskPacket}>
          📦 Task Packet
        </button>
        <button id="prDescBtn" className="btn btn-ghost" onClick={handlePrDesc}>
          📝 PR Description
        </button>
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
