import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiPlus, FiX, FiArrowLeft, FiLock, FiCheckCircle } from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import GrowableSelect from '../components/GrowableSelect'
import FileAttachments from '../components/FileAttachments'
import ShareManager from '../components/ShareManager'
import { computeCaseLevel, atLeast, isLocked } from '../lib/permissions'

const TEXT_FIELDS = [
  { key: 'surgeonPreference', column: 'surgeon_preference', label: 'Surgeon Preference' },
  { key: 'patientPosition', column: 'patient_position', label: 'Patient Position' },
  { key: 'equipment', column: 'equipment', label: 'Equipment' },
  { key: 'instruments', column: 'instruments', label: 'Instruments' },
  { key: 'supplies', column: 'supplies', label: 'Supplies' },
  { key: 'specimen', column: 'specimen', label: 'Specimen' },
  { key: 'bloodBank', column: 'blood_bank', label: 'Blood Bank' },
  { key: 'implant', column: 'implant', label: 'Implant' },
  { key: 'dressing', column: 'dressing', label: 'Dressing' },
  { key: 'postOpCare', column: 'post_op_care', label: 'Post Op Care' },
]

const emptyForm = {
  specialtyId: '',
  procedureId: '',
  surgeonId: '',
  surgeonPreference: '',
  patientPosition: '',
  equipment: '',
  instruments: '',
  supplies: '',
  specimen: '',
  bloodBank: '',
  implant: '',
  dressing: '',
  postOpCare: '',
}

export default function CaseForm() {
  const { id: caseId } = useParams()
  const navigate = useNavigate()
  const { user, hospitalId, loading: authLoading } = useAuth()

  const [form, setForm] = useState(emptyForm)
  const [caseRow, setCaseRow] = useState(null)
  const [shares, setShares] = useState([])
  const [customFields, setCustomFields] = useState([])
  const [files, setFiles] = useState([])
  const [loadingCase, setLoadingCase] = useState(Boolean(caseId))
  const [saving, setSaving] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

  useEffect(() => {
    if (!caseId) return

    async function loadCase() {
      const { data: row, error } = await supabase
        .from('surgical_cases')
        .select('*')
        .eq('id', caseId)
        .single()

      if (error) {
        toast.error('Could not load this case.')
        setLoadingCase(false)
        return
      }

      setCaseRow(row)
      setForm({
        specialtyId: row.specialty_id || '',
        procedureId: row.procedure_id || '',
        surgeonId: row.surgeon_id || '',
        surgeonPreference: row.surgeon_preference || '',
        patientPosition: row.patient_position || '',
        equipment: row.equipment || '',
        instruments: row.instruments || '',
        supplies: row.supplies || '',
        specimen: row.specimen || '',
        bloodBank: row.blood_bank || '',
        implant: row.implant || '',
        dressing: row.dressing || '',
        postOpCare: row.post_op_care || '',
      })

      const { data: shareRows } = await supabase
        .from('case_shares')
        .select('user_id, permission')
        .eq('case_id', caseId)
      setShares(shareRows || [])

      const { data: cf } = await supabase
        .from('case_custom_fields')
        .select('*')
        .eq('case_id', caseId)
        .order('sort_order', { ascending: true })
      setCustomFields(cf || [])

      const { data: f } = await supabase
        .from('case_files')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true })
      setFiles(f || [])

      setLoadingCase(false)
    }

    loadCase()
  }, [caseId])

  const level = caseId
    ? computeCaseLevel({ caseRow, shares, userId: user?.id })
    : 'approve' // creating a brand-new case — the creator has full rights
  const locked = caseId ? isLocked(caseRow, level) : false
  const canEdit = atLeast(level, 'edit') && !locked
  const canDownload = atLeast(level, 'download')
  const canApprove = atLeast(level, 'approve')
  const isCreator = caseId ? caseRow?.created_by === user?.id : true

  function updateField(key) {
    return (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  function addCustomField() {
    setCustomFields((prev) => [...prev, { field_name: '', field_value: '' }])
  }

  function updateCustomField(index, key, value) {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    )
  }

  function removeCustomField(index) {
    setCustomFields((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.specialtyId) {
      toast.error('Please select a surgical specialty.')
      return
    }

    setSaving(true)

    const payload = {
      hospital_id: hospitalId,
      specialty_id: form.specialtyId || null,
      procedure_id: form.procedureId || null,
      surgeon_id: form.surgeonId || null,
      surgeon_preference: form.surgeonPreference,
      patient_position: form.patientPosition,
      equipment: form.equipment,
      instruments: form.instruments,
      supplies: form.supplies,
      specimen: form.specimen,
      blood_bank: form.bloodBank,
      implant: form.implant,
      dressing: form.dressing,
      post_op_care: form.postOpCare,
    }

    let savedCaseId = caseId

    if (caseId) {
      const { error } = await supabase
        .from('surgical_cases')
        .update(payload)
        .eq('id', caseId)
      if (error) {
        toast.error(error.message)
        setSaving(false)
        return
      }
    } else {
      payload.created_by = user.id
      const { data, error } = await supabase
        .from('surgical_cases')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        toast.error(error.message)
        setSaving(false)
        return
      }
      savedCaseId = data.id
    }

    if (caseId) {
      await supabase.from('case_custom_fields').delete().eq('case_id', savedCaseId)
    }
    const rowsToInsert = customFields
      .filter((f) => f.field_name.trim())
      .map((f, index) => ({
        case_id: savedCaseId,
        hospital_id: hospitalId,
        field_name: f.field_name.trim(),
        field_value: f.field_value,
        sort_order: index,
      }))
    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('case_custom_fields').insert(rowsToInsert)
      if (error) toast.error(`Custom fields: ${error.message}`)
    }

    setSaving(false)
    toast.success(caseId ? 'Case updated' : 'Case created')

    if (!caseId) {
      navigate(`/cases/${savedCaseId}`, { replace: true })
    }
  }

  async function handleToggleStatus() {
    if (!caseRow) return
    const nextStatus = caseRow.status === 'approved' ? 'draft' : 'approved'
    setTogglingStatus(true)
    const { data, error } = await supabase
      .from('surgical_cases')
      .update({ status: nextStatus })
      .eq('id', caseId)
      .select('*')
      .single()
    setTogglingStatus(false)

    if (error) {
      toast.error(error.message)
      return
    }
    setCaseRow(data)
    toast.success(nextStatus === 'approved' ? 'Case approved and locked' : 'Case unlocked')
  }

  if (authLoading || loadingCase) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <FiArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {caseId ? 'Edit surgical case' : 'New surgical case'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Document the procedure details below.
              </p>
            </div>

            {caseId && (
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    caseRow?.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {caseRow?.status === 'approved' ? 'Approved' : 'Draft'}
                </span>
                {canApprove && (
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={togglingStatus}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {caseRow?.status === 'approved' ? (
                      <>
                        <FiLock className="h-3.5 w-3.5" /> Unlock
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="h-3.5 w-3.5" /> Approve
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {locked && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This case is approved and locked. Ask an approver to unlock it before editing.
            </p>
          )}
          {!locked && caseId && !canEdit && (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              You have {level} access to this case — editing is turned off.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-75">
              <div className="grid gap-4 sm:grid-cols-2">
                <GrowableSelect
                  label="Surgical Specialty"
                  table="specialties"
                  hospitalId={hospitalId}
                  value={form.specialtyId}
                  onChange={(val) =>
                    setForm((prev) => ({ ...prev, specialtyId: val, procedureId: '' }))
                  }
                  readOnly={!canEdit}
                />

                <GrowableSelect
                  label="Surgical Procedure"
                  table="procedures"
                  hospitalId={hospitalId}
                  value={form.procedureId}
                  onChange={(val) => setForm((prev) => ({ ...prev, procedureId: val }))}
                  filterColumn="specialty_id"
                  filterValue={form.specialtyId}
                  disabledReason="Select a specialty first"
                  readOnly={!canEdit}
                />

                <GrowableSelect
                  label="Surgeon Name"
                  table="surgeons"
                  hospitalId={hospitalId}
                  value={form.surgeonId}
                  onChange={(val) => setForm((prev) => ({ ...prev, surgeonId: val }))}
                  readOnly={!canEdit}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {TEXT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700">
                      {field.label}
                    </label>
                    <textarea
                      rows={2}
                      value={form[field.key]}
                      onChange={updateField(field.key)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-700">Additional fields</h3>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      <FiPlus className="h-4 w-4" /> Add field
                    </button>
                  )}
                </div>

                {customFields.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Need to record something not listed above? Add a custom field.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {customFields.map((field, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Field name"
                          value={field.field_name}
                          onChange={(e) => updateCustomField(index, 'field_name', e.target.value)}
                          className="w-1/3 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={field.field_value}
                          onChange={(e) => updateCustomField(index, 'field_value', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => removeCustomField(index)}
                            className="rounded-lg border border-slate-300 px-2.5 text-slate-500 hover:bg-slate-50"
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : caseId ? 'Save changes' : 'Create case'}
                </button>
              )}
            </fieldset>
          </form>

          <div className="mt-8 space-y-8 border-t border-slate-100 pt-6">
            {caseId ? (
              <FileAttachments
                caseId={caseId}
                hospitalId={hospitalId}
                userId={user.id}
                files={files}
                onFilesChange={setFiles}
                canDownload={canDownload}
                canEdit={canEdit}
              />
            ) : (
              <p className="text-sm text-slate-400">
                Save the case first, then you can attach images, video, PDFs, text files, or voice recordings.
              </p>
            )}

            {caseId && isCreator && (
              <ShareManager caseId={caseId} hospitalId={hospitalId} currentUserId={user.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
