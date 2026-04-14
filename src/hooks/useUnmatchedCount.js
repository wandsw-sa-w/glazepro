import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useUnmatchedCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    supabase
      .from('unmatched_emails')
      .select('id', { count: 'exact', head: true })
      .neq('assigned', true)
      .then(({ count: c }) => setCount(c || 0))
  }, [])

  return count
}
