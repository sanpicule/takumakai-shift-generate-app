# Unit Test Spec: 状態管理（Zustand Store）

対象ファイル: `src/renderer/src/store/useAppStore.ts`

---

## スタッフ管理

### `addStaff(staff)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 1 | スタッフが追加される | 新規スタッフを追加 | `staffList.length` が +1 |
| 2 | 追加されたスタッフが取得できる | 追加後に id で検索 | 追加したスタッフが存在する |

### `updateStaff(id, updates)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 3 | 指定フィールドが更新される | `name` を変更 | 対象スタッフの `name` が新しい値になる |
| 4 | 他フィールドが変わらない | `name` だけ変更 | `workType` など他フィールドは元の値のまま |
| 5 | 存在しない id は何もしない | 無効な id で更新 | `staffList` に変化なし |

### `removeStaff(id)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 6 | 対象スタッフが削除される | 存在する id を削除 | `staffList` から該当スタッフが消える |
| 7 | 他スタッフは残る | 1名削除 | 残りのスタッフが変わらない |
| 8 | 存在しない id は何もしない | 無効な id で削除 | `staffList` に変化なし |

### `setStaffList(list)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 9 | staffList が入れ替わる | 新しいリストをセット | `staffList` が新しいリストになる |

---

## 月選択

### `setSelectedMonth(year, month)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 10 | 年月が更新される | year=2026, month=5 をセット | `selectedYear = 2026`, `selectedMonth = 5` |

---

## 希望休管理

### `setRequest(staffId, days)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 11 | 希望休日が設定される | `staffId='C', days=[5,10]` | `requests['C'] = [5, 10]` |
| 12 | 上書きで更新される | 同じ staffId で再セット | 新しい days で置き換わる |

### `toggleRequestDay(staffId, day)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 13 | 未選択の日を追加 | 5日をトグル（未選択） | requests に 5 が追加される |
| 14 | 選択済みの日を削除 | 5日をトグル（選択済み） | requests から 5 が削除される |

### `clearRequests()`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 15 | 全希望休がクリアされる | clearRequests 実行 | `requests = {}` |

---

## 非常勤指定日管理

### `setPartTimeWorkDays(staffId, days)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 16 | 非常勤の指定日が設定される | `staffId='G', days=[3,17]` | `partTimeWorkDays['G'] = [3, 17]` |
| 17 | 上書きで更新される | 同じ staffId で再セット | 新しい days で置き換わる |

### `togglePartTimeDay(staffId, day)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 18 | 未選択の日を追加 | 10日をトグル（未選択） | partTimeWorkDays に 10 が追加 |
| 19 | 選択済みの日を削除 | 10日をトグル（選択済み） | partTimeWorkDays から 10 が削除 |

---

## 前月情報

### `setPrevMonthInfo(info)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 20 | lastNightStaffId が更新される | `{ lastNightStaffId: 'B' }` | `prevMonthInfo.lastNightStaffId = 'B'` |
| 21 | carryOverCompDays が更新される | `{ carryOverCompDays: { C: 1 } }` | `prevMonthInfo.carryOverCompDays = { C: 1 }` |
| 22 | 部分更新で他フィールドが消えない | lastNightStaffId のみ変更 | carryOverCompDays は元の値のまま |

---

## 生成結果

### `setShiftResult(result)`

| # | テスト内容 | 操作 | 期待結果 |
|---|-----------|------|---------|
| 23 | 生成結果がセットされる | ShiftResult オブジェクトをセット | `shiftResult` が更新される |
| 24 | null をセットできる | `setShiftResult(null)` | `shiftResult = null` |

---

## 永続化

### `saveToStore()` / `loadFromStore()`

> これらは `window.api.storeSet` / `window.api.storeGet`（IPC）に依存するため、
> ユニットテストでは `window.api` をモックして実施する。

| # | テスト内容 | モック | 期待結果 |
|---|-----------|--------|---------|
| 25 | saveToStore が storeSet を呼ぶ | `window.api.storeSet` をスパイ | `storeSet('staffList', ...)` が呼ばれる |
| 26 | loadFromStore が storeGet を呼ぶ | `window.api.storeGet` をスパイ | `storeGet('staffList')` が呼ばれる |
| 27 | loadFromStore が null を返した場合デフォルト値が使われる | `storeGet` が `null` を返す | `staffList` がデフォルトスタッフになる |
| 28 | loadFromStore が保存済みデータを復元する | `storeGet` が保存データを返す | `staffList` に保存データが反映される |
