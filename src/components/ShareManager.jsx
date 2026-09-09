import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FiUserPlus, FiX } from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'

const LEVELS = [
  { value: 'download', label: 'Download' },
  { value: 'edit', label: 'Edit' },
  { value: 'approve', label: 'Approve' },
]

function nameFor(profile) {
  if (!profile) return 'Unknown user'
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return name || profile.email
}

export default function ShareManager({ caseId, hospitalId, currentUserId }) {
  const [shares, setShares] = useState([])
  const [colleagues, setColleagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('view')

  useEffect(() => {
    async function load() {
      const [sharesRes, colleaguesRes] = await Promise.all([
        supabase
          .from('case_shares')
          .select('id, user_id, permission, profiles(first_name, last_name, email)')
          .eq('case_id', caseId),
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('hospital_id', hospitalId)
          .neq('id', currentUserId)
          .order('first_name', { ascending: true }),
      ])

      if (sharesRes.error) toast.error('Could not load current access list.')
      else setShares(sharesRes.data)

      if (colleaguesRes.error) toast.error('Could not load hospital colleagues.')
      else setColleagues(colleaguesRes.data)

      setLoading(false)
    }
    load()
  }, [caseId, hospitalId, currentUserId])

  const availableColleagues = useMemo(
    () => colleagues.filter((c) => !shares.some((s) => s.user_id === c.id)),
    [colleagues, shares]
  )

  async function handleAddShare() {
    if (!selectedUser) {
      toast.error('Pick someone to share with.')
      return
    }

    const { data, error } = await supabase
      .from('case_shares')
      .insert({
        case_id: caseId,
        hospital_id: hospitalId,
        user_id: selectedUser,
        permission: selectedLevel,
      })
      .select('id, user_id, permission, profiles(first_name, last_name, email)')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }

    setShares((prev) => [...prev, data])
    setSelectedUser('')
    toast.success('Access granted')
  }

  async function handleChangeLevel(shareId, permission) {
    const { error } = await supabase
      .from('case_shares')
      .update({ permission })
      .eq('id', shareId)

    if (error) {
      toast.error(error.message)
      return
    }
    setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, permission } : s)))
  }

  async function handleRemove(shareId) {
    const { error } = await supabase.from('case_shares').delete().eq('id', shareId)
    if (error) {
      toast.error(error.message)
      return
    }
    setShares((prev) => prev.filter((s) => s.id !== shareId))
    toast.success('Access removed')
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading access list…</p>
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700">Share this case</h3>
      <p className="mt-1 text-xs text-slate-400">
        Everyone at your hospital can already view this case. Grant download,
        edit, or approve rights to specific colleagues below.
      </p>

      {shares.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {nameFor(s.profiles)}
              </span>
              <select
                value={s.permission}
                onChange={(e) => handleChangeLevel(s.id, e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Remove access"
                onClick={() => handleRemove(s.id)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <FiX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:flex-1"
        >
          <option value="">Select a colleague…</option>
          {availableColleagues.map((c) => (
            <option key={c.id} value={c.id}>
              {nameFor(c)}
            </option>
          ))}
        </select>
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAddShare}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <FiUserPlus className="h-4 w-4" /> Grant
        </button>
      </div>
    </div>
  )
}
