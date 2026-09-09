import { useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

/**
 * A password <input> with a show/hide eye-icon toggle. Drop-in
 * replacement for <input type="password">; forwards every other prop
 * (value, onChange, placeholder, autoFocus, etc.) straight through.
 */
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {visible ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
      </button>
    </div>
  )
}
