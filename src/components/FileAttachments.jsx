import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FiImage,
  FiFilm,
  FiFileText,
  FiMusic,
  FiFile,
  FiDownload,
  FiRefreshCw,
  FiUploadCloud,
  FiTrash2,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi'
import { supabase } from '../lib/supabaseClient'

const BUCKET = 'case-attachments'

function kindOf(fileType = '') {
  if (fileType.startsWith('image/')) return 'image'
  if (fileType.startsWith('video/')) return 'video'
  if (fileType.startsWith('audio/')) return 'audio'
  if (fileType === 'application/pdf' || fileType.startsWith('text/')) return 'doc'
  return 'other'
}

function iconFor(fileType = '') {
  const kind = kindOf(fileType)
  if (kind === 'image') return <FiImage className="h-5 w-5 text-brand-600" />
  if (kind === 'video') return <FiFilm className="h-5 w-5 text-brand-600" />
  if (kind === 'audio') return <FiMusic className="h-5 w-5 text-brand-600" />
  if (kind === 'doc') return <FiFileText className="h-5 w-5 text-brand-600" />
  return <FiFile className="h-5 w-5 text-brand-600" />
}

function formatSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(1)} ${units[unit]}`
}

export default function FileAttachments({
  caseId,
  hospitalId,
  userId,
  files,
  onFilesChange,
  canDownload = true,
  canEdit = true,
}) {
  const [uploading, setUploading] = useState(false)
  const [previewUrls, setPreviewUrls] = useState({})
  const [thumbUrls, setThumbUrls] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const addInputRef = useRef(null)
  const replaceInputRef = useRef({})

  // Load small thumbnails for images up front — video/audio previews are
  // loaded on demand (see togglePreview) to avoid generating a signed URL
  // for every attachment on every page load.
  useEffect(() => {
    if (!canDownload) return
    const imagesNeedingThumbs = files.filter(
      (f) => kindOf(f.file_type) === 'image' && !thumbUrls[f.id]
    )
    if (imagesNeedingThumbs.length === 0) return

    let cancelled = false
    async function loadThumbs() {
      for (const f of imagesNeedingThumbs) {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(f.storage_path, 3600)
        if (!cancelled && !error) {
          setThumbUrls((prev) => ({ ...prev, [f.id]: data.signedUrl }))
        }
      }
    }
    loadThumbs()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, canDownload])

  async function togglePreview(fileRow) {
    if (expandedId === fileRow.id) {
      setExpandedId(null)
      return
    }
    if (!previewUrls[fileRow.id]) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(fileRow.storage_path, 3600)
      if (error) {
        toast.error(error.message)
        return
      }
      setPreviewUrls((prev) => ({ ...prev, [fileRow.id]: data.signedUrl }))
    }
    setExpandedId(fileRow.id)
  }

  async function handleAddFiles(e) {
    const selected = Array.from(e.target.files || [])
    if (selected.length === 0) return
    setUploading(true)

    for (const file of selected) {
      const path = `${hospitalId}/${caseId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file)

      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`)
        continue
      }

      const { data: row, error: insertError } = await supabase
        .from('case_files')
        .insert({
          case_id: caseId,
          hospital_id: hospitalId,
          storage_path: path,
          file_name: file.name,
          file_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
        })
        .select('*')
        .single()

      if (insertError) {
        toast.error(`${file.name}: ${insertError.message}`)
        continue
      }

      onFilesChange((prev) => [...prev, row])
    }

    setUploading(false)
    if (addInputRef.current) addInputRef.current.value = ''
    toast.success('Upload complete')
  }

  async function handleReplace(fileRow, newFile) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .update(fileRow.storage_path, newFile)

    if (uploadError) {
      toast.error(uploadError.message)
      return
    }

    const { data: updated, error: updateError } = await supabase
      .from('case_files')
      .update({
        file_name: newFile.name,
        file_type: newFile.type,
        size_bytes: newFile.size,
      })
      .eq('id', fileRow.id)
      .select('*')
      .single()

    if (updateError) {
      toast.error(updateError.message)
      return
    }

    onFilesChange((prev) => prev.map((f) => (f.id === fileRow.id ? updated : f)))
    setThumbUrls((prev) => {
      const next = { ...prev }
      delete next[fileRow.id]
      return next
    })
    setPreviewUrls((prev) => {
      const next = { ...prev }
      delete next[fileRow.id]
      return next
    })
    toast.success(`Replaced ${fileRow.file_name}`)
  }

  async function handleDownload(fileRow) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(fileRow.storage_path, 60)

    if (error) {
      toast.error(error.message)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(fileRow) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([fileRow.storage_path])
    if (storageError) {
      toast.error(storageError.message)
      return
    }
    const { error: dbError } = await supabase
      .from('case_files')
      .delete()
      .eq('id', fileRow.id)
    if (dbError) {
      toast.error(dbError.message)
      return
    }
    onFilesChange((prev) => prev.filter((f) => f.id !== fileRow.id))
    toast.success('File removed')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Attachments</h3>
        {canEdit && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FiUploadCloud className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload files'}
            <input
              ref={addInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,text/plain,audio/*"
              onChange={handleAddFiles}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Images, video clips, PDF, text files, or voice recordings — up to 50MB each.
        {!canDownload && ' You have view-only access to this case, so downloading is turned off.'}
      </p>

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No files attached yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {files.map((f) => {
            const kind = kindOf(f.file_type)
            const canPreview = canDownload && (kind === 'video' || kind === 'audio')
            const isExpanded = expandedId === f.id

            return (
              <li key={f.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  {kind === 'image' && thumbUrls[f.id] ? (
                    <img
                      src={thumbUrls[f.id]}
                      alt={f.file_name}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="shrink-0">{iconFor(f.file_type)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{f.file_name}</p>
                    <p className="text-xs text-slate-400">{formatSize(f.size_bytes)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canPreview && (
                      <button
                        type="button"
                        title={isExpanded ? 'Hide preview' : 'Preview'}
                        onClick={() => togglePreview(f)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                      >
                        {isExpanded ? (
                          <FiEyeOff className="h-4 w-4" />
                        ) : (
                          <FiEye className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {canDownload && (
                      <button
                        type="button"
                        title="Download"
                        onClick={() => handleDownload(f)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                      >
                        <FiDownload className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          title="Replace"
                          onClick={() => replaceInputRef.current[f.id]?.click()}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                        </button>
                        <input
                          type="file"
                          ref={(el) => (replaceInputRef.current[f.id] = el)}
                          className="hidden"
                          onChange={(e) => {
                            const newFile = e.target.files?.[0]
                            if (newFile) handleReplace(f, newFile)
                            e.target.value = ''
                          }}
                        />
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => handleDelete(f)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && previewUrls[f.id] && (
                  <div className="mt-2.5">
                    {kind === 'video' ? (
                      <video
                        src={previewUrls[f.id]}
                        controls
                        className="max-h-64 w-full rounded-lg bg-black"
                      />
                    ) : (
                      <audio src={previewUrls[f.id]} controls className="w-full" />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
