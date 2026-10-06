// drawingHistory.js — Insert and load drawing history entries.

import { supabase } from '../supabase.js'

/**
 * Insert a history row. Returns the inserted row or null on error.
 * Never throws — the caller is responsible for warning on failure.
 *
 * @param {{ drawingId: number, userId?: string, userName?: string, event: string, changes?: Array, note?: string }} opts
 */
export async function insertDrawingHistory({ drawingId, userId, userName, event, changes = [], note = null }) {
  const { data, error } = await supabase
    .from('drawing_history')
    .insert({
      drawing_id: drawingId,
      user_id: userId ?? null,
      user_name: userName ?? null,
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
 * Returns { data: Array, error: string|null }.
 * On error, data is null (not []) so callers can distinguish load
 * failure from an empty history.
 */
export async function loadDrawingHistory(drawingId) {
  const { data, error } = await supabase
    .from('drawing_history')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('created_at', { ascending: false })
  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data ?? [], error: null }
}
