import { Link, useNavigate } from 'react-router-dom'
import type { Property, PropertyStatus } from '@/types/database'
import { updatePropertyStatus } from '@/api/properties'
import { formatPropertyPrice, propertyStatusColor, transactionTypeLabel, formatDate } from '@/utils/format'
import { AreaUnitToggle } from '@/components/common/AreaUnitToggle'
import { useFormatArea } from '@/utils/areaFormat'
import { useCategories } from '@/hooks/useCategories'

interface AdminPropertyTableProps {
  properties: Property[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onSelectAll: () => void
  onStatusChange?: (id: string, status: PropertyStatus) => void
}

const statusOptions: { value: PropertyStatus; label: string }[] = [
  { value: 'draft', label: '매물등록중' },
  { value: 'active', label: '포털 공개중' },
  { value: 'contracted', label: '계약진행' },
  { value: 'completed', label: '거래완료' },
  { value: 'hold', label: '보류' },
]

export function AdminPropertyTable({ properties, selectedIds, onSelect, onSelectAll, onStatusChange }: AdminPropertyTableProps) {
  const formatArea = useFormatArea()
  const { findCategory } = useCategories()
  const navigate = useNavigate()

  const handleCreateContract = async (p: Property) => {
    if (p.status !== 'contracted') {
      await updatePropertyStatus([p.id], 'contracted')
      onStatusChange?.(p.id, 'contracted')
    }
    navigate(`/admin/contracts/new?propertyId=${p.id}`)
  }
  const allSelected = properties.length > 0 && properties.every((p) => selectedIds.has(p.id))

  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <table className="w-full min-w-[1050px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
            </th>
            <th className="px-4 py-3">매물</th>
            <th className="px-4 py-3">유형/거래</th>
            <th className="px-4 py-3">가격</th>
            <th className="px-4 py-3"><span className="inline-flex items-center gap-1">면적 <AreaUnitToggle /></span></th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3 text-center">조회/문의/찜</th>
            <th className="px-4 py-3">등록일</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {properties.map((p) => {
            const cat = findCategory(p.category_id)
            return (
              <tr key={p.id} className={`transition-colors hover:bg-gray-50 ${selectedIds.has(p.id) ? 'bg-primary-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => onSelect(p.id)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                </td>
                <td className="max-w-[250px] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.photos?.[0] || 'https://placehold.co/80x60/e2e8f0/94a3b8?text=N'} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{p.title}</p>
                      <p className="truncate text-xs text-gray-400">{p.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span>{cat?.name}</span>
                  <br />
                  <span className="text-gray-400">{transactionTypeLabel[p.transaction_type]}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  {formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {formatArea(p.exclusive_area_m2)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={p.status}
                    onChange={(e) => onStatusChange?.(p.id, e.target.value as PropertyStatus)}
                    className={`cursor-pointer rounded px-2 py-0.5 text-xs font-semibold border-0 ${propertyStatusColor[p.status]}`}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {p.is_urgent && <span className="ml-1 text-xs text-red-500">🔥</span>}
                </td>
                <td className="px-4 py-3 text-center text-xs text-gray-400">
                  {p.view_count} / {p.inquiry_count} / {p.favorite_count}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Link to={`/admin/properties/${p.id}`} className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50">
                      수정
                    </Link>
                    <button onClick={() => handleCreateContract(p)} className="whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50">
                      계약서 작성
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {properties.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">매물이 없습니다.</div>
      )}
    </div>
  )
}
