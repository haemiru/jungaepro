const POSTCODE_SDK_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
const GEOCODE_API = '/api/geocode'

// --- Daum Postcode SDK ---
let postcodeLoadPromise: Promise<void> | null = null

function loadPostcodeSDK(): Promise<void> {
  if (postcodeLoadPromise) return postcodeLoadPromise
  if (window.daum?.Postcode) {
    postcodeLoadPromise = Promise.resolve()
    return postcodeLoadPromise
  }
  postcodeLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = POSTCODE_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { postcodeLoadPromise = null; reject(new Error('Failed to load Postcode SDK')) }
    document.head.appendChild(script)
  })
  return postcodeLoadPromise
}

/** Open Daum Postcode popup and return selected address */
export function openAddressSearch(): Promise<daum.PostcodeResult> {
  return loadPostcodeSDK().then(
    () =>
      new Promise((resolve) => {
        new window.daum.Postcode({
          oncomplete: (data) => resolve(data),
        }).open()
      }),
  )
}

/** Geocode address using Kakao Local REST API (via server proxy) */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`${GEOCODE_API}?query=${encodeURIComponent(address)}`)
    const data = await res.json()
    if (data.documents?.length > 0) {
      const doc = data.documents[0]
      return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) }
    }
  } catch (e) { console.error('[geocodeAddress] error:', e) }
  return null
}
