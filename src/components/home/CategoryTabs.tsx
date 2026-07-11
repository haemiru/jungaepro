import { useRef, useMemo } from 'react'
import { useHomeFilterStore } from '@/stores/homeFilterStore'
import { useCategories } from '@/hooks/useCategories'
import { useTenantStore } from '@/stores/tenantStore'

export function CategoryTabs() {
  const { selectedCategory, setCategory } = useHomeFilterStore()
  const { categories, isLoading } = useCategories()
  const tenant = useTenantStore((s) => s.tenant)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Use specialties from tenant profile (already resolved at init).
  // Show only specialties (in order). Fallback to all categories if none set.
  const sorted = useMemo(() => {
    const specialties = tenant?.specialties ?? []
    if (specialties.length === 0) return categories
    const matched = specialties
      .map((s) => categories.find((c) => c.name === s || c.name.includes(s) || s.includes(c.name)))
      .filter(Boolean) as typeof categories
    return matched.length > 0 ? matched : categories
  }, [categories, tenant?.specialties])

  if (isLoading || sorted.length === 0) return null

  return (
    <section id="category-tabs" className="sticky top-16 z-20 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl">
        <div
          ref={scrollRef}
          className="scrollbar-hide flex overflow-x-auto"
        >
          <button
            onClick={() => setCategory('')}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            전체
          </button>
          {sorted.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
