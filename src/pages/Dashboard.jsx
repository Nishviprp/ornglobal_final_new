import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiPlus, FiFileText, FiSearch, FiUser } from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import HospitalSwitcher from '../components/HospitalSwitcher'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'approved', label: 'Approved' },
]

export default function Dashboard() {
  const { user, hospitalId, signOut } = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase()
    return cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!query) return true
      const haystack = [c.specialties?.name, c.procedures?.name, c.surgeons?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [cases, search, statusFilter])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user?.email}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HospitalSwitcher />
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FiUser className="h-4 w-4" /> Profile
            </Link>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-medium text-slate-900">Surgical cases</h2>
            <Link
              to="/cases/new"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <FiPlus className="h-4 w-4" /> New case
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by specialty, procedure, or surgeon…"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          ) : cases.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No cases yet — create your first one to get started.
            </p>
          ) : filteredCases.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No cases match your search.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {filteredCases.map((c) => (
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
