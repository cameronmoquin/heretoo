/**
 * Pure logic for the Subjects "new activity" badge — kept free of React
 * and react-native imports so it can be unit-tested directly and reused
 * by both the seen-store and the data hook.
 */

/** A subject is "new" when its latest activity was added by someone
 *  other than the viewer, and is more recent than the last time the
 *  viewer marked it seen. */
export function subjectHasNewActivity(
  latest: { latestAt: string; byMe: boolean } | undefined,
  seenIso: string | undefined,
): boolean {
  if (!latest || latest.byMe) return false;
  if (!seenIso) return true;
  return new Date(latest.latestAt).getTime() > new Date(seenIso).getTime();
}

/** Advance the seen-map for a subject. Returns a new map if the time
 *  moved forward, or null if `atIso` is missing or not newer (so the
 *  caller can skip a no-op state update). Never rewinds. */
export function advanceSeen(
  seen: Record<string, string>,
  subjectId: string,
  atIso: string,
): Record<string, string> | null {
  if (!subjectId || !atIso) return null;
  const prev = seen[subjectId];
  if (prev && new Date(prev).getTime() >= new Date(atIso).getTime()) return null;
  return { ...seen, [subjectId]: atIso };
}
