import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { generateCSV, generateMarkdownTable } from '../engine/generator'
import type { ShiftSymbol } from '../types'
import clsx from 'clsx'

// シフト記号 → 表示スタイル
function shiftCellClass(symbol: ShiftSymbol, isSunday: boolean, isSaturday: boolean): string {
  const base = 'text-center text-xs font-semibold py-1.5 px-0.5 rounded min-w-[28px]'
  if (symbol === '日') return clsx(base, 'bg-blue-100 text-blue-800')
  if (symbol === '当') return clsx(base, 'bg-pink-100 text-pink-800')
  if (symbol === '明') return clsx(base, 'bg-slate-100 text-slate-500')
  if (symbol === '休') return clsx(base, 'bg-green-100 text-green-700')
  if (symbol === '代') return clsx(base, 'bg-yellow-100 text-yellow-700')
  if (symbol === '希') return clsx(base, 'bg-purple-100 text-purple-700')
  if (symbol === '') {
    if (isSunday) return clsx(base, 'bg-red-50 text-red-200')
    if (isSaturday) return clsx(base, 'bg-blue-50 text-blue-200')
    return clsx(base, 'bg-white text-slate-200 border border-slate-100')
  }
  return clsx(base, 'bg-white text-slate-400')
}

function shiftDisplayText(symbol: ShiftSymbol): string {
  return symbol === '' ? '―' : symbol
}

const LEGEND = [
  { symbol: '日', label: '日勤', color: 'bg-blue-100 text-blue-800' },
  { symbol: '当', label: '当直', color: 'bg-pink-100 text-pink-800' },
  { symbol: '明', label: '明け', color: 'bg-slate-100 text-slate-500' },
  { symbol: '休', label: '公休', color: 'bg-green-100 text-green-700' },
  { symbol: '代', label: '代休', color: 'bg-yellow-100 text-yellow-700' },
  { symbol: '希', label: '希望休', color: 'bg-purple-100 text-purple-700' },
  { symbol: '―', label: '空欄', color: 'bg-white text-slate-300 border border-slate-100' }
] as const

export default function ResultPage() {
  const navigate = useNavigate()
  const { shiftResult, staffList } = useAppStore()
  const [copyMsg, setCopyMsg] = useState('')

  if (!shiftResult) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-5xl">📊</p>
          <p className="text-xl font-semibold text-slate-600">シフトがまだ生成されていません</p>
          <p className="text-slate-400 text-sm">「シフト生成」画面から生成してください</p>
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

  const { shifts, dayInfos, summaries, violations, daysInMonth, year, month } = shiftResult

  const warningViolations = violations.filter((v) => v.type === 'warning')
  const infoViolations = violations.filter((v) => v.type === 'info')

  // CSV保存
  async function handleSaveCSV() {
    const csv = generateCSV(shiftResult!, staffList)
    const filename = `シフト_${year}年${month}月.csv`
    try {
      const result = await window.api.saveCsv(csv, filename)
      if (result.success) {
        setCopyMsg('CSVを保存しました')
      } else {
        setCopyMsg('保存がキャンセルされました')
      }
    } catch {
      // Electronのapiが使えない場合はダウンロード
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setCopyMsg('CSVをダウンロードしました')
    }
    setTimeout(() => setCopyMsg(''), 3000)
  }

  // マークダウンをクリップボードにコピー
  async function handleCopyMarkdown() {
    const md = generateMarkdownTable(shiftResult!, staffList)
    await navigator.clipboard.writeText(md)
    setCopyMsg('マークダウンをコピーしました')
    setTimeout(() => setCopyMsg(''), 3000)
  }

  // TSVをクリップボードにコピー（Googleスプレッドシートに貼り付けやすい形式）
  async function handleCopyTSV() {
    const csv = generateCSV(shiftResult!, staffList)
    const tsv = csv.split('\n').map(row => row.split(',').join('\t')).join('\n')
    await navigator.clipboard.writeText(tsv)
    setCopyMsg('スプレッドシート用データをコピーしました（貼り付けるだけでOK）')
    setTimeout(() => setCopyMsg(''), 4000)
  }

  // フッター行（日勤人数合計・当直担当者）
  const dayShiftStaff = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )
  const nightStaff = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* 上部ツールバー */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {year}年{month}月 シフト表
          </h1>
          <p className="text-xs text-slate-400">
            {daysInMonth}日間 ／ {staffList.length}名
            {violations.length > 0 && (
              <span className="ml-2 text-amber-600">
                ⚠ {warningViolations.length}件の注意あり
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {copyMsg && (
            <span className="bg-green-100 text-green-700 text-xs px-3 py-1.5 rounded-full font-medium animate-pulse">
              ✓ {copyMsg}
            </span>
          )}
          <button
            onClick={handleCopyTSV}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
            title="スプレッドシートに貼り付け可能な形式でコピー"
          >
            📋 スプレッドシートにコピー
          </button>
          <button
            onClick={handleSaveCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
          >
            💾 CSV保存
          </button>
          <button
            onClick={handleCopyMarkdown}
            className="bg-slate-600 hover:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
          >
            📄 MD形式コピー
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-3 py-2 rounded-lg font-medium transition-colors"
          >
            再生成
          </button>
        </div>
      </div>

      {/* 制約違反・注意事項 */}
      {violations.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2 flex-shrink-0">
          <div className="flex items-start gap-2 text-xs text-amber-700 max-h-16 overflow-auto">
            <span className="flex-shrink-0 font-medium mt-0.5">⚠ 制約レポート:</span>
            <div className="space-y-0.5">
              {violations.map((v, i) => (
                <p key={i}>
                  [{v.rule}] {v.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* シフトテーブル（横スクロール） */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 min-w-max">
          <table className="border-collapse text-xs bg-white rounded-xl shadow-sm overflow-hidden">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="sticky left-0 z-10 bg-slate-800 px-3 py-2.5 text-left font-semibold min-w-[72px] border-r border-slate-600">
                  スタッフ
                </th>
                {dayInfos.map((d) => (
                  <th
                    key={d.date}
                    className={clsx(
                      'px-1 py-2 text-center font-medium min-w-[28px] text-[11px]',
                      d.isSunday
                        ? 'text-red-300 bg-red-900 bg-opacity-30'
                        : d.isSaturday
                        ? 'text-blue-300 bg-blue-900 bg-opacity-30'
                        : ''
                    )}
                  >
                    <div>{d.date}</div>
                    <div className="text-[9px] opacity-70">{d.label.split('(')[1]?.replace(')', '')}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium border-l border-slate-600 min-w-[36px] text-[11px]">公休</th>
                <th className="px-2 py-2 text-center font-medium min-w-[36px] text-[11px]">代休</th>
                <th className="px-2 py-2 text-center font-medium min-w-[36px] text-[11px]">日勤</th>
                <th className="px-2 py-2 text-center font-medium min-w-[36px] text-[11px]">当直</th>
                <th className="px-2 py-2 text-center font-medium min-w-[40px] text-[11px]">日曜休</th>
                <th className="px-2 py-2 text-center font-medium min-w-[40px] text-[11px]">最大連勤</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((staff, staffIdx) => {
                const summary = summaries.find((s) => s.staffId === staff.id)
                return (
                  <tr
                    key={staff.id}
                    className={clsx(
                      'border-b border-slate-100',
                      staffIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    )}
                  >
                    {/* スタッフ名（固定列） */}
                    <td
                      className={clsx(
                        'sticky left-0 z-10 px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-200 text-sm',
                        staffIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      )}
                    >
                      {staff.name}
                    </td>

                    {/* シフトセル */}
                    {dayInfos.map((d) => {
                      const symbol = shifts[staff.id]?.[d.date] ?? ''
                      return (
                        <td key={d.date} className="px-0.5 py-1">
                          <div className={shiftCellClass(symbol, d.isSunday, d.isSaturday)}>
                            {shiftDisplayText(symbol)}
                          </div>
                        </td>
                      )
                    })}

                    {/* 集計列 */}
                    <td className="px-2 py-1 text-center border-l border-slate-200 font-bold text-green-700">
                      {summary?.holidayCount ?? ''}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-yellow-600">
                      {summary?.compDayCount ?? ''}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-blue-700">
                      {summary?.dayShiftCount ?? ''}
                    </td>
                    <td className="px-2 py-1 text-center font-bold text-pink-700">
                      {summary?.nightShiftCount ?? ''}
                    </td>
                    <td className="px-2 py-1 text-center text-slate-500">
                      {summary?.sundayRestCount ?? ''}
                    </td>
                    <td className="px-2 py-1 text-center text-slate-500">
                      {summary?.maxConsecutiveDays ?? ''}
                    </td>
                  </tr>
                )
              })}

              {/* フッター: 日勤人数 */}
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td className="sticky left-0 z-10 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 border-r border-blue-200 text-xs">
                  日勤人数
                </td>
                {dayInfos.map((d) => {
                  const count = dayShiftStaff.filter((s) => shifts[s.id]?.[d.date] === '日').length
                  const required = d.isSunday ? 1 : 2
                  return (
                    <td key={d.date} className="px-0.5 py-1">
                      <div
                        className={clsx(
                          'text-center text-xs font-bold py-1 rounded',
                          count >= required
                            ? 'text-blue-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {count}
                      </div>
                    </td>
                  )
                })}
                <td colSpan={6} />
              </tr>

              {/* フッター: 当直担当 */}
              <tr className="bg-pink-50 border-t border-pink-200">
                <td className="sticky left-0 z-10 bg-pink-50 px-3 py-1.5 font-semibold text-pink-700 border-r border-pink-200 text-xs">
                  当直担当
                </td>
                {dayInfos.map((d) => {
                  const onCallStaff = nightStaff.find((s) => shifts[s.id]?.[d.date] === '当')
                  return (
                    <td key={d.date} className="px-0.5 py-1">
                      <div
                        className={clsx(
                          'text-center text-xs font-bold py-1 rounded',
                          onCallStaff ? 'text-pink-700' : 'bg-red-100 text-red-700'
                        )}
                      >
                        {onCallStaff ? onCallStaff.name : '!'}
                      </div>
                    </td>
                  )
                })}
                <td colSpan={6} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 凡例フッター */}
      <div className="bg-white border-t border-slate-200 px-5 py-2 flex items-center gap-4 flex-shrink-0">
        <span className="text-xs text-slate-500 font-medium">凡例:</span>
        <div className="flex gap-2 flex-wrap">
          {LEGEND.map(({ symbol, label, color }) => (
            <div key={symbol} className="flex items-center gap-1">
              <span className={clsx('text-xs px-1.5 py-0.5 rounded font-semibold', color)}>
                {symbol}
              </span>
              <span className="text-xs text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
