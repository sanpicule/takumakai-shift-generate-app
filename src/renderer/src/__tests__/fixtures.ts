import type { Staff, MonthlyShifts, ShiftInput, ShiftSymbol } from '../types'

// ===== 共通スタッフフィクスチャ =====

export const staffDayOnly: Staff = {
  id: 'A', name: 'A', workType: '日勤専従',
  allowExtendedNight: false, isPartTime: false, order: 0
}

export const staffNightOnly: Staff = {
  id: 'B', name: 'B', workType: '当直専従',
  allowExtendedNight: true, isPartTime: false, order: 1
}

export const staffBoth: Staff = {
  id: 'C', name: 'C', workType: '日当両方',
  allowExtendedNight: false, isPartTime: false, order: 2
}

export const staffBothD: Staff = {
  id: 'D', name: 'D', workType: '日当両方',
  allowExtendedNight: false, isPartTime: false, order: 3
}

export const staffBothE: Staff = {
  id: 'E', name: 'E', workType: '日当両方',
  allowExtendedNight: false, isPartTime: false, order: 4
}

export const staffBothF: Staff = {
  id: 'F', name: 'F', workType: '日当両方',
  allowExtendedNight: false, isPartTime: false, order: 5
}

export const staffPartTime: Staff = {
  id: 'G', name: 'G', workType: '非常勤',
  allowExtendedNight: false, isPartTime: true, order: 6
}

/** 標準の6名スタッフ構成（テスト用） */
export const defaultStaffList: Staff[] = [
  staffDayOnly, staffNightOnly, staffBoth, staffBothD, staffBothE, staffPartTime
]

/** 実運用に近い7名スタッフ構成（A:日勤専従 B:当直専従 C-F:日当両方 G:非常勤） */
export const sevenStaffList: Staff[] = [
  staffDayOnly, staffNightOnly, staffBoth, staffBothD, staffBothE, staffBothF, staffPartTime
]

// ===== MonthlyShifts ヘルパー =====

/** 指定スタッフIDで全日空欄のシフトを生成する（daysInMonth 日分、index 0 は未使用） */
export function makeEmptyShifts(staffIds: string[], daysInMonth: number): MonthlyShifts {
  const shifts: MonthlyShifts = {}
  for (const id of staffIds) {
    shifts[id] = new Array(daysInMonth + 1).fill('') as ShiftSymbol[]
  }
  return shifts
}

/** 1スタッフ分のシフト配列を文字列から生成する（1始まりインデックス）
 * 例: fromString('日当明休') → ['', '日', '当', '明', '休'] */
export function fromString(s: string): ShiftSymbol[] {
  return (['', ...s.split('')] as ShiftSymbol[])
}

// ===== ShiftInput ヘルパー =====

export function makeInput(overrides: Partial<ShiftInput> = {}): ShiftInput {
  return {
    year: 2026,
    month: 4,  // 4月: 土4・日4 = 公休基準8日
    staffList: defaultStaffList,
    requests: {},
    partTimeWorkDays: {},
    prevMonthInfo: { lastOnCallStaffId: '', carryOverCompDays: {} },
    ...overrides
  }
}

/** 7名構成での ShiftInput を生成するヘルパー */
export function makeSevenInput(overrides: Partial<ShiftInput> = {}): ShiftInput {
  return {
    year: 2026,
    month: 5,  // 5月: 土5・日5 = 公休基準10日
    staffList: sevenStaffList,
    requests: {},
    partTimeWorkDays: {},
    prevMonthInfo: { lastOnCallStaffId: '', carryOverCompDays: {} },
    ...overrides
  }
}
