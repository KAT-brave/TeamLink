# TeamLink 要件定義 (requirements.md)

Slack風チームチャットアプリの要件を整理する。現状は `current-state.md`、
機能単位の実装計画は `implementation-plan.md` を参照。

## 技術スタック(確定)
| 層 | 採用 | 備考 |
| --- | --- | --- |
| バックエンド | **Ruby on Rails (APIモード)** | 近隣 EventPlanner と同系 |
| リアルタイム | **ActionCable (WebSocket)** | Rails標準 |
| データベース | **PostgreSQL** | 全文検索(pg_search / tsvector)を活用 |
| フロントエンド | **React + Vite (TypeScript)** | 近隣プロジェクトと統一 |
| ファイル保存 | **Active Storage** | 開発=ローカルディスク、将来=S3等 |
| 認証 | セッション or JWT(PR1で確定) | Devise / devise-jwt を候補 |
| 実行環境 | **docker-compose**(app/db) | ローカル起動を統一 |

主要gem/lib方針: `rspec-rails`(テスト), `pg`, `active_storage`, `pg_search`(検索),
`jbuilder` or `alba`(JSON), フロントは `vitest` + `@testing-library/react`, `zustand`等の軽量state。

## 非機能要件
- **リアルタイム性**: メッセージ/リアクション/未読は ActionCable でリアルタイム反映。
- **認証・認可**: ワークスペース/チャンネルのメンバーシップとロール(owner/admin/member)で
  操作可否を制御。プライベートチャンネルは非メンバーに不可視。
- **ファイルストレージ**: Active Storage。サイズ・MIME制限を設ける。
- **検索**: PostgreSQL 全文検索。ワークスペース/権限スコープ内に限定。
- **ページング**: メッセージはカーソルベース(created_at + id)で無限スクロール。
- **監査/整合**: 削除は論理削除(soft delete)を基本とし、スレッド/リアクション整合を保つ。

## スコープ線引き
- **MVP**: 認証 → ワークスペース/メンバー → チャンネル → メッセージ(REST) → リアルタイム化
- **拡張**: スレッド → リアクション → メンション → DM → 添付 → 検索 → 通知
- **将来(範囲外)**: 音声/ビデオ通話、外部連携(SlackインポートやOAuthログイン)、
  グループDM、既読の詳細表示、モバイルアプリ

## 想定データモデル(概要)
| モデル | 主なカラム | 関連 |
| --- | --- | --- |
| `users` | name, email, password_digest, avatar, status | has_many memberships |
| `workspaces` | name, slug, owner_id | has_many channels, memberships |
| `workspace_memberships` | user_id, workspace_id, role | join |
| `channels` | workspace_id, name, kind(public/private), archived | has_many messages |
| `channel_memberships` | user_id, channel_id, last_read_at | join(参加/未読基点) |
| `messages` | channel_id, user_id, body, parent_id(スレッド), edited_at, deleted_at | has_many reactions, mentions, attachments |
| `reactions` | message_id, user_id, emoji | unique(message,user,emoji) |
| `mentions` | message_id, mentioned_user_id | 通知の起点 |
| `direct_message_conversations` | workspace_id | has_many dm_participants, messages |
| `dm_participants` | conversation_id, user_id | join |
| `attachments` | Active Storage (message に添付) | polymorphic |
| `message_reads` | user_id, channel_id/conversation_id, last_read_message_id | 未読計算 |

※ スレッドは `messages.parent_id` の自己参照で表現。DM は channel と別系統(conversation)で扱う。

## 機能要件(18機能 / 概要・受け入れ条件・データと権限)

### 1. ユーザー登録
- 概要: email/パスワード/表示名で新規登録。
- 受け入れ条件: 有効な入力で登録できログイン状態になる。email重複はエラー。
- データ/権限: `users` 追加。認証不要。

### 2. ログイン/ログアウト
- 概要: 認証情報でログイン、セッション/トークン破棄でログアウト。
- 受け入れ条件: 正しい資格情報で成功、誤りで失敗。ログアウト後は保護APIが401。
- データ/権限: セッション or JWT。

### 3. プロフィール設定
- 概要: 表示名/アバター/ステータスの取得・更新。
- 受け入れ条件: `GET /me` で自分の情報、`PATCH /me` で更新が反映。
- データ/権限: 本人のみ更新可。

### 4. ワークスペース作成
- 概要: ワークスペースを新規作成し作成者を owner に。
- 受け入れ条件: 作成後、作成者が owner として参加済み、デフォルトチャンネル(general)を保有。
- データ/権限: `workspaces` + `workspace_memberships(owner)`。ログイン必須。

### 5. メンバー招待/退出/管理
- 概要: メンバー招待(email)、退出、ロール変更/除名。
- 受け入れ条件: admin/owner が招待・除名・ロール変更可能。member は自身の退出のみ。
- データ/権限: `workspace_memberships`。ロールで制御。

### 6. パブリックチャンネル
- 概要: ワークスペース内の公開チャンネル作成・一覧。
- 受け入れ条件: メンバーは一覧・閲覧・参加が可能。
- データ/権限: `channels(kind=public)`。

### 7. プライベートチャンネル
- 概要: 招待メンバーのみ参加/可視の非公開チャンネル。
- 受け入れ条件: 非メンバーには一覧・閲覧・検索で不可視。
- データ/権限: `channels(kind=private)` + `channel_memberships`。

### 8. チャンネル参加/退出
- 概要: パブリックへの参加、任意チャンネルからの退出。
- 受け入れ条件: 参加後にメッセージ取得可能、退出後は不可(privateは再参加に招待要)。
- データ/権限: `channel_memberships`。

### 9. メッセージ投稿/編集/削除
- 概要: チャンネルへの投稿、本人による編集・削除(論理削除)。
- 受け入れ条件: 投稿が永続化・取得可能。編集で `edited_at` 更新。削除で本文非表示。
- データ/権限: `messages`。編集/削除は投稿者(削除はadminも可)。

### 10. WebSocketによるリアルタイム通信
- 概要: 投稿/編集/削除/リアクション/未読を接続クライアントへ即時配信。
- 受け入れ条件: 2クライアントで一方の投稿が他方へリロード無しで反映。
- データ/権限: ActionCable(チャンネル購読はメンバーのみ)。

### 11. スレッド返信
- 概要: メッセージへの返信スレッド。
- 受け入れ条件: 親メッセージに返信数表示、スレッド内の一覧取得・投稿が可能。
- データ/権限: `messages.parent_id`。

### 12. 絵文字リアクション
- 概要: メッセージへの絵文字リアクション付与/解除。
- 受け入れ条件: 同一ユーザー・同一絵文字は1つ。集計数がリアルタイム反映。
- データ/権限: `reactions`(unique制約)。

### 13. メンション
- 概要: `@user` でメンション。本文中を解析し保存。
- 受け入れ条件: メンションされたユーザーに通知が生成される(機能18)。
- データ/権限: `mentions`。

### 14. ダイレクトメッセージ
- 概要: ユーザー間の1:1 DM。
- 受け入れ条件: 相手を選んで会話開始、メッセージ送受信がリアルタイム。
- データ/権限: `direct_message_conversations` + `dm_participants`。参加者のみ。

### 15. メッセージ検索
- 概要: ワークスペース内メッセージの全文検索。
- 受け入れ条件: キーワードで該当メッセージを権限スコープ内で返す。
- データ/権限: PostgreSQL全文検索。可視チャンネル/DMのみ対象。

### 16. 画像/動画/ファイル添付
- 概要: メッセージへのファイル添付とプレビュー。
- 受け入れ条件: アップロード→表示/ダウンロード可能。サイズ/MIME制限。
- データ/権限: Active Storage。

### 17. 未読通知
- 概要: チャンネル/DMごとの未読件数表示。
- 受け入れ条件: 新着で未読カウント増、閲覧で `last_read_at` 更新しゼロ化。
- データ/権限: `channel_memberships.last_read_at` / `message_reads`。

### 18. メンション通知
- 概要: 自分宛メンション/DMの通知。
- 受け入れ条件: メンション発生で通知一覧に表示、既読化可能。
- データ/権限: `mentions` + 通知テーブル(または集約)。
