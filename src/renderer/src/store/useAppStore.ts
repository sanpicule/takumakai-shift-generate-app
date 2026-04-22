import { create } from 'zustand'
import type {
  Staff,
  StaffPreset,
  StaffRequests,
  PartTimeWorkDays,
  PrevMonthInfo,
  ShiftResult,
  WorkType
} from '../types'

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

  // 希望休（staffId → 日付リスト）
  requests: StaffRequests
  setRequest: (staffId: string, days: number[]) => void
  toggleRequestDay: (staffId: string, day: number) => void
  clearRequests: () => void

  // 非常勤指定日（staffId → 日付リスト）
  partTimeWorkDays: PartTimeWorkDays
  setPartTimeWorkDays: (staffId: string, days: number[]) => void
  togglePartTimeDay: (staffId: string, day: number) => void

  // 前月情報
  prevMonthInfo: PrevMonthInfo
  setPrevMonthInfo: (info: Partial<PrevMonthInfo>) => void

  // 生成結果
  shiftResult: ShiftResult | null
  setShiftResult: (result: ShiftResult | null) => void

  // スタッフ構成プリセット
  staffPresets: StaffPreset[]
  savePreset: (name: string) => Promise<void>
  loadPreset: (id: string) => Promise<void>
  deletePreset: (id: string) => Promise<void>

  // データの永続化
  loadFromStore: () => Promise<void>
  saveToStore: () => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  staffList: DEFAULT_STAFF,
  staffPresets: [],
  selectedYear: now.getFullYear(),
  selectedMonth: now.getMonth() + 1,
  requests: {},
  partTimeWorkDays: {},
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
    set({ selectedYear: year, selectedMonth: month, shiftResult: null })
  },

  setRequest: (staffId, days) =>
    set((state) => ({ requests: { ...state.requests, [staffId]: days } })),

  toggleRequestDay: (staffId, day) =>
    set((state) => {
      const current = state.requests[staffId] || []
      const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b)
      return { requests: { ...state.requests, [staffId]: updated } }
    }),

  clearRequests: () => set({ requests: {} }),

  setPartTimeWorkDays: (staffId, days) =>
    set((state) => ({ partTimeWorkDays: { ...state.partTimeWorkDays, [staffId]: days } })),

  togglePartTimeDay: (staffId, day) =>
    set((state) => {
      const current = state.partTimeWorkDays[staffId] || []
      const updated = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => a - b)
      return { partTimeWorkDays: { ...state.partTimeWorkDays, [staffId]: updated } }
    }),

  setPrevMonthInfo: (info) =>
    set((state) => ({ prevMonthInfo: { ...state.prevMonthInfo, ...info } })),

  setShiftResult: (result) => set({ shiftResult: result }),

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
