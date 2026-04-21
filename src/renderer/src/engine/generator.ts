import type {
  Staff,
  ShiftSymbol,
  MonthlyShifts,
  DayInfo,
  ShiftInput,
  ShiftResult,
  StaffSummary,
  ConstraintViolation
} from '../types'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// カレンダー情報を構築
function buildDayInfos(year: number, month: number): DayInfo[] {
  const days: DayInfo[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    days.push({
      date: d,
      dayOfWeek: dow,
      isSunday: dow === 0,
      isSaturday: dow === 6,
      label: `${d}(${DOW_LABELS[dow]})`
    })
  }
  return days
}

// スタッフのその日前後の連勤数を計算（明けは勤務日に含めない）
function getConsecutiveWorkDays(shifts: MonthlyShifts, staffId: string, day: number): number {
  const arr = shifts[staffId]
  const n = arr.length - 1

  // 前方
  let before = 0
  for (let d = day - 1; d >= 1; d--) {
    const s = arr[d]
    if (s === '日' || s === '当') before++
    else break
  }

  // 後方
  let after = 0
  for (let d = day + 1; d <= n; d++) {
    const s = arr[d]
    if (s === '日' || s === '当') after++
    else break
  }

  return before + 1 + after
}

// その日に勤務可能かどうかチェック（連勤制約）
function canWork(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff,
  daysInMonth: number
): boolean {
  const arr = shifts[staffId]
  const current = arr[day]

  // 固定済みセルは変更不可
  if (current !== '') return false

  // 前日が当直なら今日は明け（勤務不可）
  if (day >= 2 && arr[day - 1] === '当') return false

  // 連勤チェック
  const maxConsecutive = staff.allowExtendedNight ? 999 : 4
  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  if (consecutive >= maxConsecutive) return false

  // 翌日が希望休の場合、今日当直にすると翌日が明けになり希望が崩れる
  // → 当直割り当て時に呼び出し元で判断（ここでは日勤のみ）
  void daysInMonth
  void getConsecutiveWorkDays

  return true
}

// 当直をその日に入れられるか（当直専用チェック）
function canDoNightShift(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff,
  daysInMonth: number
): boolean {
  const arr = shifts[staffId]

  // 固定済みセルは不可
  if (arr[day] !== '') return false

  // 前日が当直なら今日は明けなので不可
  if (day >= 2 && arr[day - 1] === '当') return false

  // 今日当直にすると翌日が明けになる → 翌日が希望休でも明けに上書きしない方針
  // → 当直後の翌日が希望休の場合は当直不可とする
  if (day + 1 <= daysInMonth && arr[day + 1] === '希') return false

  // 連勤チェック（Bのみ6連勤パターン許可）
  if (staff.allowExtendedNight) {
    // B: 当→明→当→明→当→明 パターン（実質3回の当直で6連勤）
    // 前方に「当・明」交互パターンが続いている場合のみ許可
    // 通常の連勤上限なし（当直専従のため）
    return true
  }

  // その他: 4連勤以内
  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  return consecutive < 4
}

// 日勤をその日に入れられるかチェック
function canDoDayShift(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff
): boolean {
  const arr = shifts[staffId]

  // 固定済みセルは不可
  if (arr[day] !== '') return false

  // 前日が当直なら今日は明けなので不可
  if (day >= 2 && arr[day - 1] === '当') return false

  // 非常勤・当直専従は日勤不可
  if (staff.workType === '当直専従' || staff.isPartTime) return false

  // 4連勤以内
  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  return consecutive < 4
}

// スタッフの最近の当直回数を返す（直近N日）
function recentNightCount(
  shifts: MonthlyShifts,
  staffId: string,
  upToDay: number,
  window = 7
): number {
  const arr = shifts[staffId]
  let count = 0
  for (let d = Math.max(1, upToDay - window); d < upToDay; d++) {
    if (arr[d] === '当') count++
  }
  return count
}

// メインのシフト生成関数
export function generateShift(input: ShiftInput): ShiftResult {
  const { year, month, staffList, requests, partTimeWorkDays, prevMonthInfo } = input
  const dayInfos = buildDayInfos(year, month)
  const daysInMonth = dayInfos.length
  const violations: ConstraintViolation[] = []

  // シフトグリッド初期化（index 0 は未使用、1〜daysInMonth）
  const shifts: MonthlyShifts = {}
  for (const staff of staffList) {
    shifts[staff.id] = new Array(daysInMonth + 1).fill('') as ShiftSymbol[]
  }

  // ===== STEP 1: 固定制約を適用 =====

  // 前月最終当直者 → 1日目を「明」に
  if (prevMonthInfo.lastOnCallStaffId && shifts[prevMonthInfo.lastOnCallStaffId]) {
    shifts[prevMonthInfo.lastOnCallStaffId][1] = '明'
  }

  // 希望休を「希」で固定（R14 最優先）
  for (const [staffId, days] of Object.entries(requests)) {
    if (!shifts[staffId]) continue
    for (const d of days) {
      if (d >= 1 && d <= daysInMonth) {
        shifts[staffId][d] = '希'
      }
    }
  }

  // 非常勤スタッフの指定当直日を設定
  for (const [staffId, days] of Object.entries(partTimeWorkDays)) {
    if (!shifts[staffId]) continue
    for (const d of days) {
      if (d >= 1 && d <= daysInMonth) {
        if (shifts[staffId][d] === '' || shifts[staffId][d] === '希') {
          shifts[staffId][d] = '当'
          if (d + 1 <= daysInMonth && shifts[staffId][d + 1] === '') {
            shifts[staffId][d + 1] = '明'
          }
        }
      }
    }
  }

  // ===== STEP 2: 毎日の当直を割り当て（R4: 毎日1名） =====
  const nightCandidates = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )

  for (let d = 1; d <= daysInMonth; d++) {
    // 当直がすでに入っているか確認
    const alreadyHasNight = nightCandidates.some((s) => shifts[s.id][d] === '当')
    if (alreadyHasNight) continue

    // 候補をスコアリングして最適な人を選ぶ
    // スコアが低いほど優先（最近当直が少ない人を優先）
    const candidates = nightCandidates
      .filter((s) => canDoNightShift(shifts, s.id, d, s, daysInMonth))
      .map((s) => ({
        staff: s,
        score: recentNightCount(shifts, s.id, d, 14) * 10 + (s.isPartTime ? 100 : 0)
      }))
      .sort((a, b) => a.score - b.score)

    if (candidates.length === 0) {
      violations.push({
        type: 'warning',
        rule: 'R4',
        message: `${dayInfos[d - 1].label}: 当直担当者が確保できませんでした（人員不足）`
      })
      continue
    }

    const chosen = candidates[0].staff
    shifts[chosen.id][d] = '当'
    // 翌日を明けに
    if (d + 1 <= daysInMonth && shifts[chosen.id][d + 1] === '') {
      shifts[chosen.id][d + 1] = '明'
    }
  }

  // ===== STEP 3: 毎日の日勤を割り当て（R2: 平日・土=2名, R3: 日=1名） =====
  const dayShiftCandidates = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )

  for (let d = 1; d <= daysInMonth; d++) {
    const dayInfo = dayInfos[d - 1]
    const requiredCount = dayInfo.isSunday ? 1 : 2

    const currentDayCount = dayShiftCandidates.filter((s) => shifts[s.id][d] === '日').length
    if (currentDayCount >= requiredCount) continue

    // 優先度: 日勤専従（A）> 日当両方で当直が少ない人
    const candidates = dayShiftCandidates
      .filter((s) => canDoDayShift(shifts, s.id, d, s))
      .filter((s) => {
        // 今日すでに当直になっている人は除外
        return shifts[s.id][d] !== '当'
      })
      .map((s) => ({
        staff: s,
        score:
          (s.workType === '日勤専従' ? 0 : 100) +
          recentNightCount(shifts, s.id, d, 14) * 5
      }))
      .sort((a, b) => a.score - b.score)

    let assigned = currentDayCount
    for (const { staff } of candidates) {
      if (assigned >= requiredCount) break
      if (shifts[staff.id][d] === '') {
        shifts[staff.id][d] = '日'
        assigned++
      }
    }

    if (assigned < requiredCount) {
      violations.push({
        type: 'warning',
        rule: dayInfo.isSunday ? 'R3' : 'R2',
        message: `${dayInfo.label}: 日勤が${assigned}名しか確保できませんでした（必要: ${requiredCount}名）`
      })
    }
  }

  // ===== STEP 4: 明けの再確認（当直翌日が空欄なら明けに R5） =====
  for (const staff of staffList) {
    for (let d = 1; d < daysInMonth; d++) {
      if (shifts[staff.id][d] === '当' && shifts[staff.id][d + 1] === '') {
        shifts[staff.id][d + 1] = '明'
      }
    }
  }

  // ===== STEP 5: 代休の計算と付与（R11） =====
  // 土曜当直・日曜当直・日曜日勤に1日ずつ代休付与
  const compDaysToAssign: Record<string, number> = {}
  for (const staff of staffList) {
    if (staff.isPartTime) continue
    let comp = prevMonthInfo.carryOverCompDays[staff.id] || 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dayInfo = dayInfos[d - 1]
      const s = shifts[staff.id][d]
      if (dayInfo.isSaturday && s === '当') comp++
      if (dayInfo.isSunday && (s === '当' || s === '日')) comp++
    }
    compDaysToAssign[staff.id] = comp
  }

  // ===== STEP 6: 公休数の確保と空きセルへの休み付与（R13） =====
  const satCount = dayInfos.filter((d) => d.isSaturday).length
  const sunCount = dayInfos.filter((d) => d.isSunday).length
  const baseHolidays = satCount + sunCount

  for (const staff of staffList) {
    if (staff.isPartTime) continue

    // 代休を付与（空きセルに埋める）
    let compLeft = compDaysToAssign[staff.id] || 0
    // 理想的には当→明の翌日（R8サイクル）に配置
    for (let d = 1; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        const prevDay = d >= 2 ? shifts[staff.id][d - 1] : ''
        if (prevDay === '明') {
          shifts[staff.id][d] = '代'
          compLeft--
        }
      }
    }
    // 残りの代休は空きセルに順次配置
    for (let d = 1; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        shifts[staff.id][d] = '代'
        compLeft--
      }
    }

    // 公休を付与（希望休は公休から消費するため、希望休分を差し引いた残りを埋める）
    const targetHolidays = baseHolidays
    const currentRestAfterComp = shifts[staff.id].filter((s) => s === '休' || s === '希').length

    let restLeft = Math.max(0, targetHolidays - currentRestAfterComp)

    // 月1連休確保（R9）: 既存の明けの翌日、または土日周辺に連休を作る試み
    let hadConsecutiveRest = false
    for (let d = 2; d <= daysInMonth; d++) {
      if (
        (shifts[staff.id][d - 1] === '休' || shifts[staff.id][d - 1] === '代') &&
        shifts[staff.id][d] === ''
      ) {
        hadConsecutiveRest = true
        break
      }
    }

    // 空きセルに休みを付与（土日優先）
    const sundayIndices = dayInfos
      .filter((d) => d.isSunday)
      .map((d) => d.date)
    const saturdayIndices = dayInfos
      .filter((d) => d.isSaturday)
      .map((d) => d.date)

    // 土日の空きに休みを配置
    for (const d of [...sundayIndices, ...saturdayIndices]) {
      if (restLeft <= 0) break
      if (shifts[staff.id][d] === '') {
        shifts[staff.id][d] = '休'
        restLeft--
      }
    }

    // まだ足りなければ平日の空きに
    for (let d = 1; d <= daysInMonth && restLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        shifts[staff.id][d] = '休'
        restLeft--
      }
    }

    // 公休超過チェック
    const finalHolidays = shifts[staff.id].filter((s) => s === '休' || s === '希').length
    if (finalHolidays > baseHolidays) {
      violations.push({
        type: 'info',
        rule: 'R13',
        message: `${staff.name}: 公休数が${finalHolidays}日（基準${baseHolidays}日、+${finalHolidays - baseHolidays}日超過）`
      })
    } else if (finalHolidays < baseHolidays) {
      violations.push({
        type: 'warning',
        rule: 'R13',
        message: `${staff.name}: 公休数が${finalHolidays}日（基準${baseHolidays}日、${baseHolidays - finalHolidays}日不足）`
      })
    }

    // 連休チェック（月1回確保）
    if (!hadConsecutiveRest) {
      let foundConsecutive = false
      for (let d = 2; d <= daysInMonth; d++) {
        const s1 = shifts[staff.id][d - 1]
        const s2 = shifts[staff.id][d]
        if (
          (s1 === '休' || s1 === '代' || s1 === '希' || s1 === '明') &&
          (s2 === '休' || s2 === '代' || s2 === '希')
        ) {
          foundConsecutive = true
          break
        }
      }
      if (!foundConsecutive) {
        violations.push({
          type: 'info',
          rule: 'R9',
          message: `${staff.name}: 連休（2日以上の連続休み）が確保できませんでした`
        })
      }
    }
  }

  // ===== STEP 7: 集計 =====
  const summaries: StaffSummary[] = staffList.map((staff) => {
    const arr = shifts[staff.id]
    let holidayCount = 0
    let compDayCount = 0
    let dayShiftCount = 0
    let nightShiftCount = 0
    let sundayRestCount = 0
    let maxConsec = 0
    let currentConsec = 0

    for (let d = 1; d <= daysInMonth; d++) {
      const s = arr[d]
      const dayInfo = dayInfos[d - 1]

      if (s === '休' || s === '希') holidayCount++
      if (s === '代') compDayCount++
      if (s === '日') dayShiftCount++
      if (s === '当') nightShiftCount++
      if (dayInfo.isSunday && (s === '休' || s === '代' || s === '希' || s === '明')) {
        sundayRestCount++
      }
      if (s === '日' || s === '当') {
        currentConsec++
        maxConsec = Math.max(maxConsec, currentConsec)
      } else {
        currentConsec = 0
      }
    }

    return {
      staffId: staff.id,
      holidayCount,
      compDayCount,
      dayShiftCount,
      nightShiftCount,
      sundayRestCount,
      maxConsecutiveDays: maxConsec
    }
  })

  // ===== STEP 8: 連勤違反チェック（R6） =====
  for (const staff of staffList) {
    const summary = summaries.find((s) => s.staffId === staff.id)!
    const max = staff.allowExtendedNight ? 6 : 4
    if (summary.maxConsecutiveDays > max) {
      violations.push({
        type: 'warning',
        rule: 'R6',
        message: `${staff.name}: 最大${summary.maxConsecutiveDays}連勤（上限${max}日）`
      })
    }
  }

  return {
    shifts,
    dayInfos,
    summaries,
    violations,
    daysInMonth,
    year,
    month
  }
}

// CSV出力用テキスト生成
export function generateCSV(result: ShiftResult, staffList: Staff[]): string {
  const { shifts, dayInfos, summaries, daysInMonth } = result

  const headers = [
    'スタッフ',
    ...dayInfos.map((d) => d.label),
    '公休数',
    '代休数',
    '日勤数',
    '当直数',
    '日曜休み数',
    '最大連勤数'
  ]

  const rows: string[][] = [headers]

  for (const staff of staffList) {
    const summary = summaries.find((s) => s.staffId === staff.id)
    const row = [
      staff.name,
      ...Array.from({ length: daysInMonth }, (_, i) => shifts[staff.id][i + 1] || ''),
      String(summary?.holidayCount ?? ''),
      String(summary?.compDayCount ?? ''),
      String(summary?.dayShiftCount ?? ''),
      String(summary?.nightShiftCount ?? ''),
      String(summary?.sundayRestCount ?? ''),
      String(summary?.maxConsecutiveDays ?? '')
    ]
    rows.push(row)
  }

  // フッター行: 日勤人数合計
  const dayShiftCandidates = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )
  const dayCountRow = [
    '日勤人数',
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return String(dayShiftCandidates.filter((s) => shifts[s.id][d] === '日').length)
    }),
    '',
    '',
    '',
    '',
    '',
    ''
  ]
  rows.push(dayCountRow)

  // フッター行: 当直担当者
  const nightCandidates = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )
  const nightRow = [
    '当直担当',
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const staff = nightCandidates.find((s) => shifts[s.id][d] === '当')
      return staff ? staff.name : ''
    }),
    '',
    '',
    '',
    '',
    '',
    ''
  ]
  rows.push(nightRow)

  return rows.map((r) => r.join(',')).join('\n')
}

// マークダウンテーブル生成
export function generateMarkdownTable(result: ShiftResult, staffList: Staff[]): string {
  const { shifts, dayInfos, summaries, daysInMonth } = result

  const headers = [
    'スタッフ',
    ...dayInfos.map((d) => d.label),
    '公休数',
    '代休数',
    '日勤数',
    '当直数',
    '日曜休み数',
    '最大連勤数'
  ]

  const separator = headers.map(() => '---').join(' | ')
  const headerRow = '| ' + headers.join(' | ') + ' |'
  const sepRow = '| ' + separator + ' |'

  const dataRows = staffList.map((staff) => {
    const summary = summaries.find((s) => s.staffId === staff.id)
    const cells = [
      staff.name,
      ...Array.from({ length: daysInMonth }, (_, i) => shifts[staff.id][i + 1] || '　'),
      String(summary?.holidayCount ?? ''),
      String(summary?.compDayCount ?? ''),
      String(summary?.dayShiftCount ?? ''),
      String(summary?.nightShiftCount ?? ''),
      String(summary?.sundayRestCount ?? ''),
      String(summary?.maxConsecutiveDays ?? '')
    ]
    return '| ' + cells.join(' | ') + ' |'
  })

  const dayShiftCandidates = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )
  const nightCandidates = staffList.filter(
    (s) => s.workType === '当直専従' || s.workType === '日当両方' || s.isPartTime
  )

  const dayCountRow =
    '| 日勤人数 | ' +
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return String(dayShiftCandidates.filter((s) => shifts[s.id][d] === '日').length)
    }).join(' | ') +
    ' |  |  |  |  |  |  |'

  const nightRow =
    '| 当直担当 | ' +
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const staff = nightCandidates.find((s) => shifts[s.id][d] === '当')
      return staff ? staff.name : '　'
    }).join(' | ') +
    ' |  |  |  |  |  |  |'

  return [headerRow, sepRow, ...dataRows, dayCountRow, nightRow].join('\n')
}
