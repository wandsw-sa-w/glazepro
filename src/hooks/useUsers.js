import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('active', true)
      .order('full_name')
      .then(({ data }) => {
        setUsers(data || [])
        setUsersLoading(false)
      })
  }, [])

  return { users, usersLoading }
}
