import { useAreaUnitStore } from '@/stores/areaUnitStore'
import { sqmToPyeong } from '@/utils/format'

/**
 * Format area value based on current unit store.
 * Uses getState() — call inside components that subscribe to useAreaUnitStore
 * or alongside AreaUnitToggle to ensure reactivity.
 */
export function formatAreaByUnit(sqm: number | null | undefined): string {
  if (sqm == null) return '-'
  const unit = useAreaUnitStore.getState().unit
  if (unit === 'pyeong') {
    return `${sqmToPyeong(sqm)}평`
  }
  return `${sqm}㎡`
}

/** React hook version — subscribes to store for automatic re-render */
export function useFormatArea() {
  const unit = useAreaUnitStore((s) => s.unit)
  return (sqm: number | null | undefined): string => {
    if (sqm == null) return '-'
    if (unit === 'pyeong') return `${sqmToPyeong(sqm)}평`
    return `${sqm}㎡`
  }
}
