import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import GrowableSelect from '../components/GrowableSelect'
import PasswordInput from '../components/PasswordInput'

export default function Signup() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    hospitalId: '',
  })

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.hospitalId) {
      toast.error('Please fill in every field.')
      return
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          hospital_id: form.hospitalId,
        },
      },
    })

    setSubmitting(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Account created! You can now log in.')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register to start documenting surgical procedures.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">First name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={updateField('firstName')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Last name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={updateField('lastName')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={updateField('email')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@hospital.org"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <PasswordInput
              value={form.password}
              onChange={updateField('password')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="At least 6 characters"
            />
          </div>

          <GrowableSelect
            label="Hospital"
            table="hospitals"
            scoped={false}
            value={form.hospitalId}
            onChange={(id) => setForm((prev) => ({ ...prev, hospitalId: id }))}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
