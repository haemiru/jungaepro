import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { router } from './router'
import { useAuthStore } from './stores/authStore'
import { useFeatureStore } from './stores/featureStore'
import { useTenantStore } from './stores/tenantStore'
import { supabaseAuth } from './api/supabase'

const SESSION_FLAG = 'sh-session-active'

export default function App() {
  const initAuth = useAuthStore((s) => s.initialize)
  const initFeatures = useFeatureStore((s) => s.initialize)
  const initTenant = useTenantStore((s) => s.initialize)

  useEffect(() => {
    async function boot() {
      // Browser/tab close detection: if sessionStorage flag is missing
      // but localStorage has auth, it means the browser was restarted → sign out
      if (!sessionStorage.getItem(SESSION_FLAG)) {
        const stored = localStorage.getItem('jungaepro-auth')
        if (stored) {
          await supabaseAuth.auth.signOut()
        }
        sessionStorage.setItem(SESSION_FLAG, '1')
      }

      // Tenant resolution and auth run in parallel;
      // features depend on auth (plan), so they chain after auth.
      await Promise.all([
        initTenant(),
        initAuth().then(() => initFeatures()),
      ])
    }
    boot()
  }, [initAuth, initFeatures, initTenant])

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: '14px' },
        }}
      />
    </>
  )
}
