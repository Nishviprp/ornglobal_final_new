// Mirrors the server-side rules in supabase/schema-phase3.sql
// (public.case_permission_level). The database is the real source of
// truth — RLS enforces this regardless of what the UI does — but
// computing it client-side too lets us show/hide controls without an
// extra round trip.

const RANK = { view: 0, download: 1, edit: 2, approve: 3 }

export function computeCaseLevel({ caseRow, shares, userId }) {
  if (!caseRow || !userId) return 'view'
  if (caseRow.created_by === userId) return 'approve'
  const grant = shares?.find((s) => s.user_id === userId)
  return grant?.permission || 'view'
}

export function atLeast(level, min) {
  return (RANK[level] ?? 0) >= (RANK[min] ?? 0)
}

export function isLocked(caseRow, level) {
  return caseRow?.status === 'approved' && level !== 'approve'
}
