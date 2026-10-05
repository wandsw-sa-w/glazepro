/**
 * VersionContext — checks /version.json on navigation and every 3 minutes.
 * When the deployed version differs from the baked-in build version, sets
 * isStale=true and renders a bar prompting the user to reload.
 *
 * Components that must block on stale (e.g. Publish) read isStale from
 * useVersion().
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

/* global __APP_VERSION__ */
const BUILD_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null

const POLL_MS = 3 * 60 * 1000 // 3 minutes

const Ctx = createContext({ isStale: false })

export function useVersion() {
  return useContext(Ctx)
}

export function VersionProvider({ children }) {
  const [isStale, setIsStale] = useState(false)
  const location = useLocation()
  const timerRef = useRef(null)

  const check = useCallback(async () => {
    if (!BUILD_VERSION) return // dev mode — no version baked in
    try {
      const res = await fetch('/version.json', { cache: 'no-store' })
      if (!res.ok) return
      const { v } = await res.json()
      if (v && v !== BUILD_VERSION) setIsStale(true)
    } catch { /* network error — ignore */ }
  }, [])

  // Check on every navigation
  useEffect(() => { check() }, [location.pathname, check])

  // Poll every POLL_MS
  useEffect(() => {
    timerRef.current = setInterval(check, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [check])

  return (
    <Ctx.Provider value={{ isStale }}>
      {isStale && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#1a5fa8', color: '#fff', padding: '8px 16px',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
          fontSize: 13, fontWeight: 500,
        }}>
          A new version of GlazePro is available
          <button
            onClick={() => window.location.reload()}
            style={{
              border: '1px solid rgba(255,255,255,0.5)', borderRadius: 6,
              background: 'transparent', color: '#fff', padding: '4px 14px',
              cursor: 'pointer', fontWeight: 600, fontSize: 12,
            }}
          >
            Reload
          </button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  )
}
