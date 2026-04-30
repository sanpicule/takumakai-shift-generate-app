// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildDayInfos,
  getConsecutiveWorkDays,
  canWork,
  canDoNightShift,
  canDoDayShift,
  recentNightCount,
  generateShift
} from '../generator'
import {
  staffDayOnly, staffNightOnly, staffBoth, staffBothD, staffBothE, staffBothF, staffPartTime,
  defaultStaffList, sevenStaffList,
  makeEmptyShifts, fromString, makeInput, makeSevenInput
} from '../../__tests__/fixtures'

// ============================================================
// buildDayInfos
// ============================================================
describe('buildDayInfos', () => {
  it('2026年4月は30日分返す', () => {
    expect(buildDayInfos(2026, 4)).toHaveLength(30)
  })

  it('2026年1月（31日月）は31日分返す', () => {
    expect(buildDayInfos(2026, 1)).toHaveLength(31)
  })

  it('平年2月は28日分返す', () => {
    expect(buildDayInfos(2025, 2)).toHaveLength(28)
  })

  it('うるう年2月は29日分返す', () => {
    expect(buildDayInfos(2024, 2)).toHaveLength(29)
  })

  it('2026年4月1日（水）のラベルが正しい', () => {
    const days = buildDayInfos(2026, 4)
    expect(days[0].label).toBe('1(水)')
  })

  it('2026年4月5日（日）の isSunday が true', () => {
    const days = buildDayInfos(2026, 4)
    expect(days[4].isSunday).toBe(true)
  })

  it('2026年4月4日（土）の isSaturday が true', () => {
    const days = buildDayInfos(2026, 4)
    expect(days[3].isSaturday).toBe(true)
  })

  it('2026年4月6日（月）は平日フラグ', () => {
    const days = buildDayInfos(2026, 4)
    expect(days[5].isSunday).toBe(false)
    expect(days[5].isSaturday).toBe(false)
  })
})

// ============================================================
// getConsecutiveWorkDays
// ============================================================
describe('getConsecutiveWorkDays', () => {
  it('1日だけ日勤なら連勤数 1', () => {
    const shifts = { A: fromString('日') }
    expect(getConsecutiveWorkDays(shifts, 'A', 1)).toBe(1)
  })

  it('3連勤の末尾は 3', () => {
    const shifts = { A: fromString('日日日') }
    expect(getConsecutiveWorkDays(shifts, 'A', 3)).toBe(3)
  })

  it('明けは連勤にカウントしない', () => {
    const shifts = { A: fromString('当明日') }
    expect(getConsecutiveWorkDays(shifts, 'A', 3)).toBe(1)
  })

  it('休みで区切られた後の連勤を正しく返す', () => {
    const shifts = { A: fromString('日日休日日') }
    expect(getConsecutiveWorkDays(shifts, 'A', 5)).toBe(2)
  })

  it('月初（前日なし）の1日目は1', () => {
    const shifts = { A: fromString('日') }
    expect(getConsecutiveWorkDays(shifts, 'A', 1)).toBe(1)
  })
})

// ============================================================
// canWork
// ============================================================
describe('canWork', () => {
  const daysInMonth = 30

  it('既に「希」が設定されている日は false', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][5] = '希'
    expect(canWork(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(false)
  })

  it('既に「日」が設定されている日は false', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][5] = '日'
    expect(canWork(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(false)
  })

  it('前日が「当」なら今日は明けなので false', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][4] = '当'
    expect(canWork(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(false)
  })

  it('空きセルなら true', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    expect(canWork(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(true)
  })

  it('5連勤後の翌日は false（allowExtendedNight=false）', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][1] = '日'
    shifts['C'][2] = '日'
    shifts['C'][3] = '日'
    shifts['C'][4] = '日'
    shifts['C'][5] = '日'
    expect(canWork(shifts, 'C', 6, staffBoth, daysInMonth)).toBe(false)
  })

  it('allowExtendedNight=true なら5連勤後も勤務可（上限999）', () => {
    const shifts = makeEmptyShifts(['B'], daysInMonth)
    shifts['B'][1] = '日'
    shifts['B'][2] = '日'
    shifts['B'][3] = '日'
    shifts['B'][4] = '日'
    shifts['B'][5] = '日'
    expect(canWork(shifts, 'B', 6, staffNightOnly, daysInMonth)).toBe(true)
  })
})

// ============================================================
// canDoNightShift
// ============================================================
describe('canDoNightShift', () => {
  const daysInMonth = 30

  it('当直専従（常勤）は当直可', () => {
    const shifts = makeEmptyShifts(['B'], daysInMonth)
    expect(canDoNightShift(shifts, 'B', 5, staffNightOnly, daysInMonth)).toBe(true)
  })

  it('日当両方は当直可', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    expect(canDoNightShift(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(true)
  })

  it('非常勤はcanDoNightShiftでは当直不可（STEP 1で指定日のみ配置済みのため）', () => {
    const shifts = makeEmptyShifts(['G'], daysInMonth)
    expect(canDoNightShift(shifts, 'G', 5, staffPartTime, daysInMonth)).toBe(false)
  })

  it('既に希望休の日は当直不可', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][5] = '希'
    expect(canDoNightShift(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(false)
  })

  it('事前配置の公休（休）がある日は当直可（上書き許可）', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][5] = '休'
    expect(canDoNightShift(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(true)
  })

  it('翌日が希望休の日は当直不可（翌日が明けに上書きされるため）', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][6] = '希'
    expect(canDoNightShift(shifts, 'C', 5, staffBoth, daysInMonth)).toBe(false)
  })

  it('5連勤後の翌日は当直不可（allowExtendedNight=false）', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][1] = '日'
    shifts['C'][2] = '日'
    shifts['C'][3] = '日'
    shifts['C'][4] = '日'
    shifts['C'][5] = '日'
    expect(canDoNightShift(shifts, 'C', 6, staffBoth, daysInMonth)).toBe(false)
  })

  it('allowExtendedNight=true なら5連勤後も当直可', () => {
    const shifts = makeEmptyShifts(['B'], daysInMonth)
    shifts['B'][1] = '日'
    shifts['B'][2] = '日'
    shifts['B'][3] = '日'
    shifts['B'][4] = '日'
    shifts['B'][5] = '日'
    expect(canDoNightShift(shifts, 'B', 6, staffNightOnly, daysInMonth)).toBe(true)
  })

  it('非常勤: 前日が当で明け扱いのため当直不可', () => {
    const shifts = makeEmptyShifts(['G'], daysInMonth)
    for (let d = 1; d <= 27; d++) shifts['G'][d] = '当'
    expect(canDoNightShift(shifts, 'G', 28, staffPartTime, daysInMonth)).toBe(false)
  })
})

// ============================================================
// canDoDayShift
// ============================================================
describe('canDoDayShift', () => {
  const daysInMonth = 30

  it('当直専従（常勤）は日勤不可', () => {
    const shifts = makeEmptyShifts(['B'], daysInMonth)
    expect(canDoDayShift(shifts, 'B', 5, staffNightOnly)).toBe(false)
  })

  it('非常勤は日勤不可', () => {
    const shifts = makeEmptyShifts(['G'], daysInMonth)
    expect(canDoDayShift(shifts, 'G', 5, staffPartTime)).toBe(false)
  })

  it('日勤専従は日勤可', () => {
    const shifts = makeEmptyShifts(['A'], daysInMonth)
    expect(canDoDayShift(shifts, 'A', 5, staffDayOnly)).toBe(true)
  })

  it('日当両方は日勤可', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    expect(canDoDayShift(shifts, 'C', 5, staffBoth)).toBe(true)
  })

  it('公休スロット（休）がある日は日勤不可（公休スロット保護）', () => {
    const shifts = makeEmptyShifts(['A'], daysInMonth)
    shifts['A'][5] = '休'
    expect(canDoDayShift(shifts, 'A', 5, staffDayOnly)).toBe(false)
  })

  it('前日が当直なら日勤不可（明け扱い）', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][4] = '当'
    expect(canDoDayShift(shifts, 'C', 5, staffBoth)).toBe(false)
  })

  it('5連勤後は日勤不可', () => {
    const shifts = makeEmptyShifts(['C'], daysInMonth)
    shifts['C'][1] = '日'
    shifts['C'][2] = '日'
    shifts['C'][3] = '日'
    shifts['C'][4] = '日'
    shifts['C'][5] = '日'
    expect(canDoDayShift(shifts, 'C', 6, staffBoth)).toBe(false)
  })
})

// ============================================================
// recentNightCount
// ============================================================
describe('recentNightCount', () => {
  it('当直が1件もなければ 0', () => {
    const shifts = { C: fromString('日日日日日日日') }
    expect(recentNightCount(shifts, 'C', 8, 7)).toBe(0)
  })

  it('直近7日で当直2回', () => {
    const shifts = { C: fromString('当日日当日日日') }
    expect(recentNightCount(shifts, 'C', 8, 7)).toBe(2)
  })

  it('upToDay 以降の当直はカウントしない', () => {
    const shifts = { C: fromString('日当日当当') }
    expect(recentNightCount(shifts, 'C', 3, 7)).toBe(1)
  })

  it('月初で前日が少ない場合も範囲内だけカウント', () => {
    const shifts = { C: fromString('当') }
    expect(recentNightCount(shifts, 'C', 2, 7)).toBe(1)
  })
})

// ============================================================
// generateShift（統合検証）
// ============================================================
describe('generateShift', () => {

  // ----------------------------------------------------------
  // 基本入出力
  // ----------------------------------------------------------
  describe('基本入出力', () => {
    it('ShiftResult が返る', () => {
      const result = generateShift(makeInput())
      expect(result).toHaveProperty('shifts')
      expect(result).toHaveProperty('dayInfos')
      expect(result).toHaveProperty('summaries')
      expect(result).toHaveProperty('violations')
    })

    it('dayInfos の要素数が月の日数と一致する（4月=30）', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      expect(result.dayInfos).toHaveLength(30)
    })

    it('summaries の要素数がスタッフ数と一致する', () => {
      const result = generateShift(makeInput())
      expect(result.summaries).toHaveLength(defaultStaffList.length)
    })

    it('shifts に全スタッフの id がキーとして存在する', () => {
      const result = generateShift(makeInput())
      for (const staff of defaultStaffList) {
        expect(result.shifts).toHaveProperty(staff.id)
      }
    })
  })

  // ----------------------------------------------------------
  // R5: 当直翌日は必ず明け（ゼロ違反）
  // ----------------------------------------------------------
  describe('R5: 当直翌日は必ず明け（ゼロ違反）', () => {
    it('当直の翌日セルが必ず「明」または「代」になっている', () => {
      const result = generateShift(makeInput())
      const { shifts, daysInMonth } = result
      for (const staffId of Object.keys(shifts)) {
        for (let d = 1; d < daysInMonth; d++) {
          if (shifts[staffId][d] === '当') {
            expect(['明', '代']).toContain(shifts[staffId][d + 1])
          }
        }
      }
    })

    it('7名構成でも当直翌日が全員明けになっている', () => {
      const result = generateShift(makeSevenInput())
      const { shifts, daysInMonth } = result
      for (const staffId of Object.keys(shifts)) {
        for (let d = 1; d < daysInMonth; d++) {
          if (shifts[staffId][d] === '当') {
            expect(['明', '代']).toContain(shifts[staffId][d + 1])
          }
        }
      }
    })

    it('前月最終当直者の当月1日が「明」になる', () => {
      const result = generateShift(makeInput({
        prevMonthInfo: { lastOnCallStaffId: 'C', carryOverCompDays: {} }
      }))
      expect(result.shifts['C'][1]).toBe('明')
    })
  })

  // ----------------------------------------------------------
  // R4: 当直は毎日1名（ゼロ違反）
  // ----------------------------------------------------------
  describe('R4: 当直は毎日1名（ゼロ違反）', () => {
    it('全日に当直担当者が1名いる（R4 violations がゼロ）', () => {
      const result = generateShift(makeInput())
      const r4 = result.violations.filter(v => v.rule === 'R4')
      expect(r4).toHaveLength(0)
    })

    it('7名構成でも全日に当直担当者が1名いる', () => {
      const result = generateShift(makeSevenInput())
      const r4 = result.violations.filter(v => v.rule === 'R4')
      expect(r4).toHaveLength(0)
    })

    it('同日に当直が2名以上いない', () => {
      const result = generateShift(makeInput())
      const { shifts, daysInMonth } = result
      for (let d = 1; d <= daysInMonth; d++) {
        const nightCount = defaultStaffList.filter(s => shifts[s.id][d] === '当').length
        expect(nightCount).toBeLessThanOrEqual(1)
      }
    })

    it('7名構成: 同日に当直が2名以上いない', () => {
      const result = generateShift(makeSevenInput())
      const { shifts, daysInMonth } = result
      for (let d = 1; d <= daysInMonth; d++) {
        const nightCount = sevenStaffList.filter(s => shifts[s.id][d] === '当').length
        expect(nightCount).toBeLessThanOrEqual(1)
      }
    })
  })

  // ----------------------------------------------------------
  // R13: 公休数（緩和禁止 — 最優先・厳格）
  // ----------------------------------------------------------
  describe('R13: 公休数（緩和禁止）', () => {
    it('2026年4月: 正規スタッフ全員の公休数が基準値 8 と一致する', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const { summaries, dayInfos } = result
      const baseHolidays = dayInfos.filter(d => d.isSaturday || d.isSunday).length  // 8
      const regularStaff = defaultStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const summary = summaries.find(s => s.staffId === staff.id)!
        expect(summary.holidayCount).toBe(baseHolidays)
      }
    })

    it('2026年5月（7名構成）: 正規スタッフ全員の公休数が基準値 10 と一致する', () => {
      const result = generateShift(makeSevenInput({ year: 2026, month: 5 }))
      const { summaries, dayInfos } = result
      const baseHolidays = dayInfos.filter(d => d.isSaturday || d.isSunday).length  // 10
      const regularStaff = sevenStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const summary = summaries.find(s => s.staffId === staff.id)!
        expect(summary.holidayCount).toBe(baseHolidays)
      }
    })

    it('2026年3月: 正規スタッフ全員の公休数が基準値 9 と一致する', () => {
      const result = generateShift(makeInput({ year: 2026, month: 3 }))
      const { summaries, dayInfos } = result
      const baseHolidays = dayInfos.filter(d => d.isSaturday || d.isSunday).length  // 9
      const regularStaff = defaultStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const summary = summaries.find(s => s.staffId === staff.id)!
        expect(summary.holidayCount).toBe(baseHolidays)
      }
    })

    it('非常勤スタッフに R13 warning は記録されない', () => {
      const result = generateShift(makeInput())
      const partTimeViolations = result.violations.filter(
        v => v.rule === 'R13' && v.type === 'warning' && v.message.includes('G')
      )
      expect(partTimeViolations).toHaveLength(0)
    })

    it('R13 warning（公休不足）はゼロ', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const r13warn = result.violations.filter(v => v.rule === 'R13' && v.type === 'warning')
      expect(r13warn).toHaveLength(0)
    })

    it('7名構成: R13 warning（公休不足）はゼロ', () => {
      const result = generateShift(makeSevenInput())
      const r13warn = result.violations.filter(v => v.rule === 'R13' && v.type === 'warning')
      expect(r13warn).toHaveLength(0)
    })
  })

  // ----------------------------------------------------------
  // R2/R3: 日勤人数（月全体に均等分散）
  // ----------------------------------------------------------
  describe('R2/R3: 日勤人数（月全体に均等分散）', () => {
    it('2026年4月: 日勤0の平日が連続3日以上ない', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const { shifts, dayInfos, daysInMonth } = result
      const dayStaff = defaultStaffList.filter(s => s.workType === '日勤専従' || s.workType === '日当両方')
      let maxZeroStreak = 0, zeroStreak = 0
      for (let d = 1; d <= daysInMonth; d++) {
        if (dayInfos[d - 1].isSunday) continue
        const count = dayStaff.filter(s => shifts[s.id][d] === '日').length
        if (count === 0) {
          zeroStreak++
          maxZeroStreak = Math.max(maxZeroStreak, zeroStreak)
        } else {
          zeroStreak = 0
        }
      }
      expect(maxZeroStreak).toBeLessThan(3)
    })

    it('2026年5月（7名構成）: 日勤0の平日が連続3日以上ない', () => {
      const result = generateShift(makeSevenInput())
      const { shifts, dayInfos, daysInMonth } = result
      const dayStaff = sevenStaffList.filter(s => s.workType === '日勤専従' || s.workType === '日当両方')
      let maxZeroStreak = 0, zeroStreak = 0
      for (let d = 1; d <= daysInMonth; d++) {
        if (dayInfos[d - 1].isSunday) continue
        const count = dayStaff.filter(s => shifts[s.id][d] === '日').length
        if (count === 0) {
          zeroStreak++
          maxZeroStreak = Math.max(maxZeroStreak, zeroStreak)
        } else {
          zeroStreak = 0
        }
      }
      expect(maxZeroStreak).toBeLessThan(3)
    })

    it('2026年5月（7名構成）: 月後半（16日〜）に日勤0の平日が連続3日以上ない', () => {
      const result = generateShift(makeSevenInput())
      const { shifts, dayInfos, daysInMonth } = result
      const dayStaff = sevenStaffList.filter(s => s.workType === '日勤専従' || s.workType === '日当両方')
      let maxZeroStreak = 0, zeroStreak = 0
      for (let d = 16; d <= daysInMonth; d++) {
        if (dayInfos[d - 1].isSunday) continue
        const count = dayStaff.filter(s => shifts[s.id][d] === '日').length
        if (count === 0) {
          zeroStreak++
          maxZeroStreak = Math.max(maxZeroStreak, zeroStreak)
        } else {
          zeroStreak = 0
        }
      }
      expect(maxZeroStreak).toBeLessThan(3)
    })

    it('2026年5月（7名構成）: R2/R3 violations が 12 件以下', () => {
      const result = generateShift(makeSevenInput())
      const staffingViolations = result.violations.filter(v => v.rule === 'R2' || v.rule === 'R3')
      expect(staffingViolations.length).toBeLessThanOrEqual(12)
    })

    it('2026年4月（6名構成）: 日勤0の平日が月内に連続3日以上ない', () => {
      // 6名構成は日勤スタッフが4名（A+C+D+E）しかおらず人員不足が発生するが、
      // 分散していること（連続欠員なし）を確認する
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const { shifts, dayInfos, daysInMonth } = result
      const dayStaff = defaultStaffList.filter(s => s.workType === '日勤専従' || s.workType === '日当両方')
      let maxZeroStreak = 0, zeroStreak = 0
      for (let d = 1; d <= daysInMonth; d++) {
        if (dayInfos[d - 1].isSunday) continue
        const count = dayStaff.filter(s => shifts[s.id][d] === '日').length
        if (count === 0) {
          zeroStreak++
          maxZeroStreak = Math.max(maxZeroStreak, zeroStreak)
        } else {
          zeroStreak = 0
        }
      }
      expect(maxZeroStreak).toBeLessThan(3)
    })
  })

  // ----------------------------------------------------------
  // 公休の月内均等分散
  // ----------------------------------------------------------
  describe('公休の月内均等分散', () => {
    it('正規スタッフ全員の公休が月前半（1〜15日）に少なくとも2日存在する', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const { shifts } = result
      const regularStaff = defaultStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const firstHalfRest = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].filter(d => {
          const s = shifts[staff.id][d]
          return s === '休' || s === '希' || s === '代'
        })
        expect(firstHalfRest.length).toBeGreaterThanOrEqual(2)
      }
    })

    it('7名構成: 正規スタッフ全員の公休が月後半（16日〜）に少なくとも2日存在する', () => {
      const result = generateShift(makeSevenInput())
      const { shifts, daysInMonth } = result
      const regularStaff = sevenStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const secondHalfRest: number[] = []
        for (let d = 16; d <= daysInMonth; d++) {
          const s = shifts[staff.id][d]
          if (s === '休' || s === '希' || s === '代') secondHalfRest.push(d)
        }
        expect(secondHalfRest.length).toBeGreaterThanOrEqual(2)
      }
    })
  })

  // ----------------------------------------------------------
  // R14: 希望休の最優先反映
  // ----------------------------------------------------------
  describe('R14: 希望休の最優先反映', () => {
    it('希望休指定日が「希」になっている', () => {
      const result = generateShift(makeInput({
        requests: { C: [5, 10] }
      }))
      expect(result.shifts['C'][5]).toBe('希')
      expect(result.shifts['C'][10]).toBe('希')
    })

    it('希望休の日に「日」「当」が割り当てられない', () => {
      const result = generateShift(makeInput({
        requests: { C: [5, 10, 15] }
      }))
      for (const d of [5, 10, 15]) {
        expect(result.shifts['C'][d]).not.toBe('日')
        expect(result.shifts['C'][d]).not.toBe('当')
      }
    })
  })

  // ----------------------------------------------------------
  // R11: 代休付与
  // ----------------------------------------------------------
  describe('R11: 代休付与', () => {
    it('土曜当直スタッフに代休が付与される', () => {
      const result = generateShift(makeInput({ year: 2026, month: 4 }))
      const { shifts, dayInfos, daysInMonth, summaries } = result

      for (const staff of defaultStaffList.filter(s => !s.isPartTime)) {
        let satNightCount = 0
        for (let d = 1; d <= daysInMonth; d++) {
          if (dayInfos[d - 1].isSaturday && shifts[staff.id][d] === '当') {
            satNightCount++
          }
        }
        if (satNightCount > 0) {
          const summary = summaries.find(s => s.staffId === staff.id)!
          expect(summary.compDayCount).toBeGreaterThanOrEqual(satNightCount)
        }
      }
    })
  })

  // ----------------------------------------------------------
  // R6: 連勤上限
  // ----------------------------------------------------------
  describe('R6: 連勤上限', () => {
    it('全スタッフの最大連勤が6日以内', () => {
      const result = generateShift(makeInput())
      for (const summary of result.summaries) {
        expect(summary.maxConsecutiveDays).toBeLessThanOrEqual(6)
      }
    })

    it('7名構成: 全スタッフの最大連勤が6日以内', () => {
      const result = generateShift(makeSevenInput())
      for (const summary of result.summaries) {
        expect(summary.maxConsecutiveDays).toBeLessThanOrEqual(6)
      }
    })

    it('日勤専従（A）は5連勤以内', () => {
      const result = generateShift(makeInput())
      const summary = result.summaries.find(s => s.staffId === 'A')!
      expect(summary.maxConsecutiveDays).toBeLessThanOrEqual(5)
    })
  })

  // ----------------------------------------------------------
  // スタッフ種別の制約
  // ----------------------------------------------------------
  describe('スタッフ種別の制約', () => {
    it('日勤専従スタッフ（A）に「当」「明」が割り当てられない', () => {
      const result = generateShift(makeInput())
      const { shifts, daysInMonth } = result
      for (let d = 1; d <= daysInMonth; d++) {
        expect(shifts['A'][d]).not.toBe('当')
        expect(shifts['A'][d]).not.toBe('明')
      }
    })

    it('当直専従（常勤 B）に「日」が割り当てられない', () => {
      const result = generateShift(makeInput())
      const { shifts, daysInMonth } = result
      for (let d = 1; d <= daysInMonth; d++) {
        expect(shifts['B'][d]).not.toBe('日')
      }
    })

    it('非常勤（G）に「日」が割り当てられない', () => {
      const result = generateShift(makeInput())
      const { shifts, daysInMonth } = result
      for (let d = 1; d <= daysInMonth; d++) {
        expect(shifts['G'][d]).not.toBe('日')
      }
    })
  })

  // ----------------------------------------------------------
  // 非常勤の指定当直日
  // ----------------------------------------------------------
  describe('非常勤の指定当直日', () => {
    it('指定日に「当」が設定される', () => {
      const result = generateShift(makeInput({
        partTimeWorkDays: { G: [10, 20] }
      }))
      expect(result.shifts['G'][10]).toBe('当')
      expect(result.shifts['G'][20]).toBe('当')
    })

    it('指定日翌日に「明」が設定される', () => {
      const result = generateShift(makeInput({
        partTimeWorkDays: { G: [10] }
      }))
      expect(result.shifts['G'][11]).toBe('明')
    })
  })

  // ----------------------------------------------------------
  // 2026年5月 実運用テスト（致命的バグの再発防止）
  // ----------------------------------------------------------
  describe('2026年5月 実運用テスト', () => {
    const getResult = () => generateShift(makeSevenInput({ year: 2026, month: 5 }))

    it('公休数が基準値 10 と正確に一致する（全正規スタッフ）', () => {
      const result = getResult()
      const regularStaff = sevenStaffList.filter(s => !s.isPartTime)
      for (const staff of regularStaff) {
        const summary = result.summaries.find(s => s.staffId === staff.id)!
        expect(summary.holidayCount).toBe(10)
      }
    })

    it('月後半（16〜31日）に日勤人数が0の日が連続しない（最大1日まで）', () => {
      const result = getResult()
      const { shifts, dayInfos, daysInMonth } = result
      const dayStaff = sevenStaffList.filter(s => s.workType === '日勤専従' || s.workType === '日当両方')
      let maxZeroStreak = 0, zeroStreak = 0
      for (let d = 16; d <= daysInMonth; d++) {
        if (dayInfos[d - 1].isSunday) { zeroStreak = 0; continue }
        const count = dayStaff.filter(s => shifts[s.id][d] === '日').length
        if (count === 0) {
          zeroStreak++
          maxZeroStreak = Math.max(maxZeroStreak, zeroStreak)
        } else {
          zeroStreak = 0
        }
      }
      expect(maxZeroStreak).toBeLessThanOrEqual(1)
    })

    it('全ての日曜に日勤が1名以上いる（R3 violations ゼロ）', () => {
      const result = getResult()
      const r3 = result.violations.filter(v => v.rule === 'R3')
      expect(r3).toHaveLength(0)
    })

    it('R4 violations がゼロ（全日に当直担当が確保される）', () => {
      const result = getResult()
      expect(result.violations.filter(v => v.rule === 'R4')).toHaveLength(0)
    })
  })
})
