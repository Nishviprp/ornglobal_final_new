import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Supabase reads the recovery token out of the URL and establishes a
    // temporary session automatically (detectSessionInUrl is on by
    // default). We just wait for that session before showing the form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Password updated — you can log in with it now.')
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-slate-500">
            Verifying your reset link… If this doesn't update within a few seconds, the link may
            have expired — request a new one from the login page.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">New password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Confirm password</label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Repeat password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
