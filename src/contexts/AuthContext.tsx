import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type AuthState = {
  loading: boolean
  session: Session | null
  mfaRequired: boolean
  refreshMfaStatus: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)

  async function checkMfa() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) {
      setMfaRequired(false)
      return false
    }
    const required = data.currentLevel !== data.nextLevel && data.nextLevel === 'aal2'
    setMfaRequired(required)
    return required
  }

  // Session + MFA only. There is no team-membership check here: every
  // sensitive action is enforced server side (has_tpi_role, checked inside
  // the function itself), so the frontend doesn't need to gate on it too.
  async function bootstrap(nextSession: Session | null) {
    setSession(nextSession)
    if (!nextSession) {
      setMfaRequired(false)
      setLoading(false)
      return
    }
    await checkMfa()
    setLoading(false)
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        bootstrap(nextSession)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setMfaRequired(false)
        setLoading(false)
        return
      }
      // TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED, etc: keep the
      // session (and its token) current, nothing else.
      setSession(nextSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshMfaStatus() {
    await checkMfa()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ loading, session, mfaRequired, refreshMfaStatus, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
