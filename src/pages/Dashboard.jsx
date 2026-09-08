import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiPlus, FiFileText } from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, hospitalId, signOut } = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hospitalId) return

    async function loadCases() {
      const { data, error } = await supabase
        .from('surgical_cases')
        .select(
          'id, created_at, status, specialties(name), procedures(name), surgeons(name)'
        )
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Could not load cases.')
      } else {
        setCases(data)
      }
      setLoading(false)
    }

    loadCases()
  }, [hospitalId])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Log out
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-slate-900">Surgical cases</h2>
            <Link
              to="/cases/new"
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <FiPlus className="h-4 w-4" /> New case
            </Link>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No cases yet — create your first one to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/cases/${c.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-slate-50"
                  >
                    <FiFileText className="h-5 w-5 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {c.procedures?.name || 'Untitled procedure'}
                        {c.surgeons?.name ? ` — ${c.surgeons.name}` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {c.specialties?.name || 'No specialty'} ·{' '}
                        {new Date(c.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        c.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.status === 'approved' ? 'Approved' : 'Draft'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
