import { useState } from 'react'
import { useAppStore, WORK_TYPE_LABELS } from '../store/useAppStore'
import type { Staff, WorkType } from '../types'

const WORK_TYPES: WorkType[] = ['日勤専従', '当直専従', '日当両方', '非常勤']

const WORK_TYPE_COLORS: Record<WorkType, string> = {
  '日勤専従': 'bg-blue-100 text-blue-700',
  '当直専従': 'bg-pink-100 text-pink-700',
  '日当両方': 'bg-violet-100 text-violet-700',
  '非常勤': 'bg-amber-100 text-amber-700'
}

const DEFAULT_NEW_STAFF: Omit<Staff, 'id' | 'order'> = {
  name: '',
  workType: '日当両方',
  allowExtendedNight: false,
  isPartTime: false
}

interface StaffFormProps {
  initial: Partial<Staff>
  onSave: (data: Omit<Staff, 'id' | 'order'>) => void
  onCancel: () => void
  isNew?: boolean
}

function StaffForm({ initial, onSave, onCancel, isNew }: StaffFormProps) {
  const [name, setName] = useState(initial.name || '')
  const [workType, setWorkType] = useState<WorkType>(initial.workType || '日当両方')
  const [allowExtendedNight, setAllowExtendedNight] = useState(
    initial.allowExtendedNight || false
  )

  const isPartTime = workType === '非常勤'

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      workType,
      allowExtendedNight: workType === '当直専従' ? allowExtendedNight : false,
      isPartTime
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-slate-700">{isNew ? '新規スタッフ追加' : 'スタッフ編集'}</h3>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1.5">名前・ID</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: A、山田 太郎"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">勤務種別</label>
        <div className="grid grid-cols-2 gap-2">
          {WORK_TYPES.map((wt) => (
            <button
              key={wt}
              onClick={() => setWorkType(wt)}
              className={`px-3 py-2.5 rounded-lg text-sm text-left border-2 transition-all ${
                workType === wt
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <p className="font-medium">{wt}</p>
              <p className="text-xs mt-0.5 opacity-70">
                {wt === '日勤専従' && '日勤のみ担当'}
                {wt === '当直専従' && '当直のみ担当'}
                {wt === '日当両方' && '日勤・当直を交互'}
                {wt === '非常勤' && '指定日のみ当直'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {workType === '当直専従' && (
        <div className="flex items-start gap-3 bg-slate-50 rounded-lg px-4 py-3">
          <input
            type="checkbox"
            id="allowExtended"
            checked={allowExtendedNight}
            onChange={(e) => setAllowExtendedNight(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600"
          />
          <label htmlFor="allowExtended" className="text-sm text-slate-600 cursor-pointer">
            <span className="font-medium">6連勤パターンを許可</span>
            <br />
            <span className="text-xs text-slate-400">当→明→当→明→当→明の連続パターンを認める</span>
          </label>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {isNew ? '追加する' : '保存する'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const { staffList, addStaff, updateStaff, removeStaff, saveToStore } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  function handleAdd(data: Omit<Staff, 'id' | 'order'>) {
    const id =
      data.name.length === 1 && /[A-Z]/.test(data.name)
        ? data.name
        : `staff_${Date.now()}`
    addStaff({ ...data, id, order: staffList.length })
    setIsAdding(false)
    handleSave()
  }

  function handleUpdate(id: string, data: Omit<Staff, 'id' | 'order'>) {
    updateStaff(id, data)
    setEditingId(null)
    handleSave()
  }

  function handleRemove(id: string, name: string) {
    if (confirm(`「${name}」を削除しますか？\n関連する希望休・指定日も削除されます。`)) {
      removeStaff(id)
      handleSave()
    }
  }

  async function handleSave() {
    await saveToStore()
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  return (
    <div className="flex-1 overflow-auto p-6 fade-in">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">スタッフ管理</h1>
            <p className="text-slate-500 text-sm mt-1">勤務種別・条件を設定してください</p>
          </div>
          {savedMsg && (
            <span className="bg-green-100 text-green-700 text-sm px-3 py-1.5 rounded-full font-medium">
              ✓ 保存しました
            </span>
          )}
        </div>

        {/* 勤務種別の説明 */}
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
          <p className="font-medium mb-1">勤務種別について</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            <p>🌞 日勤専従 — 日勤のみ（Aタイプ）</p>
            <p>🌙 当直専従 — 当直のみ（Bタイプ）</p>
            <p>🔄 日当両方 — 日勤・当直両方（C〜Fタイプ）</p>
            <p>📅 非常勤 — 指定日のみ当直（Gタイプ）</p>
          </div>
        </div>

        {/* スタッフ一覧 */}
        <div className="space-y-2">
          {staffList
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((staff) =>
              editingId === staff.id ? (
                <StaffForm
                  key={staff.id}
                  initial={staff}
                  onSave={(data) => handleUpdate(staff.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  key={staff.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                    {staff.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{staff.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORK_TYPE_COLORS[staff.workType]}`}
                      >
                        {staff.workType}
                      </span>
                      {staff.allowExtendedNight && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          6連勤許可
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(staff.id)}
                      className="text-sm text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleRemove(staff.id, staff.name)}
                      className="text-sm text-slate-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            )}
        </div>

        {/* 新規追加フォーム or ボタン */}
        {isAdding ? (
          <StaffForm
            initial={DEFAULT_NEW_STAFF}
            onSave={handleAdd}
            onCancel={() => setIsAdding(false)}
            isNew
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 rounded-xl py-3.5 text-sm font-medium transition-colors"
          >
            ＋ スタッフを追加
          </button>
        )}

        {/* 凡例 */}
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 mb-2">各勤務種別の詳細</p>
          <div className="space-y-1.5">
            {WORK_TYPES.map((wt) => (
              <div key={wt} className="flex items-start gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${WORK_TYPE_COLORS[wt]} flex-shrink-0`}>
                  {wt}
                </span>
                <span className="text-xs text-slate-500">{WORK_TYPE_LABELS[wt]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
