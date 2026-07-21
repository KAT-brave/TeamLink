# TeamLink

## 概要
TeamLink は Slack風のチームチャットアプリです。
バックエンド(Rails API) / フロントエンド(React + Vite) / PostgreSQL で構成します。

## 機能
- ユーザー認証(登録 / ログイン / ログアウト)
- ワークスペース
  - 作成(作成者が所有者=owner になる)
  - 招待コードによる参加(コードは再発行可能。再発行後、古いコードは無効)
  - メンバー管理(一覧 / 自主退出 / 管理者によるメンバー削除)
  - 権限: **owner**(全操作) / **admin**(名前編集・メンバー削除・招待コード操作) / **member**(閲覧・自主退出)
  - owner の退出は「未対応」ではなく、**仕様としてブロック**(所有権移譲またはワークスペース削除が必要)

## ローカル開発環境

### 前提
Docker / Docker Compose を使用します。DB はホスト側 5434 番ポートで公開します
(他プロジェクトの 5432 との競合回避)。

### 起動
```bash
docker compose up --build
```
- バックエンド: http://localhost:3000 (API は `/api/v1` 配下)
- フロントエンド: http://localhost:5173 (`/api`・`/cable` は Rails へプロキシ)
- 初回は `backend` コンテナが `db:prepare`(作成+マイグレーション)を自動実行します。

### テスト
```bash
# バックエンド(RSpec)
cd backend && DB_HOST=localhost DB_PORT=5434 DB_USERNAME=postgres DB_PASSWORD=postgres bundle exec rspec

# フロントエンド(Vitest) / ビルド / Lint
cd frontend && npm test && npm run build && npm run lint
```

### 環境変数
`backend/.env.example` を参考に各自 `.env` を作成してください
(秘密情報は Git に登録しません)。

## 自動コードレビュー
プルリクエストの作成時・更新時(push)に、GitHub Actions 上で Claude Code による
自動コードレビューが実行され、指摘がPRコメントとして投稿されます。

- ワークフロー定義: [.github/workflows/claude-review.yml](.github/workflows/claude-review.yml)
- レビュー指針: [CLAUDE.md](CLAUDE.md)

### セットアップに必要な設定
リポジトリの `Settings → Secrets and variables → Actions` に、以下の Secret を登録してください。

| Secret 名 | 内容 |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | ローカルで `claude setup-token` を実行して取得した OAuth トークン |
