import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { generateShift } from '../engine/generator'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i)

export default function HomePage() {
  const navigate = useNavigate()
  const {
    selectedYear,
    selectedMonth,
    setSelectedMonth,
    staffList,
    requests,
    partTimeWorkDays,
    prevMonthInfo,
    setPrevMonthInfo,
    setShiftResult
  } = useAppStore()

  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const nightStaff = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  const totalRequests = Object.values(requests).reduce((sum, days) => sum + days.length, 0)
  const partTimeStaff = staffList.filter((s) => s.isPartTime)

  function handleGenerate() {
    setIsGenerating(true)
    setError('')

    try {
      const result = generateShift({
        year: selectedYear,
        month: selectedMonth,
        staffList,
        requests,
        partTimeWorkDays,
        prevMonthInfo
      })
      setShiftResult(result)
      navigate('/result')
    } catch (e) {
      setError('シフト生成中にエラーが発生しました: ' + String(e))
    } finally {
      setIsGenerating(false)
    }
  }

  // カレンダー情報
  const satCount = Array.from({ length: daysInMonth }, (_, i) => {
    return new Date(selectedYear, selectedMonth - 1, i + 1).getDay() === 6 ? 1 : 0
  }).reduce((a, b) => a + b, 0)
  const sunCount = Array.from({ length: daysInMonth }, (_, i) => {
    return new Date(selectedYear, selectedMonth - 1, i + 1).getDay() === 0 ? 1 : 0
  }).reduce((a, b) => a + b, 0)

  return (
    <div className="flex-1 overflow-auto p-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ページタイトル */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">シフト生成</h1>
          <p className="text-slate-500 text-sm mt-1">対象月と前月情報を入力してシフトを生成します</p>
        </div>

        {/* STEP 1: 対象月 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 px-5 py-3 flex items-center gap-2">
            <span className="bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
            <h2 className="text-white font-semibold">対象月を選択</h2>
          </div>
          <div className="p-5">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">年</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedMonth(Number(e.target.value), selectedMonth)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-1.5">月</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(selectedYear, Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}月</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200">
                <p className="text-xs text-slate-500">カレンダー情報</p>
                <p className="text-sm font-medium text-slate-700 mt-0.5">
                  {daysInMonth}日間 / 土{satCount}日・日{sunCount}日
                </p>
                <p className="text-xs text-blue-600 font-medium">公休基準: {satCount + sunCount}日</p>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: 前月情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-600 px-5 py-3 flex items-center gap-2">
            <span className="bg-white text-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
            <h2 className="text-white font-semibold">前月情報（任意）</h2>
          </div>
          <div className="p-5 space-y-4">
            {/* 前月最終当直者 */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">
                前月最終日（月末）の当直者
                <span className="ml-1 text-slate-400 font-normal text-xs">→ 1日目が「明け」になります</span>
              </label>
              <select
                value={prevMonthInfo.lastOnCallStaffId}
                onChange={(e) => setPrevMonthInfo({ lastOnCallStaffId: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">なし（または不明）</option>
                {nightStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 持ち越し代休 */}
            {staffList.filter((s) => !s.isPartTime).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  前月からの持ち越し代休
                  <span className="ml-1 text-slate-400 font-normal text-xs">（0の場合は入力不要）</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {staffList.filter((s) => !s.isPartTime).map((s) => (
                    <div key={s.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-slate-700 w-8">{s.name}</span>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={prevMonthInfo.carryOverCompDays[s.id] || 0}
                        onChange={(e) =>
                          setPrevMonthInfo({
                            carryOverCompDays: {
                              ...prevMonthInfo.carryOverCompDays,
                              [s.id]: Number(e.target.value)
                            }
                          })
                        }
                        className="w-14 border border-slate-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <span className="text-xs text-slate-500">日</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 現在の入力状況サマリー */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">入力状況</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-slate-50 rounded-xl py-3">
              <p className="text-2xl font-bold text-slate-800">{staffList.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">スタッフ数</p>
              <button
                onClick={() => navigate('/staff')}
                className="text-xs text-blue-500 mt-1 hover:underline"
              >
                編集
              </button>
            </div>
            <div className="text-center bg-slate-50 rounded-xl py-3">
              <p className="text-2xl font-bold text-slate-800">{totalRequests}</p>
              <p className="text-xs text-slate-500 mt-0.5">希望休（件数）</p>
              <button
                onClick={() => navigate('/requests')}
                className="text-xs text-blue-500 mt-1 hover:underline"
              >
                編集
              </button>
            </div>
            <div className="text-center bg-slate-50 rounded-xl py-3">
              <p className="text-2xl font-bold text-slate-800">
                {partTimeStaff.reduce(
                  (sum, s) => sum + (partTimeWorkDays[s.id]?.length || 0),
                  0
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">非常勤指定日</p>
              <button
                onClick={() => navigate('/requests')}
                className="text-xs text-blue-500 mt-1 hover:underline"
              >
                編集
              </button>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 生成ボタン */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || staffList.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-2xl text-lg transition-all duration-150 shadow-md hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span> 生成中...
            </span>
          ) : (
            `${selectedYear}年${selectedMonth}月のシフトを生成`
          )}
        </button>

        {staffList.length === 0 && (
          <p className="text-center text-sm text-red-500">
            スタッフが登録されていません。まず「スタッフ管理」でスタッフを追加してください。
          </p>
        )}
      </div>
    </div>
  )
}
