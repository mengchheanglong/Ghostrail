/**
 * parseGitDiff — extract changed file paths from standard git diff text.
 *
 * Supports:
 *   - Modified files        (--- a/path / +++ b/path)
 *   - New files             (--- /dev/null / +++ b/path)
 *   - Deleted files         (--- a/path / +++ /dev/null)
 *   - Renamed files         (rename from <old> / rename to <new>)
 *   - Binary file changes   (Binary files a/path and b/path differ)
 *
 * Returns a sorted, deduplicated array of file paths.
 * Path strings are returned without any `a/` or `b/` prefix.
 *
 * Known limitation: paths that literally contain ` b/` or ` and ` may be
 * mis-parsed in the binary-file pattern. This is uncommon in practice.
 *
 * @param diffText - Raw output from `git diff` or `git diff HEAD~1`.
 * @returns Sorted deduplicated array of changed file paths.
 */
export function parseGitDiff(diffText: string): string[] {
  if (!diffText || !diffText.trim()) return [];

  const paths = new Set<string>();

  for (const rawLine of diffText.split("\n")) {
    // --- a/<path>   (modification source / deleted file)
    // Excludes `--- /dev/null` because that prefix doesn't start with `a/`
    const minusMatch = rawLine.match(/^--- a\/(.+)$/);
    if (minusMatch) {
      const p = minusMatch[1]!.trim();
      if (p) paths.add(p);
    }

    // +++ b/<path>   (modification destination / new file)
    // Excludes `+++ /dev/null` because that prefix doesn't start with `b/`
    const plusMatch = rawLine.match(/^\+\+\+ b\/(.+)$/);
    if (plusMatch) {
      const p = plusMatch[1]!.trim();
      if (p) paths.add(p);
    }

    // rename from <path>
    const renameFromMatch = rawLine.match(/^rename from (.+)$/);
    if (renameFromMatch) {
      const p = renameFromMatch[1]!.trim();
      if (p) paths.add(p);
    }

    // rename to <path>
    const renameToMatch = rawLine.match(/^rename to (.+)$/);
    if (renameToMatch) {
      const p = renameToMatch[1]!.trim();
      if (p) paths.add(p);
    }

    // Binary files a/<path> and b/<path> differ
    const binaryMatch = rawLine.match(/^Binary files a\/(.+) and b\/(.+) differ$/);
    if (binaryMatch) {
      const a = binaryMatch[1]!.trim();
      const b = binaryMatch[2]!.trim();
      if (a) paths.add(a);
      if (b) paths.add(b);
    }
  }

  return [...paths].sort();
}
