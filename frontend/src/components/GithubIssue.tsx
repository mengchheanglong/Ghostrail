import { useState } from 'react';
import { createGithubIssue } from '../api';
import type { IntentPack } from '../types';

export function GithubIssue({
  pack, onIssueCreated,
}: {
  pack: IntentPack;
  onIssueCreated: (url: string) => void;
}) {
  const [owner, setOwner]         = useState('');
  const [repo, setRepo]           = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError]         = useState('');

  const handleCreate = async () => {
    if (!owner.trim() || !repo.trim()) return;
    setIsCreating(true);
    setError('');
    try {
      const result = await createGithubIssue(pack.id, owner.trim(), repo.trim());
      onIssueCreated(result.issueUrl);
    } catch (err: any) {
      setError(err.message || 'Error creating issue');
    } finally {
      setIsCreating(false);
    }
  };

  if (pack.githubIssueUrl) {
    return (
      <div style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        <p className="section-title" style={{ marginBottom: '8px' }}>GitHub Issue</p>
        <a
          href={pack.githubIssueUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <span>🔗</span>
          {pack.githubIssueUrl}
          <span style={{ opacity: 0.6 }}>↗</span>
        </a>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
      <p className="section-title" style={{ marginBottom: '12px' }}>Create GitHub Issue</p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="owner"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          disabled={isCreating}
          style={{ width: '130px', flex: 'none', padding: '7px 10px', fontSize: '0.85rem' }}
        />
        <span style={{ color: 'var(--text-faint)', fontSize: '1.1rem', fontWeight: 300 }}>/</span>
        <input
          type="text"
          placeholder="repository"
          value={repo}
          onChange={e => setRepo(e.target.value)}
          disabled={isCreating}
          style={{ width: '170px', flex: 'none', padding: '7px 10px', fontSize: '0.85rem' }}
        />
        <button
          className="btn btn-success"
          onClick={handleCreate}
          disabled={isCreating || !owner || !repo}
        >
          {isCreating ? '⟳ Creating…' : '↑ Create Issue'}
        </button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
