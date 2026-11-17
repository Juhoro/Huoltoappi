import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearLocalData } from '../lib/offline'
import { supabase, type Tables } from '../lib/supabase'

type Role = 'admin' | 'installer'

type AuthState = {
  loading: boolean
  session: Session | null
  userId: string | null
  profile: Tables<'profiles'> | null
  org: Tables<'organizations'> | null
  role: Role | null
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [org, setOrg] = useState<Tables<'organizations'> | null>(null)
  const [role, setRole] = useState<Role | null>(null)

  async function loadMembership(userId: string) {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('organization_members')
        .select('role, organizations(*)')
        .eq('user_id', userId)
        .eq('active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle(),
    ])
    setProfile(p ?? null)
    setOrg((m?.organizations as Tables<'organizations'> | null) ?? null)
    setRole((m?.role as Role | undefined) ?? null)
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) await loadMembership(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' && s) {
        setLoading(true)
        // Ei awaitia callbackissa (supabase-js:n lukitus); ladataan seuraavalla tikillä.
        setTimeout(() => void loadMembership(s.user.id).finally(() => setLoading(false)), 0)
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setOrg(null)
        setRole(null)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthState = {
    loading,
    session,
    userId: session?.user.id ?? null,
    profile,
    org,
    role,
    signOut: async () => {
      await supabase.rpc('end_shift').then(
        () => undefined,
        () => undefined,
      )
      await clearLocalData()
      await supabase.auth.signOut()
    },
    reload: async () => {
      if (session) await loadMembership(session.user.id)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth AuthProviderin ulkopuolella')
  return v
}

/** Kirjautuneen käyttäjän organisaatio (sivuilla, jotka vaativat sen). */
export function useOrg() {
  const { org, userId, role, profile } = useAuth()
  if (!org || !userId || !role) throw new Error('Organisaatio puuttuu')
  return { org, orgId: org.id, userId, role, profile }
}
