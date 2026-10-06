import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

type Staff = Tables<'tpi_staff'>

type AuthState = {
  loading: boolean
  session: Session | null
  mfaRequired: boolean
  staff: Staff | null
  notOnTeam: boolean
  refreshMfaStatus: () => Promise<void>
  refreshStaff: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [notOnTeam, setNotOnTeam] = useState(false)

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

  async function loadStaff() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      setStaff(null)
      setNotOnTeam(true)
      return
    }
    const { data: row } = await supabase
      .from('tpi_staff')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (!row || !row.active) {
      setStaff(null)
      setNotOnTeam(true)
      await supabase.auth.signOut()
      return
    }
    setStaff(row)
    setNotOnTeam(false)
  }

  // Runs the full membership + MFA check. Called exactly once per session:
  // on initial load (whatever session already exists, resumed or none) and
  // right after a fresh sign-in. Never again after that for the rest of the
  // session — see the onAuthStateChange handler below for why.
  async function bootstrap(nextSession: Session | null) {
    setSession(nextSession)
    setStaff(null)
    setNotOnTeam(false)
    if (!nextSession) {
      setMfaRequired(false)
      setLoading(false)
      return
    }
    const needsMfa = await checkMfa()
    if (!needsMfa) {
      await loadStaff()
    }
    setLoading(false)
  }

  useEffect(() => {
    // onAuthStateChange fires for every auth event, not just a fresh login —
    // including TOKEN_REFRESHED, which Supabase's own SDK triggers on its
    // internal tab-visibility handling (switching tabs/apps and back). This
    // used to call bootstrap() for every event, which re-queried tpi_staff
    // and could sign the user out mid-session from a transient/racy read.
    // Membership is now only ever (re)checked on INITIAL_SESSION (page load)
    // and SIGNED_IN (a fresh login) — every other event just keeps the
    // session object (and its access token) current.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        bootstrap(nextSession)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setStaff(null)
        setNotOnTeam(false)
        setMfaRequired(false)
        setLoading(false)
        return
      }
      // TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED, etc: keep the
      // session (and its token) current, but never re-check membership or
      // sign out as a side effect of one of these.
      setSession(nextSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshMfaStatus() {
    const needsMfa = await checkMfa()
    if (!needsMfa) await loadStaff()
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ loading, session, mfaRequired, staff, notOnTeam, refreshMfaStatus, refreshStaff: loadStaff, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
