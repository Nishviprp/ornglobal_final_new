import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiArrowLeft, FiLogOut } from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import GrowableSelect from '../components/GrowableSelect'

export default function Profile() {
  const { user, profile, hospitals, activeHospitalId, switchHospital, refreshProfile, refreshMemberships } =
    useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [joinHospitalId, setJoinHospitalId] = useState('')
  const [joining, setJoining] = useState(false)
  const [leavingId, setLeavingId] = useState(null)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
    }
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name cannot be empty.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq('id', user.id)
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    await refreshProfile()
    toast.success('Profile updated')
  }

  async function handleJoin() {
    if (!joinHospitalId) {
      toast.error('Pick a hospital to join first.')
      return
    }
    if (hospitals.some((h) => h.id === joinHospitalId)) {
      toast.error('You already belong to that hospital.')
      return
    }

    setJoining(true)
    const { error } = await supabase
      .from('user_hospitals')
      .insert({ user_id: user.id, hospital_id: joinHospitalId })
    setJoining(false)

    if (error) {
      toast.error(error.message)
      return
    }

    await refreshMemberships()
    switchHospital(joinHospitalId)
    setJoinHospitalId('')
    toast.success('Hospital added — switched to it.')
  }

  async function handleLeave(hospitalId) {
    if (hospitals.length <= 1) {
      toast.error("You can't leave your only hospital.")
      return
    }
    if (!window.confirm('Leave this hospital? You will lose access to its cases.')) return

    setLeavingId(hospitalId)
    const { error } = await supabase
      .from('user_hospitals')
      .delete()
      .eq('user_id', user.id)
      .eq('hospital_id', hospitalId)
    setLeavingId(null)

    if (error) {
      toast.error(error.message)
      return
    }

    await refreshMemberships()
    toast.success('Left hospital.')
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <FiArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">Your profile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Update your name below. Email can't be changed here.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Your hospitals</h2>
          <p className="mt-1 text-sm text-slate-500">
            You can belong to more than one hospital and switch between them from the
            dashboard. Cases, surgeons, and lists are kept separate per hospital.
          </p>

          {hospitals.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {hospitals.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {h.name}
                    {h.id === activeHospitalId && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Active
                      </span>
                    )}
                  </span>
                  {h.id !== activeHospitalId && (
                    <button
                      type="button"
                      onClick={() => switchHospital(h.id)}
                      className="whitespace-nowrap text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Switch to this
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={hospitals.length <= 1 || leavingId === h.id}
                    onClick={() => handleLeave(h.id)}
                    title={hospitals.length <= 1 ? "You can't leave your only hospital" : 'Leave'}
                    className="flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                  >
                    <FiLogOut className="h-3.5 w-3.5" /> Leave
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <GrowableSelect
              label="Join or add a hospital"
              table="hospitals"
              scoped={false}
              value={joinHospitalId}
              onChange={setJoinHospitalId}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="mt-2 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining ? 'Joining…' : 'Join hospital'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
