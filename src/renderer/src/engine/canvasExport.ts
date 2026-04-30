import type { ShiftResult, Staff, ShiftSymbol } from '../types'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// シフト記号ごとの色設定
const SYMBOL_COLORS: Record<ShiftSymbol, { bg: string; text: string }> = {
  '日': { bg: '#dbeafe', text: '#1e40af' },
  '当': { bg: '#fce7f3', text: '#9d174d' },
  '明': { bg: '#f1f5f9', text: '#64748b' },
  '休': { bg: '#dcfce7', text: '#15803d' },
  '希': { bg: '#dcfce7', text: '#15803d' },
  '代': { bg: '#fef9c3', text: '#a16207' },
  '':  { bg: '#f8fafc', text: '#cbd5e1' }
}

/**
 * シフト表を Canvas に描画して base64 PNG 文字列を返す
 * html2canvas 不使用・スクロール関係なし
 */
export function generateShiftImage(result: ShiftResult, staffList: Staff[]): string {
  const { shifts, dayInfos, summaries, daysInMonth } = result

  // レイアウト定数
  const scale   = 2      // 高解像度
  const pad     = 12
  const nameW   = 56
  const dayW    = 26
  const sumW    = 38
  const headH   = 40
  const rowH    = 26
  const sumCols = ['公休', '代休', '日勤', '当直', '日曜休', '最大連勤']
  const sumTextColors = ['#15803d', '#a16207', '#1d4ed8', '#9d174d', '#475569', '#475569']

  const totalW = pad * 2 + nameW + daysInMonth * dayW + sumCols.length * sumW
  const totalH = pad * 2 + headH + (staffList.length + 2) * rowH

  const canvas = document.createElement('canvas')
  canvas.width  = totalW * scale
  canvas.height = totalH * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // 背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalW, totalH)

  // ─── ヘッダー行 ───────────────────────────────────────
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(pad, pad, totalW - pad * 2, headH)

  // 「スタッフ」ラベル
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('スタッフ', pad + nameW / 2, pad + headH / 2)

  // 日付・曜日
  for (const di of dayInfos) {
    const x = pad + nameW + (di.date - 1) * dayW
    if (di.isSunday) {
      ctx.fillStyle = 'rgba(185,28,28,0.35)'
      ctx.fillRect(x, pad, dayW, headH)
    } else if (di.isSaturday) {
      ctx.fillStyle = 'rgba(29,78,216,0.35)'
      ctx.fillRect(x, pad, dayW, headH)
    }
    ctx.fillStyle = di.isSunday ? '#fca5a5' : di.isSaturday ? '#93c5fd' : '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(di.date), x + dayW / 2, pad + headH / 2 - 6)
    ctx.font = '8px sans-serif'
    ctx.fillText(DOW_LABELS[di.dayOfWeek], x + dayW / 2, pad + headH / 2 + 8)
  }

  // サマリーヘッダー
  for (let i = 0; i < sumCols.length; i++) {
    const x = pad + nameW + daysInMonth * dayW + i * sumW
    ctx.fillStyle = '#ffffff'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(sumCols[i], x + sumW / 2, pad + headH / 2)
  }

  // ─── スタッフ行 ────────────────────────────────────────
  for (let si = 0; si < staffList.length; si++) {
    const staff = staffList[si]
    const summary = summaries.find((s) => s.staffId === staff.id)
    const y = pad + headH + si * rowH

    // 行背景
    ctx.fillStyle = si % 2 === 0 ? '#ffffff' : '#f8fafc'
    ctx.fillRect(pad, y, totalW - pad * 2, rowH)

    // 区切り線
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(pad, y + rowH)
    ctx.lineTo(totalW - pad, y + rowH)
    ctx.stroke()

    // スタッフ名
    ctx.fillStyle = '#334155'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(staff.name, pad + 4, y + rowH / 2)

    // シフトセル
    for (const di of dayInfos) {
      const sym = shifts[staff.id]?.[di.date] ?? ''
      const display = sym === '希' ? '休' : sym
      const x = pad + nameW + (di.date - 1) * dayW
      const color = SYMBOL_COLORS[sym] ?? SYMBOL_COLORS['']
      const cp = 2

      // 空欄でも土日は薄く色を付ける
      if (!sym && di.isSunday) {
        ctx.fillStyle = '#fff1f2'
        ctx.fillRect(x + cp, y + cp, dayW - cp * 2, rowH - cp * 2)
      } else if (!sym && di.isSaturday) {
        ctx.fillStyle = '#eff6ff'
        ctx.fillRect(x + cp, y + cp, dayW - cp * 2, rowH - cp * 2)
      } else if (sym) {
        ctx.fillStyle = color.bg
        ctx.fillRect(x + cp, y + cp, dayW - cp * 2, rowH - cp * 2)
      }

      if (display) {
        ctx.fillStyle = color.text
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(display, x + dayW / 2, y + rowH / 2)
      }
    }

    // サマリー列
    const sumValues = summary ? [
      summary.holidayCount,
      summary.compDayCount,
      summary.dayShiftCount,
      summary.nightShiftCount,
      summary.sundayRestCount,
      summary.maxConsecutiveDays
    ] : []
    for (let i = 0; i < sumValues.length; i++) {
      const x = pad + nameW + daysInMonth * dayW + i * sumW
      ctx.fillStyle = sumTextColors[i]
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(sumValues[i] ?? ''), x + sumW / 2, y + rowH / 2)
    }
  }

  // ─── フッター: 日勤人数 ────────────────────────────────
  const dayShiftStaff = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )
  const f1y = pad + headH + staffList.length * rowH
  ctx.fillStyle = '#eff6ff'
  ctx.fillRect(pad, f1y, totalW - pad * 2, rowH)
  ctx.strokeStyle = '#bfdbfe'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, f1y); ctx.lineTo(totalW - pad, f1y); ctx.stroke()
  ctx.fillStyle = '#1d4ed8'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('日勤人数', pad + 4, f1y + rowH / 2)
  for (const di of dayInfos) {
    const count = dayShiftStaff.filter((s) => shifts[s.id]?.[di.date] === '日').length
    const required = di.isSunday ? 1 : 2
    const x = pad + nameW + (di.date - 1) * dayW
    if (count < required) {
      ctx.fillStyle = '#fef2f2'
      ctx.fillRect(x + 2, f1y + 2, dayW - 4, rowH - 4)
    }
    ctx.fillStyle = count >= required ? '#1d4ed8' : '#ef4444'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(count), x + dayW / 2, f1y + rowH / 2)
  }

  // ─── フッター: 当直担当 ────────────────────────────────
  const nightCandidates = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )
  const f2y = f1y + rowH
  ctx.fillStyle = '#fdf2f8'
  ctx.fillRect(pad, f2y, totalW - pad * 2, rowH)
  ctx.strokeStyle = '#fbcfe8'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, f2y); ctx.lineTo(totalW - pad, f2y); ctx.stroke()
  ctx.fillStyle = '#9d174d'
  ctx.font = 'bold 10px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('当直担当', pad + 4, f2y + rowH / 2)
  for (const di of dayInfos) {
    const onCall = nightCandidates.find((s) => shifts[s.id]?.[di.date] === '当')
    const x = pad + nameW + (di.date - 1) * dayW
    if (!onCall) {
      ctx.fillStyle = '#fef2f2'
      ctx.fillRect(x + 2, f2y + 2, dayW - 4, rowH - 4)
    }
    ctx.fillStyle = onCall ? '#9d174d' : '#ef4444'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(onCall ? onCall.name : '!', x + dayW / 2, f2y + rowH / 2)
  }

  // 外枠
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(pad, pad, totalW - pad * 2, totalH - pad * 2)

  return canvas.toDataURL('image/png')
}
