import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon path issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface KakaoMapProps {
  latitude?: number | null
  longitude?: number | null
  onLocationChange?: (data: { latitude: number; longitude: number; address: string }) => void
  readOnly?: boolean
}

const REVERSE_GEOCODE_API = '/api/reverse-geocode'

// Default center: Seoul City Hall
const DEFAULT_LAT = 37.5665
const DEFAULT_LNG = 126.978

export function KakaoMap({ latitude, longitude, onLocationChange, readOnly = false }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return
    if (mapRef.current) return // already initialized

    const lat = latitude ?? DEFAULT_LAT
    const lng = longitude ?? DEFAULT_LNG

    const map = L.map(containerRef.current).setView([lat, lng], latitude ? 16 : 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map

    if (latitude && longitude) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map)
    }

    if (!readOnly) {
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat: clickLat, lng: clickLng } = e.latlng

        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng])
        } else {
          markerRef.current = L.marker([clickLat, clickLng]).addTo(map)
        }

        // Reverse geocode via Kakao REST API
        try {
          const res = await fetch(`${REVERSE_GEOCODE_API}?x=${clickLng}&y=${clickLat}`)
          const data = await res.json()
          const doc = data.documents?.[0]
          const addr = doc?.road_address?.address_name || doc?.address?.address_name || ''
          onLocationChange?.({ latitude: clickLat, longitude: clickLng, address: addr })
        } catch {
          onLocationChange?.({ latitude: clickLat, longitude: clickLng, address: '' })
        }
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // Update marker when coordinates change externally
  useEffect(() => {
    if (!mapRef.current) return
    if (latitude && longitude) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude])
      } else {
        markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current)
      }
      mapRef.current.setView([latitude, longitude], 16)
    }
  }, [latitude, longitude])

  return <div ref={containerRef} className="relative z-0 w-full rounded-lg border border-gray-200" style={{ height: '42vw', maxHeight: '400px' }} />
}
