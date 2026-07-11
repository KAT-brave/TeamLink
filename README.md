# TeamLink

## 概要
TeamLink プロジェクトのリポジトリです。

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
