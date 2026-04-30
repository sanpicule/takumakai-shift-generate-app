import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Staff } from '../types'
import clsx from 'clsx'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const DOW_SHORT = ['日', '月', '火', '水', '木', '金', '土']

function buildCalendar(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    days.push({ date: d, dow, isSun: dow === 0, isSat: dow === 6 })
  }
  return days
}

interface StaffCalendarProps {
  staff: Staff
  year: number
  month: number
  selectedDays: number[]
  onToggle: (day: number) => void
  label: string
  color: string
  readOnly?: boolean
}

function StaffCalendar({ staff, year, month, selectedDays, onToggle, label, color, readOnly = false }: StaffCalendarProps) {
  const days = buildCalendar(year, month)
  const firstDow = new Date(year, month - 1, 1).getDay()

  // カレンダーグリッドの空白セル
  const blanks = Array(firstDow).fill(null)

  return (
    <div className={clsx('bg-white rounded-2xl border shadow-sm overflow-hidden', readOnly ? 'border-slate-100 opacity-75' : 'border-slate-200')}>
      {/* ヘッダー */}
      <div className={clsx('px-4 py-3 flex items-center justify-between', readOnly ? 'bg-slate-400' : color)}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {staff.name.charAt(0)}
          </div>
          <div>
            <p className="text-white font-semibold">{staff.name}</p>
            <p className="text-white text-opacity-80 text-xs">{readOnly ? '閲覧のみ（編集不可）' : label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-medium">{selectedDays.length}日選択</p>
          {/* 読み取り専用時はクリアボタンを非表示 */}
          {!readOnly && selectedDays.length > 0 && (
            <button
              onClick={() => selectedDays.forEach((d) => onToggle(d))}
              className="text-white text-opacity-70 text-xs hover:text-opacity-100"
            >
              クリア
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {DOW_SHORT.map((d, i) => (
            <div
              key={d}
              className={clsx(
                'text-center text-xs font-medium py-1',
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-400'
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-1">
          {/* 空白 */}
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {/* 日付セル */}
          {days.map(({ date, dow, isSun, isSat }) => {
            const isSelected = selectedDays.includes(date)
            return (
              <button
                key={date}
                onClick={() => !readOnly && onToggle(date)}
                disabled={readOnly}
                className={clsx(
                  'aspect-square rounded-lg text-sm font-medium transition-all duration-100 flex items-center justify-center',
                  readOnly
                    ? isSelected
                      ? 'bg-slate-400 text-white cursor-default'
                      : isSun
                      ? 'bg-red-50 text-red-300 cursor-default'
                      : isSat
                      ? 'bg-blue-50 text-blue-300 cursor-default'
                      : 'bg-slate-50 text-slate-300 cursor-default'
                    : isSelected
                    ? 'bg-purple-500 text-white shadow-sm scale-95'
                    : isSun
                    ? 'bg-red-50 text-red-500 hover:bg-red-100'
                    : isSat
                    ? 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                )}
              >
                {date}
              </button>
            )
          })}
        </div>

        {/* 選択日一覧 */}
        {selectedDays.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedDays.sort((a, b) => a - b).map((d) => {
              const dow = new Date(year, month - 1, d).getDay()
              return (
                <span
                  key={d}
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    readOnly ? 'bg-slate-100 text-slate-400' : 'bg-purple-100 text-purple-700'
                  )}
                >
                  {d}日({DOW_LABELS[dow]})
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const STAFF_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-rose-500'
]

// 来月以降かどうかを判定する
function isFutureMonth(year: number, month: number): boolean {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  return year > currentYear || (year === currentYear && month > currentMonth)
}

export default function RequestPage() {
  const {
    staffList,
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    requests,
    partTimeWorkDays,
    toggleRequestDay,
    togglePartTimeDay
  } = useAppStore()

  // 来月以降は編集可
  const isEditable = isFutureMonth(selectedYear, selectedMonth)

  // 前月・翌月への移動（月をまたぐ場合は年も更新）
  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(selectedYear - 1, 12)
    } else {
      setSelectedMonth(selectedYear, selectedMonth - 1)
    }
  }
  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(selectedYear + 1, 1)
    } else {
      setSelectedMonth(selectedYear, selectedMonth + 1)
    }
  }

  const [activeTab, setActiveTab] = useState<'requests' | 'parttime'>('requests')

  // 希望休対象（常勤スタッフ）
  const regularStaff = staffList.filter((s) => !s.isPartTime)
  // 非常勤スタッフ
  const partTimeStaff = staffList.filter((s) => s.isPartTime)

  return (
    <div className="flex-1 overflow-auto p-6 fade-in">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">希望休・当直指定入力</h1>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={goToPrevMonth}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            >
              ◀
            </button>
            <span className="text-slate-700 font-medium text-sm">
              {selectedYear}年{selectedMonth}月
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            >
              ▶
            </button>
            {isEditable
              ? <span className="text-slate-400 text-sm">— カレンダーの日付をタップして選択します</span>
              : <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-medium">閲覧のみ（編集は来月以降）</span>
            }
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('requests')}
            className={clsx(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'requests'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            🗓 希望休（常勤スタッフ）
          </button>
          {partTimeStaff.length > 0 && (
            <button
              onClick={() => setActiveTab('parttime')}
              className={clsx(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'parttime'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              📋 当直指定（非常勤）
            </button>
          )}
        </div>

        {/* 希望休タブ */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {regularStaff.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p className="text-slate-400 text-sm">常勤スタッフが登録されていません</p>
              </div>
            ) : (
              regularStaff.map((staff, idx) => (
                <StaffCalendar
                  key={staff.id}
                  staff={staff}
                  year={selectedYear}
                  month={selectedMonth}
                  selectedDays={requests[staff.id] || []}
                  onToggle={(day) => toggleRequestDay(staff.id, day)}
                  label="希望休"
                  color={STAFF_COLORS[idx % STAFF_COLORS.length]}
                  readOnly={!isEditable}
                />
              ))
            )}
          </div>
        )}

        {/* 非常勤当直指定タブ */}
        {activeTab === 'parttime' && (
          <div className="space-y-4">
            {partTimeStaff.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <p className="text-slate-400 text-sm">
                  非常勤スタッフが登録されていません
                  <br />
                  スタッフ管理で「非常勤」タイプのスタッフを追加してください
                </p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 rounded-xl px-4 py-3 text-sm text-amber-700">
                  非常勤スタッフの当直日を指定します。選択した日が「当直（当）」に設定され、翌日が「明け（明）」になります。
                </div>
                {partTimeStaff.map((staff, idx) => (
                  <StaffCalendar
                    key={staff.id}
                    staff={staff}
                    year={selectedYear}
                    month={selectedMonth}
                    selectedDays={partTimeWorkDays[staff.id] || []}
                    onToggle={(day) => togglePartTimeDay(staff.id, day)}
                    label="当直指定日"
                    color={`bg-amber-${500 + idx * 100}`}
                    readOnly={!isEditable}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* 入力ヒント */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
          <p>
            💡 日付をタップで選択/解除できます。紫色になった日が選択済みです。
            シフト生成時、希望休は最優先で反映されます。
          </p>
        </div>
      </div>
    </div>
  )
}
