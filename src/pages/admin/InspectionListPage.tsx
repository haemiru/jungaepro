import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchInspections, createInspection } from '@/api/inspections'
import { fetchAdminProperties } from '@/api/properties'
import type { Inspection, InspectionStatus, Property } from '@/types/database'
import { formatDate, inspectionStatusLabel, inspectionStatusColor, inspectionGradeColor } from '@/utils/format'
import toast from 'react-hot-toast'

type StatusTab = InspectionStatus | 'all'

export function InspectionListPage() {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await fetchInspections(statusTab)
        if (!cancelled) setInspections(data)
      } catch {
        if (!cancelled) setInspections([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [statusTab])

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'scheduled', label: '예정' },
    { key: 'in_progress', label: '진행중' },
    { key: 'completed', label: '완료' },
  ]

  const scheduledCount = inspections.filter((i) => i.status === 'scheduled').length
  const inProgressCount = inspections.filter((i) => i.status === 'in_progress').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">임장 관리</h1>
          <p className="mt-1 text-sm text-gray-500">현장 임장 체크리스트를 관리하고 매물 상태를 점검합니다.</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          새 임장 시작
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">예정된 임장</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{scheduledCount}건</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">진행중</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">{inProgressCount}건</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">전체 임장</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{inspections.length}건</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setIsLoading(true); setStatusTab(t.key) }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              statusTab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Inspection List */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : inspections.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
          임장 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((ins) => (
            <div key={ins.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold">{ins.property_title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${inspectionStatusColor[ins.status]}`}>
                      {inspectionStatusLabel[ins.status]}
                    </span>
                    {ins.grade && (
                      <span className={`shrink-0 text-sm font-bold ${inspectionGradeColor[ins.grade]}`}>
                        {ins.grade}등급
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{ins.address}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {ins.scheduled_date && <span>예정일: {formatDate(ins.scheduled_date)}</span>}
                    {ins.completed_date && <span>완료일: {formatDate(ins.completed_date)}</span>}
                    {ins.status === 'completed' && (
                      <span>
                        점검항목: {ins.checklist.filter((c) => c.status !== null).length}/{ins.checklist.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {ins.status === 'scheduled' && (
                    <Link
                      to={`/admin/inspection/${ins.id}/checklist`}
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    >
                      점검 시작
                    </Link>
                  )}
                  {ins.status === 'in_progress' && (
                    <Link
                      to={`/admin/inspection/${ins.id}/checklist`}
                      className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600"
                    >
                      이어서 점검
                    </Link>
                  )}
                  {ins.status === 'completed' && (
                    <Link
                      to={`/admin/inspection/${ins.id}/report`}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      보고서
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Inspection Modal */}
      {showNewModal && (
        <NewInspectionModal
          onClose={() => setShowNewModal(false)}
          onCreate={(ins) => {
            setShowNewModal(false)
            toast.success('임장이 생성되었습니다.')
            navigate(`/admin/inspection/${ins.id}/checklist`)
          }}
        />
      )}
    </div>
  )
}

function NewInspectionModal({ onClose, onCreate }: { onClose: () => void; onCreate: (ins: Inspection) => void }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [manualTitle, setManualTitle] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchAdminProperties({ statusTab: 'all' }).then(setProperties).catch(() => setProperties([]))
  }, [])

  const filtered = search
    ? properties.filter((p) => p.title.includes(search) || p.address.includes(search))
    : properties.slice(0, 10)

  const handleCreate = async () => {
    const title = isManual ? manualTitle : selectedProperty?.title
    const address = isManual ? manualAddress : selectedProperty?.address
    if (!title || !address) {
      toast.error('매물 정보를 입력해주세요.')
      return
    }
    const ins = await createInspection({
      property_id: isManual ? null : selectedProperty?.id ?? null,
      property_title: title,
      address,
      scheduled_date: scheduledDate || null,
    })
    onCreate(ins)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">새 임장 시작</h2>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setIsManual(false)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${!isManual ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            매물 선택
          </button>
          <button
            onClick={() => setIsManual(true)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${isManual ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            직접 입력
          </button>
        </div>

        {!isManual ? (
          <div className="mt-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="매물 검색..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProperty(p)}
                  className={`w-full rounded-lg p-2 text-left text-xs transition-colors ${
                    selectedProperty?.id === p.id ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium">{p.title}</p>
                  <p className="text-gray-400">{p.address}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">매물명</label>
              <input
                type="text"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="예: 래미안 대치팰리스 102동 1502호"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">주소</label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="예: 서울 강남구 대치동 890-5"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs text-gray-400">예정일 (선택)</label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-200">
            취소
          </button>
          <button onClick={handleCreate} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
            임장 시작
          </button>
        </div>
      </div>
    </div>
  )
}
