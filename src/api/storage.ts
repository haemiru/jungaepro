import { supabase } from './supabase'

const BUCKET = 'property-photos'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'JPG, PNG 파일만 업로드할 수 있습니다.'
  }
  if (file.size > MAX_SIZE) {
    return '파일 크기는 10MB 이하여야 합니다.'
  }
  return null
}

const UPLOAD_TIMEOUT = 30_000 // 30초

export async function uploadPropertyPhoto(file: File, agentId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const path = `${agentId}/${timestamp}-${random}.${ext}`

  // localStorage에서 직접 토큰 읽기 (supabase.auth.getSession()이 hang되는 문제 우회)
  const raw = localStorage.getItem('jungaepro-auth')
  const token = raw ? (JSON.parse(raw) as { access_token?: string }).access_token : null
  if (!token) throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT)

  console.log('[Storage] starting fetch to:', uploadUrl)
  try {
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': '3600',
        'Content-Type': file.type,
      },
      body: file,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      throw new Error((body as Record<string, string>).message || `업로드 실패 (HTTP ${resp.status})`)
    }
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('업로드 시간 초과 (30초)')
    }
    throw e
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

const LOGO_BUCKET = 'property-photos' // reuse bucket, logos stored under {agentId}/logo/
const LOGO_MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function uploadLogo(file: File, agentId: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('JPG, PNG 파일만 업로드할 수 있습니다.')
  if (file.size > LOGO_MAX_SIZE) throw new Error('파일 크기는 2MB 이하여야 합니다.')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${agentId}/logo/office-logo.${ext}`

  // Overwrite existing logo
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (error) throw new Error(`로고 업로드 실패: ${error.message}`)

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  // Append cache-bust to force reload
  return `${data.publicUrl}?t=${Date.now()}`
}

// ── 등기부등본 PDF 업로드 ──

const DOC_MAX_SIZE = 20 * 1024 * 1024 // 20MB

export function validatePdfFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'PDF 파일만 업로드할 수 있습니다.'
  }
  if (file.size > DOC_MAX_SIZE) {
    return '파일 크기는 20MB 이하여야 합니다.'
  }
  return null
}

export async function uploadRegistryPdf(file: File, agentId: string): Promise<{ url: string; fileName: string }> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const path = `${agentId}/registry/${timestamp}-${random}-${safeName}`

  const raw = localStorage.getItem('jungaepro-auth')
  const token = raw ? (JSON.parse(raw) as { access_token?: string }).access_token : null
  if (!token) throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT)

  try {
    const resp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Cache-Control': '3600',
        'Content-Type': file.type,
      },
      body: file,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      throw new Error((body as Record<string, string>).message || `업로드 실패 (HTTP ${resp.status})`)
    }
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('업로드 시간 초과 (30초)')
    }
    throw e
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, fileName: file.name }
}

export async function deleteStorageFile(url: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length).split('?')[0]
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`삭제 실패: ${error.message}`)
}

export async function deletePropertyPhoto(url: string): Promise<void> {
  // Extract path from public URL: .../object/public/property-photos/{path}
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return

  const path = url.slice(idx + marker.length)
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(`삭제 실패: ${error.message}`)
}
