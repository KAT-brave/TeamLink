# TeamLink 現状調査 (current-state.md)

最終調査日: 2026-07-20 / 対象: `github.com/KAT-brave/TeamLink` (`main` のみ)

> **更新 (2026-07-21)**: 以下は初回調査(2026-07-20)時点のスナップショット。
> その後 PR0(Rails API + React/Vite + PostgreSQL の基盤) と
> PR1(ユーザー認証: 登録/ログイン/ログアウト/セッション保持/保護ルート) を実装済み。
> 認証は httpOnlyセッションCookie + `has_secure_password`(bcrypt) + CSRF。
> 詳細は `docs/implementation-plan.md` の PR0/PR1、および `README.md` のローカル起動を参照。

## サマリ
TeamLink は Slack風チームチャットアプリの新規プロジェクトだが、現時点では
**実質グリーンフィールド**であり、実装済みは「Claude 自動PRレビュー(CI)」のみ。
アプリケーションのソースコード(フロントエンド/バックエンド/DB/認証/テスト)は
一切存在しない。

## リポジトリ実態
tracked ファイルは以下の 5 点のみ。ブランチは `main` のみ、アプリコードは無し。

| ファイル | 役割 |
| --- | --- |
| `.github/workflows/claude-review.yml` | Claude 自動PRレビュー CI |
| `.gitignore` | `node_modules/`, `dist/`, `build/`, `.env*` 等を除外(JS/TS想定の痕跡) |
| `README.md` | CI の説明のみ(アプリの記載なし) |
| `CLAUDE.md` | レビュー観点(prototype/docs/.github 別) |
| `REVIEW.md` | レビュー出力を日本語に固定する最優先指示 |

## 実装済み機能: 自動PRレビュー CI
- 方式: 公式 code-review プラグイン(`plugins: code-review@claude-code-plugins`)
- プロンプト: `/code-review:code-review <repo>/pull/<n> --comment`
- 認証: Secret `CLAUDE_CODE_OAUTH_TOKEN` + Claude GitHub App
- トリガー: `pull_request: [opened, reopened]`(コスト抑制のため `synchronize` は不採用)
- 出力: `REVIEW.md` により日本語固定
- 権限: action `settings` で `Bash(gh api:*)` / `Bash(gh pr:*)` を許可(コメント投稿に必要)

## 12項目チェック結果

| # | 項目 | 状態 | 補足 |
| --- | --- | --- | --- |
| 1 | 技術スタック | ❌ 未実装 | コードなし。`.gitignore` に JS/TS 想定痕跡のみ。今後は Rails+PostgreSQL+React で確定(requirements.md参照) |
| 2 | FE/BE ディレクトリ構成 | ❌ なし | `frontend/`・`backend/` とも存在しない |
| 3 | データベース構成 | ❌ なし | スキーマ/マイグレーション/ORM設定なし |
| 4 | 実装済み機能 | ⚠️ CIのみ | アプリ機能は 0。唯一 自動PRレビュー |
| 5 | 未完成/途中の機能 | — | 途中のものも無し(未着手) |
| 6 | 認証機能 | ❌ なし | — |
| 7 | API エンドポイント | ❌ なし | サーバコードなし |
| 8 | WebSocket | ❌ なし | — |
| 9 | テスト | ❌ なし | テストコード/ランナー設定なし |
| 10 | GitHub Actions | ✅ あり | `claude-review.yml`(上記) |
| 11 | ローカル起動方法 | ❌ なし | 起動対象アプリ・docker-compose 等なし |
| 12 | README と実装の差異 | ⚠️ 差異あり | 下記 |

### 項目12: README と実装の差異
README には自動レビューが「プルリクエストの作成時・**更新時(push)**」に走ると記載があるが、
実際のワークフローは **`opened, reopened` のみ**(毎push の `synchronize` は不採用)。
→ **README を実態に合わせて修正する必要がある**(実装計画 PR0 で是正)。

## Slack 必須18機能の実装状況: 0/18(すべて未実装)

| 機能 | 状態 | 機能 | 状態 |
| --- | --- | --- | --- |
| ユーザー登録 | ❌ | スレッド返信 | ❌ |
| ログイン/ログアウト | ❌ | 絵文字リアクション | ❌ |
| プロフィール設定 | ❌ | メンション | ❌ |
| ワークスペース作成 | ❌ | ダイレクトメッセージ | ❌ |
| メンバー招待/退出/管理 | ❌ | メッセージ検索 | ❌ |
| パブリックチャンネル | ❌ | 画像/動画/ファイル添付 | ❌ |
| プライベートチャンネル | ❌ | 未読通知 | ❌ |
| チャンネル参加/退出 | ❌ | メンション通知 | ❌ |
| メッセージ投稿/編集/削除 | ❌ | | |
| WebSocketリアルタイム通信 | ❌ | | |

## 結論
基盤(スタック/ディレクトリ/DB/ローカル起動)から着手が必要。要件は `requirements.md`、
機能単位のPR分割計画は `implementation-plan.md` を参照。
