import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchSharedProperties, createCoBrokerageRequest } from '@/api/co-brokerage'
import type { SharedProperty } from '@/types/database'
import { formatPrice, transactionTypeLabel, formatRelativeTime } from '@/utils/format'
import { useFormatArea } from '@/utils/areaFormat'
import toast from 'react-hot-toast'

export function CoBrokeragePoolPage() {
  const formatArea = useFormatArea()
  const [properties, setProperties] = useState<SharedProperty[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [requestModal, setRequestModal] = useState<SharedProperty | null>(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  const loadData = (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    fetchSharedProperties(search || undefined)
      .then((data) => setProperties(data))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = () => {
    loadData(true)
  }

  const handleRequest = async () => {
    if (!requestModal) return
    if (!message.trim()) {
      toast.error('요청 메시지를 입력해주세요.')
      return
    }
    setIsSending(true)
    await createCoBrokerageRequest({
      shared_property_id: requestModal.id,
      message,
      property_title: requestModal.property_title,
      address: requestModal.address,
    })
    toast.success('공동중개 요청이 전송되었습니다.')
    setRequestModal(null)
    setMessage('')
    setIsSending(false)
  }

  const getPriceDisplay = (sp: SharedProperty) => {
    switch (sp.transaction_type) {
      case 'sale': return formatPrice(sp.sale_price)
      case 'jeonse': return formatPrice(sp.deposit)
      case 'monthly': return `${formatPrice(sp.deposit)} / 월 ${formatPrice(sp.monthly_rent)}`
      default: return '-'
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">공동중개</h1>
          <p className="mt-1 text-sm text-gray-500">다른 중개사가 공유한 매물을 확인하고 공동중개를 요청합니다.</p>
        </div>
        <Link to="/admin/co-brokerage/requests" className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200">
          요청 관리
        </Link>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="매물명, 주소, 중개사무소 검색..."
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
        <button onClick={handleSearch} className="shrink-0 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700">검색</button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">공유 매물</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{properties.length}건</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">매매</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{properties.filter((p) => p.transaction_type === 'sale').length}건</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">임대</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{properties.filter((p) => p.transaction_type !== 'sale').length}건</p>
        </div>
      </div>

      {/* Property Cards */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : properties.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
          공유된 매물이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {properties.map((sp) => (
            <div key={sp.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      sp.transaction_type === 'sale' ? 'bg-blue-100 text-blue-700' : sp.transaction_type === 'jeonse' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {transactionTypeLabel[sp.transaction_type]}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatRelativeTime(sp.created_at)}</span>
                  </div>
                  <h3 className="mt-1 truncate text-sm font-bold">{sp.property_title}</h3>
                  <p className="mt-0.5 truncate text-xs text-gray-400">{sp.address}</p>
                </div>
              </div>

              {/* Info */}
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="font-bold text-gray-900">{getPriceDisplay(sp)}</span>
                {sp.exclusive_area_m2 && <span>{formatArea(sp.exclusive_area_m2)}</span>}
              </div>

              {/* Agent Info (basic) */}
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {sp.agent_name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-medium">{sp.agent_name}</p>
                  <p className="text-[10px] text-gray-400">{sp.office_name}</p>
                </div>
                <span className="ml-auto text-[10px] text-gray-400">수수료 {sp.commission_ratio}:{100 - sp.commission_ratio}</span>
              </div>

              {/* Action */}
              <button
                onClick={() => { setRequestModal(sp); setMessage('') }}
                className="mt-3 w-full rounded-lg bg-primary-600 py-2 text-xs font-medium text-white hover:bg-primary-700"
              >
                공동중개 요청
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Request Modal */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">공동중개 요청</h2>
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium">{requestModal.property_title}</p>
              <p className="text-xs text-gray-400">{requestModal.address}</p>
              <p className="mt-1 text-xs">
                <span className="font-medium">{requestModal.agent_name}</span> · {requestModal.office_name}
              </p>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs text-gray-400">요청 메시지</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="공동중개 요청 사유를 입력해주세요..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setRequestModal(null)} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200">취소</button>
              <button onClick={handleRequest} disabled={isSending} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {isSending ? '전송 중...' : '요청 전송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
