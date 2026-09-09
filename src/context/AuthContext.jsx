import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(undefined)

function activeHospitalKey(userId) {
  return `orn_active_hospital_${userId}`
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [memberships, setMemberships] = useState([]) // [{ hospital_id, hospitals: { name } }]
  const [activeHospitalId, setActiveHospitalId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, hospital_id')
      .eq('id', userId)
      .single()

    if (!error) setProfile(data)
    return error ? null : data
  }, [])

  const loadMemberships = useCallback(async (userId, fallbackHospitalId) => {
    if (!userId) {
      setMemberships([])
      setActiveHospitalId(null)
      return
    }

    const { data, error } = await supabase
      .from('user_hospitals')
      .select('hospital_id, hospitals(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      return
    }

    const list = data || []
    setMemberships(list)

    // Decide which hospital is "active" for this browser: prefer
    // whatever was last chosen (localStorage), fall back to the
    // profile's home hospital, then just the first membership.
    let stored = null
    try {
      stored = window.localStorage.getItem(activeHospitalKey(userId))
    } catch {
      // localStorage can be unavailable (private mode, etc.) — ignore.
    }

    const ids = list.map((m) => m.hospital_id)
    let next = null
    if (stored && ids.includes(stored)) {
      next = stored
    } else if (fallbackHospitalId && ids.includes(fallbackHospitalId)) {
      next = fallbackHospitalId
    } else if (ids.length > 0) {
      next = ids[0]
    }

    setActiveHospitalId(next)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      const userId = session?.user?.id
      const loadedProfile = await loadProfile(userId)
      await loadMemberships(userId, loadedProfile?.hospital_id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        const userId = session?.user?.id
        const loadedProfile = await loadProfile(userId)
        await loadMemberships(userId, loadedProfile?.hospital_id)
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [loadProfile, loadMemberships])

  const switchHospital = useCallback(
    (hospitalId) => {
      setActiveHospitalId(hospitalId)
      const userId = session?.user?.id
      if (!userId) return
      try {
        window.localStorage.setItem(activeHospitalKey(userId), hospitalId)
      } catch {
        // ignore — worst case the choice doesn't persist across reloads.
      }
    },
    [session]
  )

  const hospitals = useMemo(
    () =>
      memberships.map((m) => ({ id: m.hospital_id, name: m.hospitals?.name || 'Unknown hospital' })),
    [memberships]
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    // Backwards-compatible alias: every existing page reads `hospitalId`
    // to scope its queries. It now means "the currently active hospital"
    // rather than "the only hospital", but the name stays the same so
    // nothing else has to change.
    hospitalId: activeHospitalId,
    activeHospitalId,
    hospitals,
    switchHospital,
    loading,
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => loadProfile(session?.user?.id),
    refreshMemberships: () => loadMemberships(session?.user?.id, profile?.hospital_id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
