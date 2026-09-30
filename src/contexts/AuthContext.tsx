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
    supabase.auth.getSession().then(({ data }) => bootstrap(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      bootstrap(nextSession)
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
