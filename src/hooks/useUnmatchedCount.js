import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useUnmatchedCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    function fetch() {
      supabase
        .from('unmatched_emails')
        .select('id', { count: 'exact', head: true })
        .neq('assigned', true)
        .then(({ count: c }) => setCount(c || 0))
    }

    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  return count
}
