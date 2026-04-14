import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

export function useCurrentUser() {
  const { user } = useAuth()
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    if (!user?.email) return
    supabase
      .from('users')
      .select('id, full_name, email, role, phone')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data }) => setCurrentUser(data))
  }, [user?.email])

  return currentUser
}
