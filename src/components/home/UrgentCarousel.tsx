import { useState, useEffect, useCallback } from 'react'
import { fetchProperties } from '@/api/properties'
import { useTenantStore } from '@/stores/tenantStore'
import { formatPropertyPrice, transactionTypeLabel } from '@/utils/format'
import { useFormatArea } from '@/utils/areaFormat'
import type { Property } from '@/types/database'

export function UrgentCarousel() {
  const formatArea = useFormatArea()
  const [items, setItems] = useState<Property[]>([])
  const [current, setCurrent] = useState(0)
  const agentId = useTenantStore((s) => s.agentId)

  useEffect(() => {
    let cancelled = false
    fetchProperties({ isUrgent: true }, 'newest', 1, 6, agentId ?? undefined)
      .then(({ data }) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [agentId])

  const next = useCallback(() => {
    setCurrent((c) => items.length > 0 ? (c + 1) % items.length : 0)
  }, [items.length])

  useEffect(() => {
    if (items.length === 0) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [next, items.length])

  if (items.length === 0) return null

  const dealBadge = (type: string) => {
    const label = transactionTypeLabel[type] ?? type
    const color = type === 'sale' ? 'bg-blue-100 text-blue-700'
      : type === 'jeonse' ? 'bg-green-100 text-green-700'
      : 'bg-orange-100 text-orange-700'
    return { label, color }
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold text-gray-900">급매 · 추천 매물</h2>
      <div className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {items.map((p) => {
            const { label, color } = dealBadge(p.transaction_type)
            const imageUrl = p.photos?.[0] ?? 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image'
            return (
              <div key={p.id} className="flex w-full shrink-0 gap-4 p-4 sm:p-6">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-32 sm:w-44">
                  <img src={imageUrl} alt={p.title} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>
                      {label}
                    </span>
                    {p.is_urgent && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">급매</span>
                    )}
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900">
                    {formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}
                  </p>
                  <p className="text-sm text-gray-700">{p.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {p.address} · {formatArea(p.exclusive_area_m2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-6 bg-primary-600' : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
