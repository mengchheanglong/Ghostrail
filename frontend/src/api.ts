import type { IntentPack } from './types';

export async function fetchPacks(): Promise<IntentPack[]> {
  const res = await fetch('/api/intent-packs');
  if (!res.ok) throw new Error('Failed to fetch packs');
  return res.json();
}

export async function generatePack(goal: string, context?: string): Promise<IntentPack> {
  const res = await fetch('/api/intent-pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, repositoryContext: context || undefined }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Server error');
  }
  return res.json();
}

export async function updatePack(id: string, updates: Partial<IntentPack>): Promise<IntentPack> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update pack');
  return res.json();
}

export async function deletePack(id: string): Promise<void> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete pack');
}

export async function duplicatePack(id: string): Promise<IntentPack> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate pack');
  return res.json();
}

export async function fetchHistory(id: string): Promise<any[]> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/history`);
  if (!res.ok) return [];
  return res.json();
}

export async function analyzeDrift(id: string, diffText: string): Promise<any> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/analyze-diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diffText }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Drift analysis failed');
  }
  return res.json();
}

export async function createGithubIssue(id: string, owner: string, repo: string): Promise<any> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/create-github-issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Issue creation failed');
  }
  return res.json();
}

export async function exportIssueMarkdown(id: string): Promise<string> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/export-issue`);
  if (!res.ok) throw new Error('Export failed');
  const data = await res.json();
  return data.markdown;
}

export async function fetchTaskPacket(id: string): Promise<{ packet: any; prompt: string }> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/task-packet`);
  if (!res.ok) throw new Error('Failed to fetch task packet');
  return res.json();
}

export async function fetchPrDescription(id: string): Promise<{ markdown: string }> {
  const res = await fetch(`/api/intent-packs/${encodeURIComponent(id)}/pr-description`);
  if (!res.ok) throw new Error('Failed to fetch PR description');
  return res.json();
}
