import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  async function sendCode(e) {
    if (e?.preventDefault) e.preventDefault()

    if (!email) {
      toast.error('Please enter your email.')
      return
    }

    setSending(true)
    // shouldCreateUser: false — this screen only logs people into an
    // existing account; new accounts are still created on the Signup
    // page.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    setSending(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Code sent — check your email.')
    setStep('code')
  }

  async function handleVerify(e) {
    e.preventDefault()

    if (!code.trim()) {
      toast.error('Enter the code from your email.')
      return
    }

    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    })
    setVerifying(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Welcome back!')
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === 'email'
            ? "We'll email you a one-time login code — no password needed."
            : <>Enter the code we sent to <span className="font-medium text-slate-700">{email}</span>.</>}
        </p>

        {step === 'email' ? (
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="you@hospital.org"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending code…' : 'Send login code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Login code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? 'Verifying…' : 'Verify & log in'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                Use a different email
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={sending}
                className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
              >
                {sending ? 'Resending…' : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
