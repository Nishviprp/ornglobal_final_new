import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'

/**
 * A dropdown backed by a Supabase table. Anyone can pick an existing
 * option or type a new one — new options are inserted immediately and
 * become available to everyone else.
 *
 * Two modes:
 *  - scoped (default, used for specialties/procedures/surgeons): options
 *    are filtered to `hospitalId` and new rows are tagged with it.
 *  - unscoped (`scoped={false}`, used for the global `hospitals` table):
 *    no hospital_id column at all — every option is visible to everyone,
 *    including signed-out visitors on the Signup page.
 *
 * Pass `filterColumn` + `filterValue` to scope options further (used for
 * procedures, which are also filtered by the chosen specialty).
 */
export default function GrowableSelect({
  label,
  table,
  hospitalId,
  value,
  onChange,
  filterColumn,
  filterValue,
  disabledReason,
  readOnly = false,
  scoped = true,
}) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const isLocked = Boolean(filterColumn) && !filterValue

  useEffect(() => {
    if ((scoped && !hospitalId) || isLocked) {
      setOptions([])
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      let query = supabase
        .from(table)
        .select('id, name')
        .order('name', { ascending: true })

      if (scoped) {
        query = query.eq('hospital_id', hospitalId)
      }
      if (filterColumn && filterValue) {
        query = query.eq(filterColumn, filterValue)
      }

      const { data, error } = await query
      if (cancelled) return
      if (error) {
        toast.error(`Could not load ${label.toLowerCase()} list.`)
      } else {
        setOptions(data)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId, filterValue, isLocked, scoped])

  function handleSelectChange(e) {
    const val = e.target.value
    if (val === '__add_new__') {
      setAdding(true)
      return
    }
    onChange(val)
  }

  async function handleAddNew() {
    const trimmed = newName.trim()
    if (!trimmed) return

    const row = { name: trimmed }
    if (scoped) row.hospital_id = hospitalId
    if (filterColumn && filterValue) row[filterColumn] = filterValue

    const { data, error } = await supabase
      .from(table)
      .insert(row)
      .select('id, name')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`Added "${trimmed}"`)
    setOptions((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    )
    onChange(data.id)
    setAdding(false)
    setNewName('')
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>

      {isLocked ? (
        <select
          disabled
          className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-400"
        >
          <option>{disabledReason || `Select ${label.toLowerCase()} first`}</option>
        </select>
      ) : adding && !readOnly ? (
        <div className="mt-1 flex flex-col gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddNew()
              }
            }}
            placeholder={`New ${label.toLowerCase()} name`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddNew}
            className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setNewName('')
            }}
            className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          </div>
        </div>
      ) : (
        <select
          value={value || ''}
          onChange={handleSelectChange}
          disabled={loading || readOnly}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="">{loading ? 'Loading…' : `Select ${label.toLowerCase()}`}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          {!readOnly && (
            <option value="__add_new__">+ Add new {label.toLowerCase()}…</option>
          )}
        </select>
      )}
    </div>
  )
}
