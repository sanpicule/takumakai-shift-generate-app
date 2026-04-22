// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore } from '../useAppStore'
import type { Staff, ShiftResult, StaffPreset } from '../../types'

// window.api のモック（electron IPC の代替）
const mockStoreGet = vi.fn()
const mockStoreSet = vi.fn()

vi.stubGlobal('api', {
  storeGet: mockStoreGet,
  storeSet: mockStoreSet,
  storeDelete: vi.fn(),
  saveCsv: vi.fn()
})

// デフォルト初期状態
const initialState = {
  staffList: [
    { id: 'A', name: 'A', workType: '日勤専従' as const, allowExtendedNight: false, isPartTime: false, order: 0 },
    { id: 'B', name: 'B', workType: '当直専従' as const, allowExtendedNight: true, isPartTime: false, order: 1 },
    { id: 'C', name: 'C', workType: '日当両方' as const, allowExtendedNight: false, isPartTime: false, order: 2 }
  ],
  requests: {},
  partTimeWorkDays: {},
  prevMonthInfo: { lastOnCallStaffId: '', carryOverCompDays: {} },
  shiftResult: null,
  staffPresets: []
}

// 各テスト前にストアとモックをリセット
beforeEach(() => {
  useAppStore.setState(initialState)
  vi.clearAllMocks()
})

const get = () => useAppStore.getState()

const newStaff: Staff = {
  id: 'X', name: 'X', workType: '日当両方',
  allowExtendedNight: false, isPartTime: false, order: 99
}

// ============================================================
// スタッフ管理
// ============================================================
describe('addStaff', () => {
  it('スタッフが追加される', () => {
    const before = get().staffList.length
    get().addStaff(newStaff)
    expect(get().staffList).toHaveLength(before + 1)
  })

  it('追加したスタッフが id で取得できる', () => {
    get().addStaff(newStaff)
    expect(get().staffList.find(s => s.id === 'X')).toBeDefined()
  })
})

describe('updateStaff', () => {
  it('指定フィールドが更新される', () => {
    get().updateStaff('A', { name: 'Alice' })
    expect(get().staffList.find(s => s.id === 'A')?.name).toBe('Alice')
  })

  it('他フィールドが変わらない', () => {
    get().updateStaff('A', { name: 'Alice' })
    expect(get().staffList.find(s => s.id === 'A')?.workType).toBe('日勤専従')
  })

  it('存在しない id は staffList を変更しない', () => {
    const before = get().staffList.length
    get().updateStaff('NOTEXIST', { name: 'X' })
    expect(get().staffList).toHaveLength(before)
  })
})

describe('removeStaff', () => {
  it('対象スタッフが削除される', () => {
    get().removeStaff('A')
    expect(get().staffList.find(s => s.id === 'A')).toBeUndefined()
  })

  it('他スタッフは残る', () => {
    const before = get().staffList.length
    get().removeStaff('A')
    expect(get().staffList).toHaveLength(before - 1)
    expect(get().staffList.find(s => s.id === 'B')).toBeDefined()
  })

  it('スタッフ削除時に同 id の希望休も削除される', () => {
    get().setRequest('A', [1, 2, 3])
    get().removeStaff('A')
    expect(get().requests['A']).toBeUndefined()
  })
})

describe('setStaffList', () => {
  it('staffList が完全に入れ替わる', () => {
    get().setStaffList([newStaff])
    expect(get().staffList).toHaveLength(1)
    expect(get().staffList[0].id).toBe('X')
  })
})

// ============================================================
// 月選択
// ============================================================
describe('setSelectedMonth', () => {
  it('年月が更新される', () => {
    get().setSelectedMonth(2026, 5)
    expect(get().selectedYear).toBe(2026)
    expect(get().selectedMonth).toBe(5)
  })

  it('月変更時に shiftResult がリセットされる', () => {
    get().setShiftResult({ year: 2026, month: 4 } as ShiftResult)
    get().setSelectedMonth(2026, 5)
    expect(get().shiftResult).toBeNull()
  })
})

// ============================================================
// 希望休管理
// ============================================================
describe('setRequest', () => {
  it('希望休日が設定される', () => {
    get().setRequest('C', [5, 10])
    expect(get().requests['C']).toEqual([5, 10])
  })

  it('同 id で再セットすると上書きされる', () => {
    get().setRequest('C', [5, 10])
    get().setRequest('C', [20])
    expect(get().requests['C']).toEqual([20])
  })
})

describe('toggleRequestDay', () => {
  it('未選択の日をトグルすると追加される', () => {
    get().toggleRequestDay('C', 5)
    expect(get().requests['C']).toContain(5)
  })

  it('選択済みの日をトグルすると削除される', () => {
    get().setRequest('C', [5, 10])
    get().toggleRequestDay('C', 5)
    expect(get().requests['C']).not.toContain(5)
  })

  it('トグル後はソートされている', () => {
    get().toggleRequestDay('C', 10)
    get().toggleRequestDay('C', 3)
    expect(get().requests['C']).toEqual([3, 10])
  })
})

describe('clearRequests', () => {
  it('全希望休がクリアされる', () => {
    get().setRequest('C', [1, 2])
    get().setRequest('B', [5])
    get().clearRequests()
    expect(get().requests).toEqual({})
  })
})

// ============================================================
// 非常勤指定日管理
// ============================================================
describe('setPartTimeWorkDays', () => {
  it('非常勤の指定日が設定される', () => {
    get().setPartTimeWorkDays('G', [3, 17])
    expect(get().partTimeWorkDays['G']).toEqual([3, 17])
  })

  it('同 id で再セットすると上書きされる', () => {
    get().setPartTimeWorkDays('G', [3, 17])
    get().setPartTimeWorkDays('G', [25])
    expect(get().partTimeWorkDays['G']).toEqual([25])
  })
})

describe('togglePartTimeDay', () => {
  it('未選択の日をトグルすると追加される', () => {
    get().togglePartTimeDay('G', 10)
    expect(get().partTimeWorkDays['G']).toContain(10)
  })

  it('選択済みの日をトグルすると削除される', () => {
    get().setPartTimeWorkDays('G', [10, 20])
    get().togglePartTimeDay('G', 10)
    expect(get().partTimeWorkDays['G']).not.toContain(10)
  })
})

// ============================================================
// 前月情報
// ============================================================
describe('setPrevMonthInfo', () => {
  it('lastOnCallStaffId が更新される', () => {
    get().setPrevMonthInfo({ lastOnCallStaffId: 'B' })
    expect(get().prevMonthInfo.lastOnCallStaffId).toBe('B')
  })

  it('carryOverCompDays が更新される', () => {
    get().setPrevMonthInfo({ carryOverCompDays: { C: 1 } })
    expect(get().prevMonthInfo.carryOverCompDays).toEqual({ C: 1 })
  })

  it('部分更新で他フィールドが消えない', () => {
    get().setPrevMonthInfo({ carryOverCompDays: { C: 1 } })
    get().setPrevMonthInfo({ lastOnCallStaffId: 'B' })
    expect(get().prevMonthInfo.carryOverCompDays).toEqual({ C: 1 })
  })
})

// ============================================================
// 生成結果
// ============================================================
describe('setShiftResult', () => {
  it('生成結果がセットされる', () => {
    const mockResult = { year: 2026, month: 4 } as ShiftResult
    get().setShiftResult(mockResult)
    expect(get().shiftResult).toEqual(mockResult)
  })

  it('null をセットできる', () => {
    get().setShiftResult({ year: 2026 } as ShiftResult)
    get().setShiftResult(null)
    expect(get().shiftResult).toBeNull()
  })
})

// ============================================================
// 永続化（window.api モック）
// ============================================================
describe('saveToStore', () => {
  it('storeSet("staffList", ...) が呼ばれる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().saveToStore()
    expect(mockStoreSet).toHaveBeenCalledWith('staffList', expect.any(Array))
  })
})

describe('loadFromStore', () => {
  it('storeGet("staffList") が呼ばれる', async () => {
    mockStoreGet.mockResolvedValue(null)
    await get().loadFromStore()
    expect(mockStoreGet).toHaveBeenCalledWith('staffList')
  })

  it('null が返った場合はデフォルトスタッフが保持される', async () => {
    mockStoreGet.mockResolvedValue(null)
    const defaultCount = get().staffList.length
    await get().loadFromStore()
    expect(get().staffList).toHaveLength(defaultCount)
  })

  it('保存済みデータが返った場合は staffList が復元される', async () => {
    const saved: Staff[] = [newStaff]
    mockStoreGet.mockResolvedValue(saved)
    await get().loadFromStore()
    expect(get().staffList).toEqual(saved)
  })

  it('storeGet("staffPresets") が呼ばれる', async () => {
    mockStoreGet.mockResolvedValue(null)
    await get().loadFromStore()
    expect(mockStoreGet).toHaveBeenCalledWith('staffPresets')
  })

  it('保存済みプリセットが返った場合は staffPresets が復元される', async () => {
    const savedPreset: StaffPreset = {
      id: 'preset_1',
      name: 'テストプリセット',
      staffList: [newStaff],
      createdAt: '2026-04-01T00:00:00.000Z'
    }
    mockStoreGet.mockImplementation((key: string) =>
      key === 'staffPresets' ? [savedPreset] : null
    )
    await get().loadFromStore()
    expect(get().staffPresets).toHaveLength(1)
    expect(get().staffPresets[0].name).toBe('テストプリセット')
  })
})

// ============================================================
// スタッフ構成プリセット管理
// ============================================================
describe('savePreset', () => {
  it('プリセットが staffPresets に追加される', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().savePreset('Aチーム')
    expect(get().staffPresets).toHaveLength(1)
    expect(get().staffPresets[0].name).toBe('Aチーム')
  })

  it('プリセットに現在の staffList がコピーされる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().savePreset('Aチーム')
    expect(get().staffPresets[0].staffList).toEqual(get().staffList)
  })

  it('storeSet("staffPresets", ...) が呼ばれる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().savePreset('Aチーム')
    expect(mockStoreSet).toHaveBeenCalledWith('staffPresets', expect.any(Array))
  })

  it('複数回保存すると件数が増える', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().savePreset('プリセット1')
    await get().savePreset('プリセット2')
    expect(get().staffPresets).toHaveLength(2)
  })

  it('名前が trim されて保存される', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().savePreset('  Bチーム  ')
    expect(get().staffPresets[0].name).toBe('Bチーム')
  })
})

describe('loadPreset', () => {
  const preset: StaffPreset = {
    id: 'preset_test',
    name: 'テスト構成',
    staffList: [newStaff],
    createdAt: '2026-04-01T00:00:00.000Z'
  }

  beforeEach(() => {
    useAppStore.setState({ ...initialState, staffPresets: [preset] })
  })

  it('staffList がプリセットの内容に置き換わる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().loadPreset('preset_test')
    expect(get().staffList).toEqual(preset.staffList)
  })

  it('storeSet("staffList", ...) が呼ばれる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().loadPreset('preset_test')
    expect(mockStoreSet).toHaveBeenCalledWith('staffList', preset.staffList)
  })

  it('存在しない id では staffList が変更されない', async () => {
    const before = get().staffList
    await get().loadPreset('NOTEXIST')
    expect(get().staffList).toEqual(before)
  })
})

describe('deletePreset', () => {
  const preset1: StaffPreset = {
    id: 'preset_1', name: 'プリセット1', staffList: [], createdAt: '2026-04-01T00:00:00.000Z'
  }
  const preset2: StaffPreset = {
    id: 'preset_2', name: 'プリセット2', staffList: [], createdAt: '2026-04-02T00:00:00.000Z'
  }

  beforeEach(() => {
    useAppStore.setState({ ...initialState, staffPresets: [preset1, preset2] })
  })

  it('対象プリセットが削除される', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().deletePreset('preset_1')
    expect(get().staffPresets.find(p => p.id === 'preset_1')).toBeUndefined()
  })

  it('他のプリセットは残る', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().deletePreset('preset_1')
    expect(get().staffPresets).toHaveLength(1)
    expect(get().staffPresets[0].id).toBe('preset_2')
  })

  it('storeSet("staffPresets", ...) が呼ばれる', async () => {
    mockStoreSet.mockResolvedValue(undefined)
    await get().deletePreset('preset_1')
    expect(mockStoreSet).toHaveBeenCalledWith('staffPresets', expect.any(Array))
  })
})
