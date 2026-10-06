// drawingHistory.js — Insert and load drawing history entries.

import { supabase } from '../supabase.js'

/**
 * Insert a history row. Returns the inserted row or null on error.
 * Never throws — the caller is responsible for warning on failure.
 */
export async function insertDrawingHistory({ drawingId, userId, event, changes = [], note = null }) {
  const { data, error } = await supabase
    .from('drawing_history')
    .insert({
      drawing_id: drawingId,
      user_id: userId ?? null,
      event,
      changes,
      note,
    })
    .select()
    .single()
  if (error) return { data: null, error }
  return { data, error: null }
}

/**
 * Load history entries for a drawing, newest first.
 * Joins to auth.users via user_id to get the user's email.
 */
export async function loadDrawingHistory(drawingId) {
  // Join to users for the name/email. The users table may be RLS-protected,
  // so the join columns can come back null — handle gracefully.
  const { data, error } = await supabase
    .from('drawing_history')
    .select('*, users:user_id(full_name, email)')
    .eq('drawing_id', drawingId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('loadDrawingHistory error:', error.message)
    return []
  }
  // Flatten the join: attach user_name and user_email to each row
  return (data ?? []).map(row => ({
    ...row,
    user_name: row.users?.full_name || null,
    user_email: row.users?.email || null,
  }))
}
