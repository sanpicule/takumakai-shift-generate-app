import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import type { SavedShift } from '../types'

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 年月ごとにグループ化
function groupByYearMonth(shifts: SavedShift[]): Map<string, SavedShift[]> {
  const map = new Map<string, SavedShift[]>()
  for (const s of shifts) {
    const key = `${s.year}-${String(s.month).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  return map
}

export default function SavedShiftsPage() {
  const navigate = useNavigate()
  const { savedShifts, deleteSavedShift, loadSavedShift } = useAppStore()
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())

  const sorted = [...savedShifts].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    if (a.month !== b.month) return b.month - a.month
    return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  })

  const grouped = groupByYearMonth(sorted)
  const folderKeys = [...grouped.keys()]

  function toggleFolder(key: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleView(saved: SavedShift) {
    loadSavedShift(saved)
    navigate('/result')
  }

  function handleDelete(saved: SavedShift) {
    if (window.confirm(`${saved.year}年${saved.month}月のシフト（保存: ${formatSavedAt(saved.savedAt)}）を削除しますか？`)) {
      deleteSavedShift(saved.id)
    }
  }

  if (savedShifts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-5xl">🗂</p>
          <p className="text-xl font-semibold text-slate-600">保存済みシフトはありません</p>
          <p className="text-slate-400 text-sm">シフト結果画面の「シフトを保存」ボタンで保存できます</p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            シフト生成へ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ページタイトル */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">保存したシフト</h1>
          <p className="text-slate-500 text-sm mt-1">
            {savedShifts.length}件 保存済み ／ 月ごとにまとめて表示しています
          </p>
        </div>

        {/* フォルダ一覧 */}
        <div className="space-y-2">
          {folderKeys.map((key) => {
            const items = grouped.get(key)!
            const [year, month] = key.split('-')
            const isOpen = openFolders.has(key)

            return (
              <div key={key} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* フォルダヘッダー（クリックで開閉） */}
                <button
                  onClick={() => toggleFolder(key)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xl">{isOpen ? '📂' : '📁'}</span>
                  <span className="font-bold text-slate-800 text-base">
                    {Number(year)}年{Number(month)}月
                  </span>
                  <span className="ml-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                    {items.length}件
                  </span>
                  <span className="ml-auto text-slate-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* フォルダ内容 */}
                {isOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {items.map((saved) => {
                      const warnCount = saved.shiftResult.violations.filter((v) => v.type === 'warning').length
                      return (
                        <div key={saved.id} className="flex items-center gap-3 pl-12 pr-4 py-3 hover:bg-slate-50 group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">
                                保存日時: {formatSavedAt(saved.savedAt)}
                              </span>
                              {warnCount > 0 && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                  ⚠ {warnCount}件
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {saved.staffList.length}名
                            </p>
                          </div>
                          <button
                            onClick={() => handleView(saved)}
                            className="text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                          >
                            表示
                          </button>
                          <button
                            onClick={() => handleDelete(saved)}
                            className="text-sm text-slate-400 hover:text-red-500 px-2 py-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="削除"
                          >
                            🗑
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
