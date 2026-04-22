# テスト戦略

## 方針

このアプリの価値の中心は **シフト生成エンジン（generator.ts）** にある。
ビジネスルール（R1〜R16）の正確な実装こそが品質の核であるため、
テスト投資はエンジン層に集中させる。UI・IPC層への投資は最小限にとどめる。

---

## テストレベルと対象

### 1. ユニットテスト（最優先）

| 対象 | ファイル | 優先度 |
|------|---------|--------|
| シフト生成エンジン | `engine/generator.ts` | ★★★ 最高 |
| 出力フォーマット生成 | `engine/generator.ts`（generateMarkdownTable / generateCSV） | ★★☆ 高 |
| 状態管理 | `store/useAppStore.ts` | ★☆☆ 中 |

- **spec ファイル:** `docs/tests/unit-test/*.md`
- **実装先:** `src/renderer/src/**/__tests__/` または `src/**/*.test.ts`

### 2. 統合テスト（手動）

シフト生成の入出力全体を通したシナリオテスト。
自動化は行わず、人手で実施してチェックリストに記録する。

- **spec ファイル:** `docs/tests/integration-test.md`
- **成果物:** `docs/tests/results/<テストID>_<概要>/`

### 3. E2E テスト（対象外）

Electron の UI 操作全体を通したテストは現時点でスコープ外とする。
（スタッフ増減・画面遷移などの UI 挙動確認は手動で行う）

---

## テストフレームワーク構成

| ツール | 用途 |
|--------|------|
| **Vitest** | ユニットテストランナー（Vite ネイティブで設定が軽い） |
| **@vitest/coverage-v8** | カバレッジ計測 |
| **jsdom** | store テスト用 DOM 環境 |

```bash
npm run test           # 全テスト実行
npm run test:watch     # ウォッチモード
npm run test:coverage  # カバレッジ付き実行
```

---

## 実行タイミング

| タイミング | コマンド | 対象 |
|-----------|---------|------|
| 開発中（ウォッチ） | `npm run test:watch` | 変更ファイルに関連するテスト |
| コミット前 | `npm run test` | 全ユニットテスト |
| リリース前 | `npm run test:coverage` | 全ユニットテスト＋カバレッジ確認 |
| リリース前（手動） | チェックリスト参照 | 統合テスト（docs/test-spec.md） |

> CI/CD は現時点で未構築。将来 GitHub Actions を導入する場合は
> PR 時に `npm run test` が自動実行されるよう設定する。

---

## カバレッジ基準

### 合格ライン

| レイヤー | ライン | ブランチ | 備考 |
|---------|--------|---------|------|
| `engine/generator.ts` | **90%** | **85%** | ビジネスルールの核心。最優先 |
| `store/useAppStore.ts` | **70%** | **60%** | 永続化（IPC依存）はモック必須 |
| `engine/generator.ts`（出力関数） | **80%** | — | 形式チェックが主 |

> カバレッジが合格ラインを下回る場合はリリースしない。
> ただし **カバレッジはあくまで指標**。数値を満たすだけでなく、
> 重要なルール（R1〜R5・R13）を検証するテストが存在することを必ず確認する。

### カバレッジから除外するもの

- `src/main/index.ts`（Electron メインプロセス。Node.js 環境依存）
- `src/preload/index.ts`（IPC ブリッジ。Electron 環境依存）
- `src/renderer/src/pages/*.tsx`（UI コンポーネント。E2E 対象外）
- `src/renderer/src/App.tsx`
- `src/renderer/src/main.tsx`

---

## テスト実装の優先順位

フェーズに分けて実装する。

### Phase 1: エンジンのコアロジック（最初に実装する）

`engine.md` の以下を優先:

1. `buildDayInfos` — カレンダー構築
2. `getConsecutiveWorkDays` — 連勤日数計算
3. `canWork` / `canDoDayShift` / `canDoNightShift` — 勤務可否判定
4. `generateShift` の R1〜R5 必須制約検証
5. `generateShift` の R13 公休数検証（緩和禁止のため最重要）

### Phase 2: 出力フォーマット

`output.md` 全項目。ヘッダー・フッター・集計列7列の存在確認を中心に。

### Phase 3: 状態管理

`store.md` の CRUD アクションと永続化モックテスト。

---

## 合格の定義（リリース判定）

以下をすべて満たす場合にリリース可とする。

- [ ] `npm run test` が全件グリーン
- [ ] `npm run test:coverage` で各レイヤーのカバレッジが基準値以上
- [ ] R1〜R5（必須制約）・R13（公休数）のテストケースがすべてグリーン
- [ ] 統合テスト（`docs/tests/integration-test.md` のチェックリスト）で D1〜D5・H1〜H7 がすべて OK
