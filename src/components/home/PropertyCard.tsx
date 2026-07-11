import { Link } from 'react-router-dom'
import type { Property } from '@/types/database'
import { formatPropertyPrice, transactionTypeLabel } from '@/utils/format'
import { useFormatArea } from '@/utils/areaFormat'

interface PropertyCardProps {
  property: Property
}

const dealTypeBadgeColor: Record<string, string> = {
  '매매': 'bg-blue-100 text-blue-700',
  '전세': 'bg-green-100 text-green-700',
  '월세': 'bg-orange-100 text-orange-700',
}

export function PropertyCard({ property }: PropertyCardProps) {
  const formatArea = useFormatArea()
  const dealLabel = transactionTypeLabel[property.transaction_type] ?? property.transaction_type
  const priceText = formatPropertyPrice(property.transaction_type, property.sale_price, property.deposit, property.monthly_rent)
  const areaText = formatArea(property.exclusive_area_m2)
  const floorText = property.floor && property.total_floors ? `${property.floor}/${property.total_floors}층` : null
  const imageUrl = property.photos?.[0] ?? 'https://placehold.co/400x300/e2e8f0/64748b?text=No+Image'

  return (
    <Link to={`/properties/${property.id}`} className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={imageUrl}
          alt={property.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Badges */}
        <div className="absolute left-2 top-2 flex gap-1">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${dealTypeBadgeColor[dealLabel] || 'bg-gray-100 text-gray-700'}`}>
            {dealLabel}
          </span>
          {property.is_urgent && (
            <span className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
              급매
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <p className="text-lg font-bold text-gray-900">{priceText}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-700 truncate">{property.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {property.address} · {areaText}
          {floorText && ` · ${floorText}`}
        </p>
        <div className="mt-auto pt-2">
          {property.tags && property.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {property.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>
      </div>
    </Link>
  )
}
