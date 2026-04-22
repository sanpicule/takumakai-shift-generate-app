# カバレッジ履歴

`npm run test:coverage` を実行した際の結果を記録する。
リリース前に基準値を満たしているか確認すること。

## 合格ライン（strategy.md より）

| レイヤー | ライン | ブランチ |
|---------|--------|---------|
| `engine/generator.ts` | 90% | 85% |
| `store/useAppStore.ts` | 70% | 60% |

---

## 記録

### 2026-04-23

**実施内容:** Phase B アルゴリズム再設計・R2/R12 バグ修正後（140テスト）
- generator.ts: Phase B を per-staff → per-date 処理に全面再設計
  - `placeRestForDay` ヘルパー追加（日付単位で coverage check しながら公休を配置）
  - B-4 補填パスに `selectEvenly` 導入（月前半集中を排除）
  - STEP 5 / STEP 6 に capacity check 追加（公休確保スロット保護）
- fixtures.ts: staffBothF（F）追加 → `sevenStaffList`（7名構成）新設
- generator.test.ts: 19テスト追加（R2/R3 均等分散・公休均等分散・7名実運用テスト）

| ファイル | Statements | Branches | Functions | Lines | 判定 |
|---------|-----------|---------|-----------|-------|------|
| `engine/generator.ts` | 89.91% | 81.84% | 95.34% | 90.51% | ⚠️ Branch が 85% 目標に対し未達（アルゴリズム増大による未カバー分岐増加） |
| `store/useAppStore.ts` | 97.10% | 100% | 94.44% | 96.49% | ✅ 全項目合格 |
| **合計** | **90.84%** | **82.75%** | **95.08%** | **91.31%** | ✅ |

**未カバー行:**
- `generator.ts` L533-555, 562, 651（B-4補填・STEP 6の一部分岐）
- `useAppStore.ts` L98, 126（catch ブロック）

**備考:**
- Phase B 再設計により旧バグ（R2 weekday violations 5件、R12 代休翌月繰越）が解消
- ブランチカバレッジは Phase B の `placeRestForDay` ガード分岐が増加したことで目標を下回る
- 次回優先対象: B-4 Pass 3（順次フォールバック）の網羅

---

### 2026-04-21

**実施内容:** ユニットテスト初期実装完了（121テスト）
- engine: buildDayInfos / canWork / canDoNightShift / canDoDayShift / recentNightCount / generateShift 統合
- output: generateMarkdownTable / generateCSV（BOM・連休数列含む）
- store: スタッフCRUD / 月選択 / 希望休 / 非常勤指定日 / 前月情報 / 永続化 / **プリセット管理（savePreset/loadPreset/deletePreset）**

| ファイル | Statements | Branches | Functions | Lines | 判定 |
|---------|-----------|---------|-----------|-------|------|
| `engine/generator.ts` | 95.39% | 84.86% | 100% | 97.02% | ⚠️ Branch が 85% 目標に対し 0.14% 未達 |
| `store/useAppStore.ts` | 97.10% | 100% | 94.44% | 96.49% | ✅ 全項目合格 |
| **合計** | **95.69%** | **85.97%** | **97.70%** | **96.93%** | ✅ |

**未カバー行:**
- `generator.ts` L238-242, 302, 396, 493（エッジケースの分岐）
- `useAppStore.ts` L98, 126（catch ブロック内の try/catch 無視パス）

**備考:**
- engine ブランチカバレッジが目標 85% にわずかに届かず（84.86%）。未カバーの分岐は主に `canWork`/`canDoNightShift` の境界条件。
- 次回テスト追加時の優先対象: `generator.ts` のエッジケース分岐（月末当直→翌月1日明け）

---

> 新しい記録は上の `## 記録` セクション直下に追加する（降順）。
