import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Property } from '@/types/database'
import { fetchFavoriteProperties, removeFavorite } from '@/api/favorites'
import { useAuthStore } from '@/stores/authStore'
import { PropertyCard } from '@/components/home/PropertyCard'
import { Button } from '@/components/common'
import toast from 'react-hot-toast'

export function FavoritesPage() {
  const user = useAuthStore((s) => s.user)
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!user) { setIsLoading(false); return }
      setIsLoading(true)
      try {
        const data = await fetchFavoriteProperties()
        if (!cancelled) setProperties(data)
      } catch {
        if (!cancelled) setProperties([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user])

  const handleRemove = async (propertyId: string) => {
    try {
      await removeFavorite(propertyId)
      setProperties((prev) => prev.filter((p) => p.id !== propertyId))
      toast.success('관심 매물에서 삭제했습니다.')
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl">❤️</p>
        <h2 className="mt-4 text-lg font-bold text-gray-800">로그인이 필요합니다</h2>
        <p className="mt-2 text-sm text-gray-500">관심 매물을 저장하려면 로그인해주세요.</p>
        <Link to="/auth/login">
          <Button className="mt-6">로그인</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold">관심 매물</h1>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : properties.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl">❤️</p>
          <p className="mt-4 text-sm text-gray-500">저장한 관심 매물이 없습니다.</p>
          <Link to="/">
            <Button variant="outline" className="mt-4">매물 둘러보기</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p.id} className="relative">
              <PropertyCard property={p} />
              <button
                onClick={() => handleRemove(p.id)}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-red-500 shadow-sm transition-colors hover:bg-red-50"
                title="관심 매물 삭제"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
