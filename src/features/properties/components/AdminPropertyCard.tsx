import { Link, useNavigate } from 'react-router-dom'
import type { Property } from '@/types/database'
import { formatPropertyPrice, propertyStatusLabel, propertyStatusColor, transactionTypeLabel, formatDate } from '@/utils/format'
import { updatePropertyStatus } from '@/api/properties'
import { useFormatArea } from '@/utils/areaFormat'
import { useCategories } from '@/hooks/useCategories'

interface AdminPropertyCardProps {
  property: Property
  isSelected: boolean
  onSelect: (id: string) => void
}

export function AdminPropertyCard({ property: p, isSelected, onSelect }: AdminPropertyCardProps) {
  const formatArea = useFormatArea()
  const { findCategory } = useCategories()
  const navigate = useNavigate()
  const cat = findCategory(p.category_id)

  const handleCreateContract = async () => {
    if (p.status !== 'contracted') {
      await updatePropertyStatus([p.id], 'contracted')
    }
    navigate(`/admin/contracts/new?propertyId=${p.id}`)
  }

  return (
    <div className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 transition-all ${isSelected ? 'ring-primary-400 ring-2' : 'ring-gray-200'}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img src={p.photos?.[0] || 'https://placehold.co/400x300/e2e8f0/94a3b8?text=No+Image'} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
        <div className="absolute left-2 top-2 flex gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${propertyStatusColor[p.status]}`}>{propertyStatusLabel[p.status]}</span>
          {p.is_urgent && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">급매</span>}
        </div>
        <label className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/80 backdrop-blur-sm">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(p.id)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
        </label>
      </div>
      <div className="p-3">
        <p className="text-base font-bold text-gray-900">{formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-700">{p.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{cat?.name} · {transactionTypeLabel[p.transaction_type]} · {formatArea(p.exclusive_area_m2)}</p>
        <p className="truncate text-xs text-gray-400">{p.address}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span>👁 {p.view_count}</span>
          <span>💬 {p.inquiry_count}</span>
          <span>❤️ {p.favorite_count}</span>
          <span className="ml-auto">{formatDate(p.created_at)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <Link to={`/admin/properties/${p.id}`} className="flex-1 rounded-lg bg-gray-100 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-200">수정</Link>
          <button onClick={handleCreateContract} className="flex-1 rounded-lg bg-green-50 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">계약서 작성</button>
        </div>
      </div>
    </div>
  )
}
