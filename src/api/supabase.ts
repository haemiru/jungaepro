import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'

/**
 * Auth 전용 클라이언트 — 로그인, 회원가입, 세션 관리
 * accessToken 없이 일반 auth 플로우 사용
 */
export const supabaseAuth = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    storageKey: 'jungaepro-auth',
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
})

/**
 * 데이터 전용 클라이언트 — DB 쿼리, Storage, Functions
 * accessToken으로 localStorage에서 직접 토큰 읽기 (getSession() deadlock 우회)
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => {
    try {
      const raw = localStorage.getItem('jungaepro-auth')
      if (!raw) return null
      return (JSON.parse(raw) as { access_token?: string }).access_token ?? null
    } catch {
      return null
    }
  },
})
