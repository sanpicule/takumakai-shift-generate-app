// シフト記号の型
export type ShiftSymbol = '日' | '当' | '明' | '休' | '代' | '希' | ''

// 勤務種別
export type WorkType = '日勤専従' | '当直専従' | '日当両方' | '非常勤'

// スタッフ情報
export interface Staff {
  id: string
  name: string
  workType: WorkType
  // 当直専従でBのみ6連勤を許可（当→明パターン）
  allowExtendedNight: boolean
  // 非常勤は公休計算対象外
  isPartTime: boolean
  // 表示順
  order: number
}

// 日付情報
export interface DayInfo {
  date: number
  dayOfWeek: number // 0=日, 1=月, ..., 6=土
  isSunday: boolean
  isSaturday: boolean
  label: string // "1(月)" 形式
}

// 月間シフト（staffId → 各日のシフト記号配列、index 0 は未使用、1〜31）
export type MonthlyShifts = Record<string, ShiftSymbol[]>

// 前月情報
export interface PrevMonthInfo {
  // 前月最終日の当直者のstaffId（翌月1日が「明」になる）
  lastOnCallStaffId: string
  // 持ち越し代休（staffId → 日数）
  carryOverCompDays: Record<string, number>
}

// 非常勤スタッフの当直指定日
export type PartTimeWorkDays = Record<string, number[]>

// 希望休（staffId → 日付リスト）
export type StaffRequests = Record<string, number[]>

// シフト生成の入力
export interface ShiftInput {
  year: number
  month: number
  staffList: Staff[]
  requests: StaffRequests
  partTimeWorkDays: PartTimeWorkDays
  prevMonthInfo: PrevMonthInfo
}

// 制約違反レポート
export interface ConstraintViolation {
  type: 'warning' | 'info'
  rule: string
  message: string
}

// 集計データ（1スタッフ分）
export interface StaffSummary {
  staffId: string
  holidayCount: number    // 公休数（休の数）
  compDayCount: number    // 代休数（代の数）
  dayShiftCount: number   // 日勤数
  nightShiftCount: number // 当直数
  sundayRestCount: number // 日曜休み数
  maxConsecutiveDays: number  // 最大連勤数
  consecutiveRestCount: number // 連休数（2日以上の連続休みブロック数）
}

// シフト生成結果
export interface ShiftResult {
  shifts: MonthlyShifts
  dayInfos: DayInfo[]
  summaries: StaffSummary[]
  violations: ConstraintViolation[]
  daysInMonth: number
  year: number
  month: number
}

// スタッフ構成プリセット
export interface StaffPreset {
  id: string        // 一意ID（タイムスタンプベース）
  name: string      // ユーザーが付けた名前
  staffList: Staff[]
  createdAt: string // ISO 8601
}

// アプリ全体の設定・状態
export interface AppState {
  // スタッフ一覧
  staffList: Staff[]
  // 選択中の年月
  selectedYear: number
  selectedMonth: number
  // 希望休
  requests: StaffRequests
  // 非常勤指定日
  partTimeWorkDays: PartTimeWorkDays
  // 前月情報
  prevMonthInfo: PrevMonthInfo
  // 生成結果
  shiftResult: ShiftResult | null
}
