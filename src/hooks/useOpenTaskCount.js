import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCurrentUser } from './useCurrentUser'

export function useOpenTaskCount() {
  const currentUser = useCurrentUser()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!currentUser?.full_name) return
    supabase
      .from('lead_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', currentUser.full_name)
      .eq('completed', false)
      .then(({ count: c }) => setCount(c || 0))
  }, [currentUser?.full_name])

  return count
}
