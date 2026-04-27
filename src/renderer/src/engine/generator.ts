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
export function buildDayInfos(year: number, month: number): DayInfo[] {
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
export function getConsecutiveWorkDays(shifts: MonthlyShifts, staffId: string, day: number): number {
  const arr = shifts[staffId]
  const n = arr.length - 1

  let before = 0
  for (let d = day - 1; d >= 1; d--) {
    const s = arr[d]
    if (s === '日' || s === '当') before++
    else break
  }

  let after = 0
  for (let d = day + 1; d <= n; d++) {
    const s = arr[d]
    if (s === '日' || s === '当') after++
    else break
  }

  return before + 1 + after
}

// その日に勤務可能かどうかチェック（連勤制約）
export function canWork(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff,
  daysInMonth: number
): boolean {
  const arr = shifts[staffId]
  const current = arr[day]

  if (current !== '') return false
  if (day >= 2 && arr[day - 1] === '当') return false

  const maxConsecutive = staff.allowExtendedNight ? 999 : 5
  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  if (consecutive >= maxConsecutive) return false

  void daysInMonth
  void getConsecutiveWorkDays

  return true
}

// 当直をその日に入れられるか（当直専用チェック）
export function canDoNightShift(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff,
  daysInMonth: number
): boolean {
  const arr = shifts[staffId]

  if (arr[day] !== '' && arr[day] !== '休') return false
  if (day >= 2 && arr[day - 1] === '当') return false
  if (day + 1 <= daysInMonth && arr[day + 1] === '希') return false

  if (staff.allowExtendedNight) {
    return true
  }

  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  return consecutive < 5
}

// 日勤をその日に入れられるかチェック
// 注意: 公休の先読みチェックは行わない（事前均等配置済みのため不要）
export function canDoDayShift(
  shifts: MonthlyShifts,
  staffId: string,
  day: number,
  staff: Staff,
  daysInMonth = 31
): boolean {
  const arr = shifts[staffId]

  if (arr[day] !== '') return false
  if (day >= 2 && arr[day - 1] === '当') return false

  if (staff.workType === '当直専従' || staff.isPartTime) return false

  let consecutive = 0
  let d = day - 1
  while (d >= 1 && (arr[d] === '日' || arr[d] === '当')) {
    consecutive++
    d--
  }
  if (consecutive >= 5) return false

  void daysInMonth
  return true
}

// スタッフの最近の当直回数を返す（直近N日）
export function recentNightCount(
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

// 空きスロットから count 個を均等に選ぶ
function selectEvenly(slots: number[], count: number): number[] {
  if (count <= 0 || slots.length === 0) return []
  if (slots.length <= count) return [...slots]

  const result: number[] = []
  const interval = slots.length / count
  for (let k = 0; k < count; k++) {
    const idx = Math.floor(k * interval + interval / 2)
    result.push(slots[Math.min(idx, slots.length - 1)])
  }
  return result
}

// メインのシフト生成関数
export function generateShift(input: ShiftInput): ShiftResult {
  const { year, month, staffList, requests, partTimeWorkDays, prevMonthInfo } = input
  const dayInfos = buildDayInfos(year, month)
  const daysInMonth = dayInfos.length
  const violations: ConstraintViolation[] = []

  const satCount = dayInfos.filter((d) => d.isSaturday).length
  const sunCount = dayInfos.filter((d) => d.isSunday).length
  const baseHolidays = satCount + sunCount

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
    const alreadyHasNight = nightCandidates.some((s) => shifts[s.id][d] === '当')
    if (alreadyHasNight) continue

    const candidates = nightCandidates
      .filter((s) => canDoNightShift(shifts, s.id, d, s, daysInMonth))
      .filter((s) => {
        // 非常勤は公休不要
        if (s.isPartTime) return true
        // この当直+翌日明けで2スロット消費した後に公休が確保できるか
        const currentLocked = shifts[s.id].filter((sym, i) => i >= 1 && sym !== '').length
        const emptyAfter = daysInMonth - currentLocked - 2
        const currentHols = shifts[s.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        const holsNeeded = Math.max(0, baseHolidays - currentHols)
        return emptyAfter >= holsNeeded
      })
      .map((s) => {
        const isWeekend = dayInfos[d - 1].isSaturday || dayInfos[d - 1].isSunday
        return {
          staff: s,
          score:
            recentNightCount(shifts, s.id, d, 14) * 10 +
            (s.isPartTime ? 100 : 0) +
            // 土日は日当両方に当直を避けてBを優先（日勤カバレッジ確保）
            (isWeekend && s.workType === '日当両方' ? 50 : 0)
        }
      })
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
    if (d + 1 <= daysInMonth && shifts[chosen.id][d + 1] === '') {
      shifts[chosen.id][d + 1] = '明'
    }
  }

  // ===== STEP 3: 明けの確認（当直翌日が空欄なら明けに R5） =====
  for (const staff of staffList) {
    for (let d = 1; d < daysInMonth; d++) {
      if (shifts[staff.id][d] === '当' && shifts[staff.id][d + 1] === '') {
        shifts[staff.id][d + 1] = '明'
      }
    }
  }

  // ===== STEP 4: 代休・公休を日勤割り当て前に配置 =====
  // フェーズA: 全スタッフの代休を先に確定（土/日当直 + 繰越）
  // フェーズB: 全スタッフの代休配置後に公休を配置（カバレッジ判定が正確になる）
  const dayCandidates = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )

  // フェーズA: 代休を全スタッフに配置
  for (const staff of staffList) {
    if (staff.isPartTime) continue

    let compNeeded = prevMonthInfo.carryOverCompDays[staff.id] || 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dayInfo = dayInfos[d - 1]
      const s = shifts[staff.id][d]
      if (dayInfo.isSaturday && s === '当') compNeeded++
      if (dayInfo.isSunday && s === '当') compNeeded++
    }

    // 代休を明け翌日に優先配置（公休スペース確保チェック付き）
    let compLeft = compNeeded
    for (let d = 2; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '' && shifts[staff.id][d - 1] === '明') {
        // この代休を置いた後に公休が確保できるか確認
        const emptyAfterThis = shifts[staff.id].filter((s, i) => i >= 1 && s === '').length - 1
        const currentHols = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
        if (emptyAfterThis >= baseHolidays - currentHols) {
          shifts[staff.id][d] = '代'
          compLeft--
        }
      }
    }
    // 残り代休を空きスロットに順次配置（同様の余裕チェック）
    for (let d = 1; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        const emptyAfterThis = shifts[staff.id].filter((s, i) => i >= 1 && s === '').length - 1
        const currentHols = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
        if (emptyAfterThis >= baseHolidays - currentHols) {
          shifts[staff.id][d] = '代'
          compLeft--
        }
      }
    }
    if (compLeft > 0) {
      violations.push({
        type: 'info',
        rule: 'R12',
        message: `${staff.name}: 代休${compLeft}日が当月内に消化できませんでした（翌月繰越）`
      })
    }
  }

  // フェーズB: 全スタッフの公休を「日付ごと」に均等配分
  // 日曜(R10)→土曜(R2)→平日(R2)の順に、公休数が少ない人を優先して配置
  // 各日：最大(日勤候補-必要人数)名まで休を配置 + カバレッジチェック

  const sundayDates = dayInfos.filter((di) => di.isSunday).map((di) => di.date)
  const saturdayDates = dayInfos.filter((di) => di.isSaturday).map((di) => di.date)
  const weekdayDatesList = dayInfos
    .filter((di) => !di.isSaturday && !di.isSunday)
    .map((di) => di.date)
  const regularDayCandidates = dayCandidates.filter((s) => !s.isPartTime)

  // 公休配置ヘルパー: 1日分の処理（公休数が少ない人から優先、カバレッジ上限付き）
  function placeRestForDay(
    d: number,
    required: number,
    maxRest: number,
    sortKey: (s: Staff) => number
  ) {
    const eligible = staffList
      .filter((s) => !s.isPartTime && shifts[s.id][d] === '')
      .filter((s) => {
        const hols = shifts[s.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        return hols < baseHolidays
      })
      .map((s) => ({ staff: s, key: sortKey(s) }))
      .sort((a, b) => a.key - b.key)

    let restCount = 0
    for (const { staff } of eligible) {
      if (restCount >= maxRest) break
      const otherAvailable = dayCandidates
        .filter((s) => s.id !== staff.id && shifts[s.id][d] === '')
        .length
      if (otherAvailable >= required) {
        shifts[staff.id][d] = '休'
        restCount++
      }
    }
  }

  // B-1: 日曜を日付順に処理（R10: 日曜休み均等配分）
  for (const d of sundayDates) {
    placeRestForDay(
      d, 1, Math.max(0, regularDayCandidates.length - 1),
      (s) => sundayDates.filter((sd) => sd < d && (shifts[s.id][sd] === '休' || shifts[s.id][sd] === '希')).length
    )
  }

  // B-2: 土曜を日付順に処理（R2: 土曜日勤2名確保）
  for (const d of saturdayDates) {
    placeRestForDay(
      d, 2, Math.max(0, regularDayCandidates.length - 2),
      (s) => saturdayDates.filter((sd) => sd < d && (shifts[s.id][sd] === '休' || shifts[s.id][sd] === '希')).length
    )
  }

  // B-3: 平日を日付順に処理（R2: 平日日勤2名確保）
  // 残り公休が少ない順に優先し、最大3名まで休を配置
  for (const d of weekdayDatesList) {
    placeRestForDay(
      d, 2, Math.max(0, regularDayCandidates.length - 2),
      (s) => shifts[s.id].filter((sym, i) => i >= 1 && i < d && (sym === '休' || sym === '希')).length
    )
  }

  // B-4: 各スタッフの残り公休不足をフェーズBで確定（STEP 5 前に全員を基準値に）
  // B-1〜B-3 の均等配分で取りこぼした分をここで補う
  for (const staff of staffList) {
    if (staff.isPartTime) continue
    const currentRest = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
    let holsLeft = Math.max(0, baseHolidays - currentRest)
    if (holsLeft === 0) continue

    // Pass 1: カバレッジを尊重して配置
    for (let d = 1; d <= daysInMonth && holsLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        const dayInfo = dayInfos[d - 1]
        const required = dayInfo.isSunday ? 1 : 2
        const otherAvailable = dayCandidates
          .filter((s) => s.id !== staff.id && shifts[s.id][d] === '')
          .length
        if (otherAvailable >= required) {
          shifts[staff.id][d] = '休'
          holsLeft--
        }
      }
    }
    // Pass 2: カバレッジOKスロット優先で均等配置（日勤0発生を抑制）
    if (holsLeft > 0) {
      const safeSlots: number[] = []
      const unsafeSlots: number[] = []
      for (let d = 1; d <= daysInMonth; d++) {
        if (shifts[staff.id][d] !== '') continue
        const di = dayInfos[d - 1]
        const req = di.isSunday ? 1 : 2
        const others = dayCandidates.filter((s) => s.id !== staff.id && shifts[s.id][d] === '').length
        if (others >= req) safeSlots.push(d)
        else unsafeSlots.push(d)
      }
      const chosenSafe = selectEvenly(safeSlots, Math.min(holsLeft, safeSlots.length))
      for (const d of chosenSafe) { shifts[staff.id][d] = '休'; holsLeft-- }
      if (holsLeft > 0) {
        const chosenUnsafe = selectEvenly(unsafeSlots, Math.min(holsLeft, unsafeSlots.length))
        for (const d of chosenUnsafe) { shifts[staff.id][d] = '休'; holsLeft-- }
      }
    }
    // Pass 3: それでも不足なら空きに順次配置（最終手段）
    for (let d = 1; d <= daysInMonth && holsLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        shifts[staff.id][d] = '休'
        holsLeft--
      }
    }
  }

  // ===== STEP 5: 毎日の日勤を割り当て（R2: 平日・土=2名, R3: 日=1名） =====
  // 公休は STEP 4 で事前配置済みなので先読みチェック不要
  const dayShiftCandidates = staffList.filter(
    (s) => s.workType === '日勤専従' || s.workType === '日当両方'
  )

  for (let d = 1; d <= daysInMonth; d++) {
    const dayInfo = dayInfos[d - 1]
    const requiredCount = dayInfo.isSunday ? 1 : 2

    const currentDayCount = dayShiftCandidates.filter((s) => shifts[s.id][d] === '日').length
    if (currentDayCount >= requiredCount) continue

    const candidates = dayShiftCandidates
      .filter((s) => canDoDayShift(shifts, s.id, d, s, daysInMonth))
      .filter((s) => shifts[s.id][d] !== '当')
      .filter((s) => {
        // 日勤を入れた後に公休が確保できるか確認（非常勤は対象外）
        if (s.isPartTime) return true
        const currentLocked = shifts[s.id].filter((sym, i) => i >= 1 && sym !== '').length
        const emptyAfter = daysInMonth - currentLocked - 1
        const currentHols = shifts[s.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        const holsNeeded = Math.max(0, baseHolidays - currentHols)
        return emptyAfter >= holsNeeded
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

  // ===== STEP 5a: 日勤0日の強制修正 =====
  // 公休に余裕（基準値超）があるスタッフの「休」を「日」に変換して最低1名を保証。
  // 余裕のある人が不在 = スタッフ数や希望休の条件では確保不可能 → critical 違反として記録。
  for (let d = 1; d <= daysInMonth; d++) {
    const dayInfo = dayInfos[d - 1]
    const currentCount = dayShiftCandidates.filter((s) => shifts[s.id][d] === '日').length
    if (currentCount > 0) continue

    // 公休数が基準値より多いスタッフのみを対象（変換後も公休数が基準値以上になる）
    const rescuable = dayShiftCandidates
      .filter((s) => shifts[s.id][d] === '休' || shifts[s.id][d] === '希')
      .filter((s) => {
        const hols = shifts[s.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        return hols > baseHolidays
      })
      .sort((a, b) => {
        const aHols = shifts[a.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        const bHols = shifts[b.id].filter((sym, i) => i >= 1 && (sym === '休' || sym === '希')).length
        return bHols - aHols
      })

    if (rescuable.length > 0) {
      // 公休余裕あり → 変換後も基準値以上なので補填不要
      shifts[rescuable[0].id][d] = '日'
    } else {
      // 全員が基準値ちょうど or 「休」スロットなし → 確保不可能
      violations.push({
        type: 'critical',
        rule: dayInfo.isSunday ? 'R3' : 'R2',
        message: `${dayInfo.label}: この条件では日勤を確保できません（スタッフの希望休・前月情報を見直してください）`
      })
    }
  }

  // ===== STEP 6: 日曜日勤の代休補填（R11） =====
  for (const staff of staffList) {
    if (staff.isPartTime) continue

    let sundayDayShiftComp = 0
    for (let d = 1; d <= daysInMonth; d++) {
      if (dayInfos[d - 1].isSunday && shifts[staff.id][d] === '日') {
        sundayDayShiftComp++
      }
    }

    // 日曜日勤の代休を明け翌日または空きスロットに配置（公休スペース確保チェック付き）
    let compLeft = sundayDayShiftComp
    for (let d = 2; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '' && shifts[staff.id][d - 1] === '明') {
        const emptyAfterThis = shifts[staff.id].filter((s, i) => i >= 1 && s === '').length - 1
        const currentHols = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
        if (emptyAfterThis >= baseHolidays - currentHols) {
          shifts[staff.id][d] = '代'
          compLeft--
        }
      }
    }
    for (let d = 1; d <= daysInMonth && compLeft > 0; d++) {
      if (shifts[staff.id][d] === '') {
        const emptyAfterThis = shifts[staff.id].filter((s, i) => i >= 1 && s === '').length - 1
        const currentHols = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
        if (emptyAfterThis >= baseHolidays - currentHols) {
          shifts[staff.id][d] = '代'
          compLeft--
        }
      }
    }
    if (compLeft > 0) {
      violations.push({
        type: 'info',
        rule: 'R12',
        message: `${staff.name}: 代休${compLeft}日が当月内に消化できませんでした（翌月繰越）`
      })
    }
  }

  // ===== STEP 7: 公休数の最終確認・補填（R13） =====
  for (const staff of staffList) {
    if (staff.isPartTime) continue

    const finalHols = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length

    if (finalHols < baseHolidays) {
      // 不足分を補填: Pass1=カバレッジ尊重、Pass2=R13優先で残り全配置
      let holsLeft = baseHolidays - finalHols
      for (let d = 1; d <= daysInMonth && holsLeft > 0; d++) {
        if (shifts[staff.id][d] === '') {
          const dayInfo = dayInfos[d - 1]
          const required = dayInfo.isSunday ? 1 : 2
          const otherAvailable = dayCandidates
            .filter((s) => s.id !== staff.id && shifts[s.id][d] === '')
            .length
          if (otherAvailable >= required) {
            shifts[staff.id][d] = '休'
            holsLeft--
          }
        }
      }
      // Pass 2: カバレッジ確認ありで均等分散配置
      if (holsLeft > 0) {
        const validSlots: number[] = []
        for (let d = 1; d <= daysInMonth; d++) {
          if (shifts[staff.id][d] === '') {
            const dayInfo = dayInfos[d - 1]
            const required = dayInfo.isSunday ? 1 : 2
            const otherAvailable = dayCandidates
              .filter((s) => s.id !== staff.id && shifts[s.id][d] === '')
              .length
            if (otherAvailable >= required) validSlots.push(d)
          }
        }
        const chosen = selectEvenly(validSlots, Math.min(holsLeft, validSlots.length))
        for (const d of chosen) {
          shifts[staff.id][d] = '休'
          holsLeft--
        }
      }
      // Pass 3: 最終手段（公休数確保を最優先）
      for (let d = 1; d <= daysInMonth && holsLeft > 0; d++) {
        if (shifts[staff.id][d] === '') {
          shifts[staff.id][d] = '休'
          holsLeft--
        }
      }
      const afterFill = shifts[staff.id].filter((s, i) => i >= 1 && (s === '休' || s === '希')).length
      if (afterFill < baseHolidays) {
        violations.push({
          type: 'warning',
          rule: 'R13',
          message: `${staff.name}: 公休数が${afterFill}日（基準${baseHolidays}日、${baseHolidays - afterFill}日不足）`
        })
      }
    } else if (finalHols > baseHolidays) {
      violations.push({
        type: 'info',
        rule: 'R13',
        message: `${staff.name}: 公休数が${finalHols}日（基準${baseHolidays}日、+${finalHols - baseHolidays}日超過）`
      })
    }
  }

  // ===== STEP 8: 連休チェック（R9） =====
  for (const staff of staffList) {
    if (staff.isPartTime) continue
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

  // ===== STEP 9: 集計 =====
  const summaries: StaffSummary[] = staffList.map((staff) => {
    const arr = shifts[staff.id]
    let holidayCount = 0
    let compDayCount = 0
    let dayShiftCount = 0
    let nightShiftCount = 0
    let sundayRestCount = 0
    let maxConsec = 0
    let currentConsec = 0
    let consecutiveRestCount = 0
    let restStreak = 0

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

      if (s === '休' || s === '代' || s === '希' || s === '明') {
        restStreak++
      } else {
        if (restStreak >= 2) consecutiveRestCount++
        restStreak = 0
      }
    }
    if (restStreak >= 2) consecutiveRestCount++

    return {
      staffId: staff.id,
      holidayCount,
      compDayCount,
      dayShiftCount,
      nightShiftCount,
      sundayRestCount,
      maxConsecutiveDays: maxConsec,
      consecutiveRestCount
    }
  })

  // ===== STEP 10: 連勤違反チェック（R6） =====
  for (const staff of staffList) {
    const summary = summaries.find((s) => s.staffId === staff.id)!
    const max = 6
    if (summary.maxConsecutiveDays > max) {
      violations.push({
        type: 'warning',
        rule: 'R6',
        message: `${staff.name}: 最大${summary.maxConsecutiveDays}連勤（上限${max}日超過）`
      })
    }
  }

  // ===== STEP 11: 代休数の上限チェック =====
  // 代休権利数 = 前月繰越 + 土曜当直数 + 日曜当直数 + 日曜日勤数
  for (const staff of staffList) {
    if (staff.isPartTime) continue
    const summary = summaries.find((s) => s.staffId === staff.id)!
    let entitled = prevMonthInfo.carryOverCompDays[staff.id] || 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dayInfo = dayInfos[d - 1]
      const s = shifts[staff.id][d]
      if (dayInfo.isSaturday && s === '当') entitled++
      if (dayInfo.isSunday && s === '当') entitled++
      if (dayInfo.isSunday && s === '日') entitled++
    }
    if (summary.compDayCount > entitled) {
      violations.push({
        type: 'warning',
        rule: 'R11',
        message: `${staff.name}: 代休数${summary.compDayCount}日が権利数${entitled}日を超えています`
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
    '最大連勤数',
    '連休数'
  ]

  const rows: string[][] = [headers]

  for (const staff of staffList) {
    const summary = summaries.find((s) => s.staffId === staff.id)
    const row = [
      staff.name,
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const s = shifts[staff.id][i + 1] || ''
        return s === '希' ? '休' : s
      }),
      String(summary?.holidayCount ?? ''),
      String(summary?.compDayCount ?? ''),
      String(summary?.dayShiftCount ?? ''),
      String(summary?.nightShiftCount ?? ''),
      String(summary?.sundayRestCount ?? ''),
      String(summary?.maxConsecutiveDays ?? ''),
      String(summary?.consecutiveRestCount ?? '')
    ]
    rows.push(row)
  }

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
    '',
    ''
  ]
  rows.push(dayCountRow)

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
    '',
    ''
  ]
  rows.push(nightRow)

  return '﻿' + rows.map((r) => r.join(',')).join('\n')
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
    '最大連勤数',
    '連休数'
  ]

  const separator = headers.map(() => '---').join(' | ')
  const headerRow = '| ' + headers.join(' | ') + ' |'
  const sepRow = '| ' + separator + ' |'

  const dataRows = staffList.map((staff) => {
    const summary = summaries.find((s) => s.staffId === staff.id)
    const cells = [
      staff.name,
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const s = shifts[staff.id][i + 1] || '　'
        return s === '希' ? '休' : s
      }),
      String(summary?.holidayCount ?? ''),
      String(summary?.compDayCount ?? ''),
      String(summary?.dayShiftCount ?? ''),
      String(summary?.nightShiftCount ?? ''),
      String(summary?.sundayRestCount ?? ''),
      String(summary?.maxConsecutiveDays ?? ''),
      String(summary?.consecutiveRestCount ?? '')
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
    ' |  |  |  |  |  |  |  |'

  const nightRow =
    '| 当直担当 | ' +
    Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      const staff = nightCandidates.find((s) => shifts[s.id][d] === '当')
      return staff ? staff.name : '　'
    }).join(' | ') +
    ' |  |  |  |  |  |  |  |'

  return [headerRow, sepRow, ...dataRows, dayCountRow, nightRow].join('\n')
}
