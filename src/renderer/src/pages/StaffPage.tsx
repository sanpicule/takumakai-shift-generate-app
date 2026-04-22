import { useState } from 'react'
import { useAppStore, WORK_TYPE_LABELS } from '../store/useAppStore'
import type { Staff, WorkType } from '../types'

// ISO日付文字列を "YYYY/MM/DD" 形式で返す
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

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
  const {
    staffList, addStaff, updateStaff, removeStaff, saveToStore,
    staffPresets, savePreset, loadPreset, deletePreset
  } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetMsg, setPresetMsg] = useState<string | null>(null)

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

  async function handleSavePreset() {
    if (!presetName.trim()) return
    await savePreset(presetName)
    setPresetName('')
    setIsSavingPreset(false)
    setPresetMsg('プリセットを保存しました')
    setTimeout(() => setPresetMsg(null), 2000)
  }

  async function handleLoadPreset(id: string, name: string) {
    if (!confirm(`「${name}」を読み込みますか？\n現在のスタッフ構成が置き換わります。`)) return
    await loadPreset(id)
    setPresetMsg(`「${name}」を読み込みました`)
    setTimeout(() => setPresetMsg(null), 2000)
  }

  async function handleDeletePreset(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await deletePreset(id)
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

        {/* スタッフ構成プリセット */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-700">スタッフ構成プリセット</h2>
              <p className="text-xs text-slate-400 mt-0.5">同じ構成を別の月でも使い回せます</p>
            </div>
            {presetMsg && (
              <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                ✓ {presetMsg}
              </span>
            )}
          </div>

          {/* プリセット一覧 */}
          {staffPresets.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">保存済みプリセットはありません</p>
          ) : (
            <div className="space-y-2">
              {staffPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{preset.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {preset.staffList.length}名 · {formatDate(preset.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleLoadPreset(preset.id, preset.name)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-medium transition-colors"
                    >
                      読み込む
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.id, preset.name)}
                      className="text-xs text-slate-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 現在の構成を保存 */}
          {isSavingPreset ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                placeholder="例: 2026年4月チーム、Aチーム..."
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => { setIsSavingPreset(false); setPresetName('') }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm px-3 py-2 rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSavingPreset(true)}
              className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              ＋ 現在の構成をプリセットとして保存
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
