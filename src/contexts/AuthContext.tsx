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
  staffCheckError: string | null
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
  const [staffCheckError, setStaffCheckError] = useState<string | null>(null)

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

  // A FAILED check (thrown exception, network error, Supabase error) must
  // never be treated the same as a check that completed and genuinely found
  // no membership. Only the latter signs the person out. The former leaves
  // their session alone and surfaces staffCheckError instead, so a transient
  // outage (e.g. a Supabase API gateway incident) can't look like a real
  // access revocation.
  async function loadStaff() {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        setStaffCheckError(userError.message)
        return
      }
      if (!userData.user) {
        // No error, but genuinely no user on a session that exists: treat
        // as a confirmed empty result, not a failure.
        setStaff(null)
        setNotOnTeam(true)
        setStaffCheckError(null)
        return
      }
      const { data: row, error: staffError } = await supabase
        .from('tpi_staff')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      if (staffError) {
        setStaffCheckError(staffError.message)
        return
      }
      setStaffCheckError(null)
      if (!row || !row.active) {
        // Confirmed no membership. This never signs the person out on its
        // own — only a click on an actual Sign out button ends a session.
        // NotOnTeamPage shows that button instead.
        setStaff(null)
        setNotOnTeam(true)
        return
      }
      setStaff(row)
      setNotOnTeam(false)
    } catch (e) {
      setStaffCheckError(e instanceof Error ? e.message : String(e))
    }
  }

  // Runs the full membership + MFA check. Called exactly once per session:
  // on initial load (whatever session already exists, resumed or none) and
  // right after a fresh sign-in. Never again after that for the rest of the
  // session — see the onAuthStateChange handler below for why.
  async function bootstrap(nextSession: Session | null) {
    setSession(nextSession)
    setStaff(null)
    setNotOnTeam(false)
    setStaffCheckError(null)
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
        setStaffCheckError(null)
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
      value={{
        loading,
        session,
        mfaRequired,
        staff,
        notOnTeam,
        staffCheckError,
        refreshMfaStatus,
        refreshStaff: loadStaff,
        signOut,
      }}
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
