import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Property } from '@/types/database'
import { formatPropertyPrice } from '@/utils/format'

// 서울시청 (기본 중심)
const DEFAULT_CENTER: L.LatLngExpression = [37.5665, 126.978]

function priceLabel(p: Property): string {
  return formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 검색 결과 매물을 가격 라벨 마커로 표시하는 지도. 마커 클릭 → 매물 상세 링크 팝업. */
export function PropertyMapView({ properties }: { properties: Property[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // 지도 1회 초기화
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  // 매물 변경 시 마커 갱신
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const points: L.LatLngExpression[] = []
    for (const p of properties) {
      if (p.latitude == null || p.longitude == null) continue
      const pos: L.LatLngExpression = [p.latitude, p.longitude]
      points.push(pos)

      const icon = L.divIcon({
        className: 'property-price-marker',
        html: `<div style="background:#2563eb;color:#fff;padding:3px 9px;border-radius:14px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 1px 5px rgba(0,0,0,.35);transform:translate(-50%,-100%)">${escapeHtml(priceLabel(p))}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      })
      const marker = L.marker(pos, { icon }).addTo(layer)
      marker.bindPopup(
        `<div style="min-width:170px;font-family:sans-serif">
          <div style="font-weight:700;margin-bottom:4px;line-height:1.3">${escapeHtml(p.title)}</div>
          <div style="color:#2563eb;font-weight:700;font-size:14px">${escapeHtml(priceLabel(p))}</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px">${escapeHtml(p.address ?? '')}</div>
          <a href="/properties/${p.id}" style="display:inline-block;margin-top:8px;color:#2563eb;font-weight:600;font-size:13px;text-decoration:none">상세보기 →</a>
        </div>`,
      )
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 })
    } else {
      map.setView(DEFAULT_CENTER, 11)
    }
  }, [properties])

  const withCoords = properties.filter((p) => p.latitude != null && p.longitude != null).length

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="w-full rounded-xl border border-gray-200"
        style={{ height: '600px', zIndex: 0 }}
      />
      {withCoords === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center rounded-xl bg-white/70 text-sm text-gray-500">
          위치 정보가 등록된 매물이 없습니다.
        </div>
      )}
    </div>
  )
}
