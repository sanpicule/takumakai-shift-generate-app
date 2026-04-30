import { create } from 'zustand'
import type {
  Staff,
  StaffPreset,
  StaffRequests,
  PartTimeWorkDays,
  PrevMonthInfo,
  ShiftResult,
  SavedShift,
  WorkType,
  ShiftSymbol
} from '../types'
import { calcSummaries } from '../engine/generator'

// デフォルトスタッフ（卓麻会の標準構成）
const DEFAULT_STAFF: Staff[] = [
  { id: 'A', name: 'A', workType: '日勤専従', allowExtendedNight: false, isPartTime: false, order: 0 },
  { id: 'B', name: 'B', workType: '当直専従', allowExtendedNight: true, isPartTime: false, order: 1 },
  { id: 'C', name: 'C', workType: '日当両方', allowExtendedNight: false, isPartTime: false, order: 2 },
  { id: 'D', name: 'D', workType: '日当両方', allowExtendedNight: false, isPartTime: false, order: 3 },
  { id: 'E', name: 'E', workType: '日当両方', allowExtendedNight: false, isPartTime: false, order: 4 },
  { id: 'F', name: 'F', workType: '日当両方', allowExtendedNight: false, isPartTime: false, order: 5 },
  { id: 'G', name: 'G', workType: '非常勤', allowExtendedNight: false, isPartTime: true, order: 6 }
]

const now = new Date()

interface AppStore {
  // スタッフ一覧
  staffList: Staff[]
  setStaffList: (list: Staff[]) => void
  addStaff: (staff: Staff) => void
  updateStaff: (id: string, updates: Partial<Staff>) => void
  removeStaff: (id: string) => void

  // 対象年月
  selectedYear: number
  selectedMonth: number
  setSelectedMonth: (year: number, month: number) => void

  // 希望休（staffId → 日付リスト）：選択中の月のみ
  requests: StaffRequests
  setRequest: (staffId: string, days: number[]) => void
  toggleRequestDay: (staffId: string, day: number) => void
  clearRequests: () => void

  // 非常勤指定日（staffId → 日付リスト）：選択中の月のみ
  partTimeWorkDays: PartTimeWorkDays
  setPartTimeWorkDays: (staffId: string, days: number[]) => void
  togglePartTimeDay: (staffId: string, day: number) => void

  // 月別の希望休・非常勤指定日（`${year}-${month}` をキーとした永続化用）
  allRequests: Record<string, StaffRequests>
  allPartTimeWorkDays: Record<string, PartTimeWorkDays>

  // 前月情報
  prevMonthInfo: PrevMonthInfo
  setPrevMonthInfo: (info: Partial<PrevMonthInfo>) => void

  // 生成結果
  shiftResult: ShiftResult | null
  setShiftResult: (result: ShiftResult | null) => void
  updateShiftCell: (staffId: string, day: number, symbol: ShiftSymbol) => void

  // スタッフ構成プリセット
  staffPresets: StaffPreset[]
  savePreset: (name: string) => Promise<void>
  loadPreset: (id: string) => Promise<void>
  deletePreset: (id: string) => Promise<void>

  // 保存済みシフト
  savedShifts: SavedShift[]
  saveCurrentShift: () => Promise<void>
  deleteSavedShift: (id: string) => Promise<void>
  loadSavedShift: (savedShift: SavedShift) => void

  // データの永続化
  loadFromStore: () => Promise<void>
  saveToStore: () => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  staffList: DEFAULT_STAFF,
  staffPresets: [],
  savedShifts: [],
  selectedYear: now.getFullYear(),
  selectedMonth: now.getMonth() + 1,
  requests: {},
  partTimeWorkDays: {},
  allRequests: {},
  allPartTimeWorkDays: {},
  prevMonthInfo: {
    lastOnCallStaffId: '',
    carryOverCompDays: {}
  },
  shiftResult: null,

  setStaffList: (list) => set({ staffList: list }),

  addStaff: (staff) =>
    set((state) => ({
      staffList: [...state.staffList, { ...staff, order: state.staffList.length }]
    })),

  updateStaff: (id, updates) =>
    set((state) => ({
      staffList: state.staffList.map((s) => (s.id === id ? { ...s, ...updates } : s))
    })),

  removeStaff: (id) =>
    set((state) => ({
      staffList: state.staffList.filter((s) => s.id !== id),
      requests: Object.fromEntries(Object.entries(state.requests).filter(([k]) => k !== id)),
      partTimeWorkDays: Object.fromEntries(
        Object.entries(state.partTimeWorkDays).filter(([k]) => k !== id)
      )
    })),

  setSelectedMonth: (year, month) => {
    // 月が切り替わったら、その月専用の希望休・非常勤指定日をロード
    const { allRequests, allPartTimeWorkDays } = get()
    const key = `${year}-${month}`
    set({
      selectedYear: year,
      selectedMonth: month,
      shiftResult: null,
      requests: allRequests[key] ?? {},
      partTimeWorkDays: allPartTimeWorkDays[key] ?? {}
    })
  },

  setRequest: (staffId, days) => {
    const { selectedYear, selectedMonth } = get()
    const key = `${selectedYear}-${selectedMonth}`
    set((state) => {
      const newRequests = { ...state.requests, [staffId]: days }
      return { requests: newRequests, allRequests: { ...state.allRequests, [key]: newRequests } }
    })
    try { window.api.storeSet('allRequests', get().allRequests).catch(() => {}) } catch {}
  },

  toggleRequestDay: (staffId, day) => {
    const { selectedYear, selectedMonth } = get()
    const key = `${selectedYear}-${selectedMonth}`
    set((state) => {
      const current = state.requests[staffId] || []
      const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b)
      const newRequests = { ...state.requests, [staffId]: updated }
      return { requests: newRequests, allRequests: { ...state.allRequests, [key]: newRequests } }
    })
    try { window.api.storeSet('allRequests', get().allRequests).catch(() => {}) } catch {}
  },

  clearRequests: () => {
    const { selectedYear, selectedMonth } = get()
    const key = `${selectedYear}-${selectedMonth}`
    set((state) => ({ requests: {}, allRequests: { ...state.allRequests, [key]: {} } }))
    try { window.api.storeSet('allRequests', get().allRequests).catch(() => {}) } catch {}
  },

  setPartTimeWorkDays: (staffId, days) => {
    const { selectedYear, selectedMonth } = get()
    const key = `${selectedYear}-${selectedMonth}`
    set((state) => {
      const newPTW = { ...state.partTimeWorkDays, [staffId]: days }
      return { partTimeWorkDays: newPTW, allPartTimeWorkDays: { ...state.allPartTimeWorkDays, [key]: newPTW } }
    })
    try { window.api.storeSet('allPartTimeWorkDays', get().allPartTimeWorkDays).catch(() => {}) } catch {}
  },

  togglePartTimeDay: (staffId, day) => {
    const { selectedYear, selectedMonth } = get()
    const key = `${selectedYear}-${selectedMonth}`
    set((state) => {
      const current = state.partTimeWorkDays[staffId] || []
      const updated = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b)
      const newPTW = { ...state.partTimeWorkDays, [staffId]: updated }
      return { partTimeWorkDays: newPTW, allPartTimeWorkDays: { ...state.allPartTimeWorkDays, [key]: newPTW } }
    })
    try { window.api.storeSet('allPartTimeWorkDays', get().allPartTimeWorkDays).catch(() => {}) } catch {}
  },

  setPrevMonthInfo: (info) =>
    set((state) => ({ prevMonthInfo: { ...state.prevMonthInfo, ...info } })),

  setShiftResult: (result) => set({ shiftResult: result }),

  updateShiftCell: (staffId, day, symbol) => {
    set((state) => {
      if (!state.shiftResult) return state
      const oldShifts = state.shiftResult.shifts
      const arr = [...oldShifts[staffId]] as ShiftSymbol[]
      const prevSymbol = arr[day]

      arr[day] = symbol

      // 当直 → 翌日を明に自動設定
      if (symbol === '当' && day < arr.length - 1) {
        arr[day + 1] = '明'
      }
      // 当直を別のものに変更 → 翌日の明をクリア
      if (prevSymbol === '当' && symbol !== '当' && day < arr.length - 1) {
        if (arr[day + 1] === '明') arr[day + 1] = ''
      }

      const newShifts = { ...oldShifts, [staffId]: arr }
      const newSummaries = calcSummaries(
        state.staffList,
        newShifts,
        state.shiftResult.dayInfos
      )
      return {
        shiftResult: {
          ...state.shiftResult,
          shifts: newShifts,
          summaries: newSummaries
        }
      }
    })
  },

  savePreset: async (name) => {
    try {
      const { staffList, staffPresets } = get()
      const newPreset: StaffPreset = {
        id: `preset_${Date.now()}`,
        name: name.trim(),
        staffList: [...staffList],
        createdAt: new Date().toISOString()
      }
      const updated = [...staffPresets, newPreset]
      set({ staffPresets: updated })
      await window.api.storeSet('staffPresets', updated)
    } catch {
      // storeが利用できない場合は無視
    }
  },

  loadPreset: async (id) => {
    try {
      const { staffPresets } = get()
      const preset = staffPresets.find((p) => p.id === id)
      if (!preset) return
      set({ staffList: preset.staffList })
      await window.api.storeSet('staffList', preset.staffList)
    } catch {
      // storeが利用できない場合は無視
    }
  },

  deletePreset: async (id) => {
    try {
      const { staffPresets } = get()
      const updated = staffPresets.filter((p) => p.id !== id)
      set({ staffPresets: updated })
      await window.api.storeSet('staffPresets', updated)
    } catch {
      // storeが利用できない場合は無視
    }
  },

  saveCurrentShift: async () => {
    try {
      const { shiftResult, staffList, savedShifts } = get()
      if (!shiftResult) return
      const newSaved: SavedShift = {
        id: `shift_${Date.now()}`,
        year: shiftResult.year,
        month: shiftResult.month,
        shiftResult,
        staffList: [...staffList],
        savedAt: new Date().toISOString()
      }
      const updated = [...savedShifts, newSaved]
      set({ savedShifts: updated })
      await window.api.storeSet('savedShifts', updated)
    } catch {
      // storeが利用できない場合は無視
    }
  },

  deleteSavedShift: async (id) => {
    try {
      const { savedShifts } = get()
      const updated = savedShifts.filter((s) => s.id !== id)
      set({ savedShifts: updated })
      await window.api.storeSet('savedShifts', updated)
    } catch {
      // storeが利用できない場合は無視
    }
  },

  loadSavedShift: (savedShift) => {
    set({
      shiftResult: savedShift.shiftResult,
      staffList: savedShift.staffList
    })
  },

  loadFromStore: async () => {
    try {
      const api = window.api
      const staffList = (await api.storeGet('staffList')) as Staff[] | null
      if (staffList && staffList.length > 0) {
        set({ staffList })
      }
      const staffPresets = (await api.storeGet('staffPresets')) as StaffPreset[] | null
      if (staffPresets && staffPresets.length > 0) {
        set({ staffPresets })
      }
      const savedShifts = (await api.storeGet('savedShifts')) as SavedShift[] | null
      if (savedShifts && savedShifts.length > 0) {
        set({ savedShifts })
      }
      const allRequests = (await api.storeGet('allRequests')) as Record<string, StaffRequests> | null
      if (allRequests) {
        const { selectedYear, selectedMonth } = get()
        const key = `${selectedYear}-${selectedMonth}`
        set({ allRequests, requests: allRequests[key] ?? {} })
      }
      const allPartTimeWorkDays = (await api.storeGet('allPartTimeWorkDays')) as Record<string, PartTimeWorkDays> | null
      if (allPartTimeWorkDays) {
        const { selectedYear, selectedMonth } = get()
        const key = `${selectedYear}-${selectedMonth}`
        set({ allPartTimeWorkDays, partTimeWorkDays: allPartTimeWorkDays[key] ?? {} })
      }
    } catch {
      // storeが利用できない場合はデフォルト値を使用
    }
  },

  saveToStore: async () => {
    try {
      const api = window.api
      const { staffList } = get()
      await api.storeSet('staffList', staffList)
    } catch {
      // storeが利用できない場合は無視
    }
  }
}))

// WorkTypeの表示名
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  '日勤専従': '日勤専従（日勤のみ）',
  '当直専従': '当直専従（当直のみ）',
  '日当両方': '日勤・当直両方',
  '非常勤': '非常勤（当直のみ・指定日）'
}
