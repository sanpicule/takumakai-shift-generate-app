# Cloudflare Pages + Access 設定手順書

LP を **GitHub Pages から Cloudflare Pages に移行** し、**Cloudflare Access** で「指定したメールアドレス（または院内ドメイン全体）からのみアクセス可能」にするための手順書。

- 所要時間：30〜60 分
- 月額費用：**0 円**（無料プランで完結。最大 50 ユーザーまで）
- 必要なもの：Cloudflare アカウント（メールアドレスのみで作成可）、GitHub への管理者権限

---

## 全体像

```
[現在] GitHub Pages（誰でもアクセス可）
   ↓ 移行
[移行後] Cloudflare Pages + Access（許可メールアドレスのみアクセス可）
```

利用者の体験：
1. ブラウザで配布 LP の URL を開く
2. メールアドレス入力画面が表示される
3. 入力したメールアドレス宛に 6 桁のコードが届く
4. コードを入力すると LP が表示される（24 時間有効）

---

## Step 1: Cloudflare アカウント作成

1. ブラウザで <https://dash.cloudflare.com/sign-up> を開く
2. メールアドレス・パスワードを入力して **Create Account**
3. 受信したメール内のリンクで認証完了

> **メモ**：法人運用するなら、後で別メンバーを招待できるよう **共用の管理用メールアドレス**（例：`it-admin@hospital.example.jp`）で作成することを推奨。

---

## Step 2: Cloudflare Pages にプロジェクトを作成（GitHub と連携）

1. ダッシュボード左メニューから **Workers & Pages** を選択
2. **Create application** → **Pages** タブ → **Connect to Git** をクリック
3. **GitHub** を選択 → **Authorize Cloudflare Pages**
4. 「Only select repositories」を選び、**`takumakai-shift-generate-app`** にチェック → **Install & Authorize**
5. 戻ってきた画面で当該リポジトリを選択 → **Begin setup**

### ビルド設定

| 項目 | 値 |
|------|----|
| Project name | `shift-app-dl`（任意。これが URL の一部になる） |
| Production branch | `main` |
| Framework preset | **None** |
| Build command | （**空欄のまま**） |
| Build output directory | `landing` |
| Root directory | （空欄のまま） |

6. **Save and Deploy** をクリック
7. 1〜2 分でビルドが終わり、`https://shift-app-dl.pages.dev/` のような URL が発行される

> **動作確認**：この時点ではまだ誰でもアクセスできる状態です。LP が正しく表示されること、最新バージョン取得・ダウンロードボタンが動くことを確認してください。

---

## Step 3: Cloudflare Zero Trust（Access）を有効化

1. ダッシュボード左メニューから **Zero Trust** を選択
2. 初回はチーム名の設定画面が出るので、`takumakai` などを入力
3. プラン選択画面では **Free** を選択（最大 50 ユーザーまで無料、クレカ不要）
4. **Subscribe** をクリックして有効化

---

## Step 4: Access Application を追加（LP に認証を被せる）

1. Zero Trust ダッシュボードで **Access** → **Applications** → **Add an application**
2. **Self-hosted** を選択

### 基本設定

| 項目 | 値 |
|------|----|
| Application name | `看護シフト生成 配布LP` |
| Session Duration | `24 hours`（再ログイン頻度。長くすると楽だがセキュリティは下がる） |
| Application domain | `shift-app-dl.pages.dev`（Step 2 で発行された URL のホスト部分のみ） |

3. **Next** をクリック

### Identity providers

- **One-time PIN** がデフォルトで有効になっている。これだけで OK
- （オプション：Google Workspace や Microsoft Entra ID を院内で使っているなら追加可能）

4. **Next** をクリック

### Policies（アクセス許可ルール）

5. **Add a policy** をクリック
6. 以下を設定：

| 項目 | 値 |
|------|----|
| Policy name | `院内スタッフ` |
| Action | **Allow** |
| Session duration | `Same as application session timeout` |

7. **Configure rules** で **Include** に以下のいずれかを設定：

**(a) 院内ドメイン全体を許可する場合（推奨）**
- Selector: `Emails ending in`
- Value: `@hospital.example.jp`（実際の院内メールドメイン）

**(b) 特定のメールアドレスのみ許可する場合**
- Selector: `Emails`
- Value: 看護師長・配布対象者のメールアドレスをカンマ区切りで列挙

8. **Next** → **Add application** で完了

---

## Step 5: 動作確認

1. シークレットウィンドウで `https://shift-app-dl.pages.dev/` を開く
2. Cloudflare の認証画面が表示される
3. 許可したメールアドレスを入力 → 受信した 6 桁コードを入力
4. LP が表示されればOK

> **トラブルシューティング**
> - 認証画面が出ない → Application domain の設定を再確認。ホスト部分だけ（`https://` なし、末尾スラッシュなし）
> - 「Access denied」になる → Policy の Include 条件と入力したメールアドレスを再確認
> - 6 桁コードが届かない → スパムフォルダ確認、または別のメールアドレスで試す

---

## Step 6: GitHub Pages を停止（任意・推奨）

CF Pages 移行後、GitHub Pages は不要になるので停止します。

1. ブラウザで <https://github.com/sanpicule/takumakai-shift-generate-app/settings/pages> を開く
2. **Build and deployment** → **Source** を **None / Disabled** に変更
3. リポジトリの `.github/workflows/pages.yml` を削除（次回の git push 時に反映）

```bash
git rm .github/workflows/pages.yml
git commit -m "chore: GitHub Pages デプロイを廃止（Cloudflare Pagesに移行済み）"
git push
```

---

## Step 7: お客様向けスライド・README の URL を更新

1. `docs/windows-install-slides.md` 内の「ダウンロードページの URL」を新しい CF Pages の URL（`https://shift-app-dl.pages.dev/` など）に書き換え
2. お問い合わせ先に「**初回アクセス時にメール認証が必要です**」の一文を追加

---

## 運用 Tips

### アクセス権を追加・削除する
Zero Trust → Access → Applications → 該当アプリ → **Policies** タブ → 編集

### アクセスログを確認する
Zero Trust → Logs → **Access** タブ
- いつ、誰が、どこからアクセスしたかが残る（医療機関の監査要件にも有用）

### 独自ドメインを設定したい場合
Cloudflare Pages → 該当プロジェクト → **Custom domains** → ドメイン追加
- 例：`download.hospital.example.jp` のように院内ドメインのサブドメインを割り当てる
- DNS レコードの追加が必要（Cloudflare に管理されているドメインなら自動）

### ビルド・デプロイの仕組み
- `main` ブランチに push すると CF Pages が自動でビルド・デプロイ
- ブランチ単位で **プレビューデプロイ** が自動生成される（`https://[branch].shift-app-dl.pages.dev/`）

---

## セキュリティ上の追加推奨

- [ ] Cloudflare アカウントに **2要素認証 (2FA)** を有効化
- [ ] 共用管理用メールアドレスではなく、個人アカウントで管理する場合は **退職時の引き継ぎ手順を文書化**
- [ ] **Access ログを定期レビュー**（不審アクセスがないか）
- [ ] 半年に 1 度、Policy の許可メールアドレス一覧を見直し

---

## 参考リンク

- Cloudflare Pages 公式：<https://developers.cloudflare.com/pages/>
- Cloudflare Access 公式：<https://developers.cloudflare.com/cloudflare-one/applications/>
- Free プランの上限：<https://developers.cloudflare.com/cloudflare-one/plans/>
