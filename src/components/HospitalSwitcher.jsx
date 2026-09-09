import { FiRepeat } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Lets someone who belongs to more than one hospital switch which one
 * they're currently working in. Everything scoped by hospital (cases,
 * surgeons, specialties, etc.) reads `hospitalId` off AuthContext, so
 * switching here immediately changes what the rest of the app shows.
 *
 * Renders nothing for an account that only belongs to one hospital —
 * there's nothing to switch between.
 */
export default function HospitalSwitcher() {
  const { hospitals, activeHospitalId, switchHospital } = useAuth()

  if (hospitals.length <= 1) return null

  return (
    <div className="flex items-center gap-1.5">
      <FiRepeat className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        value={activeHospitalId || ''}
        onChange={(e) => switchHospital(e.target.value)}
        title="Switch hospital"
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {hospitals.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </div>
  )
}
