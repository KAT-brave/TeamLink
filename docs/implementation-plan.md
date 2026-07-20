# TeamLink 実装計画 (implementation-plan.md)

要件は `requirements.md`、現状は `current-state.md` を参照。
1つのPRが大きくなりすぎないよう **機能単位でPRを分割**する。各PRは以下の8項目を記載:
実装する機能 / 変更予定ファイル / DB変更 / API変更 / フロントエンド変更 / テスト内容 / 完了条件 / 前後の依存関係。

## 全体構成
```
TeamLink/
├─ backend/          # Rails (APIモード)
├─ frontend/         # React + Vite (TypeScript)
├─ docker-compose.yml# app / db(PostgreSQL)
└─ docs/             # 本ドキュメント群
```
- テスト方針: backend = RSpec(model/request/channel spec)、frontend = Vitest + React Testing Library。
- 各PRで既存の自動PRレビューCI(`.github/workflows/claude-review.yml`)も活用。
- API は `/api/v1` 配下、認証は PR1 で確定(以降のAPIは要ログイン)。

## PR一覧と依存関係
| PR | 機能 | 依存 |
| --- | --- | --- |
| PR0 | 基盤整備 | なし |
| PR1 | 認証 | PR0 |
| PR2 | ワークスペース&メンバー | PR1 |
| PR3 | チャンネル | PR2 |
| PR4 | メッセージ(REST) | PR3 |
| PR5 | リアルタイム(ActionCable) | PR4 |
| PR6 | スレッド返信 | PR5 |
| PR7 | リアクション | PR4(PR5後推奨) |
| PR8 | メンション | PR4 |
| PR9 | ダイレクトメッセージ | PR5 |
| PR10 | 添付 | PR4 |
| PR11 | メッセージ検索 | PR4 |
| PR12 | 通知(未読/メンション) | PR5, PR8 |

---

## PR0 — 基盤整備
- **実装する機能**: Rails APIモード雛形、React(Vite)雛形、docker-compose(PostgreSQL)、ローカル起動、CI/README整合。
- **変更予定ファイル**: `backend/`(Rails一式), `frontend/`(Vite一式), `docker-compose.yml`, `backend/.env.example`, `README.md`(更新), `.github/workflows/claude-review.yml`(README差異の是正), `backend/spec/`(RSpec初期化), `frontend/vitest.config.ts`。
- **DB変更**: PostgreSQL接続設定(`database.yml`)。マイグレーションは空(スキーマ基盤のみ)。
- **API変更**: ヘルスチェック `GET /api/v1/health` のみ。
- **フロントエンド変更**: 雛形 + APIクライアント(fetch/axios)雛形 + ルーティング土台。
- **テスト内容**: `GET /health` の request spec、frontend の smoke テスト(App描画)。
- **完了条件**: `docker compose up` で app+db 起動、frontend から health が叩ける、両テストが緑、README がCI実態(`opened,reopened`)と一致。
- **前後の依存関係**: 先行なし。以降すべての土台。

## PR1 — 認証(登録/ログイン/ログアウト/プロフィール)
- **実装する機能**: ユーザー登録、ログイン/ログアウト、プロフィール取得/更新。
- **変更予定ファイル**: `backend/app/models/user.rb`, `backend/app/controllers/api/v1/{registrations,sessions,me}_controller.rb`, `config/routes.rb`, `frontend/src/pages/{Signup,Login}.tsx`, `frontend/src/store/auth.ts`, `frontend/src/api/auth.ts`。
- **DB変更**: `users`(name, email uniq, password_digest, avatar, status) マイグレーション追加。
- **API変更**: `POST /api/v1/auth/signup`, `POST /api/v1/auth/login`, `DELETE /api/v1/auth/logout`, `GET /api/v1/me`, `PATCH /api/v1/me`。
- **フロントエンド変更**: 登録/ログイン画面、認証state、保護ルート、ログアウト。
- **テスト内容**: request spec(登録/ログイン成功・失敗・401)、model spec(バリデーション)、RTL(フォーム送信→遷移)。
- **完了条件**: 登録→ログイン→`/me`取得→ログアウト→保護APIが401、の往復が通る。
- **前後の依存関係**: PR0。以降のAPIはすべて本認証に依存。

## PR2 — ワークスペース & メンバー
- **実装する機能**: ワークスペース作成、メンバー招待/退出/ロール管理。
- **変更予定ファイル**: `backend/app/models/{workspace,workspace_membership}.rb`, `backend/app/controllers/api/v1/{workspaces,workspace_memberships}_controller.rb`, `backend/app/policies/`(認可), `frontend/src/pages/Workspace*.tsx`, `frontend/src/api/workspaces.ts`。
- **DB変更**: `workspaces`(name, slug uniq, owner_id), `workspace_memberships`(user_id, workspace_id, role) 追加。作成時に general チャンネル用フックはPR3で。
- **API変更**: `POST/GET /api/v1/workspaces`, `POST /workspaces/:id/members`(招待), `DELETE /workspaces/:id/members/:uid`, `PATCH /workspaces/:id/members/:uid`(role)。
- **フロントエンド変更**: ワークスペース作成/切替、メンバー一覧・招待・ロール変更UI。
- **テスト内容**: request spec(作成でowner付与、権限別の招待/除名可否)、policy spec、RTL(作成→メンバー招待)。
- **完了条件**: 作成者がowner、admin/ownerのみ招待・除名・ロール変更でき、memberは自身の退出のみ可能。
- **前後の依存関係**: PR1。PR3以降のスコープ基盤。

## PR3 — チャンネル(パブリック/プライベート/参加・退出)
- **実装する機能**: チャンネル作成(public/private)、一覧、参加/退出。
- **変更予定ファイル**: `backend/app/models/{channel,channel_membership}.rb`, `backend/app/controllers/api/v1/{channels,channel_memberships}_controller.rb`, ワークスペース作成時の general 自動生成(PR2モデルに追記), `frontend/src/pages/Channel*.tsx`, `frontend/src/api/channels.ts`。
- **DB変更**: `channels`(workspace_id, name, kind, archived), `channel_memberships`(user_id, channel_id, last_read_at) 追加。
- **API変更**: `POST/GET /api/v1/workspaces/:wid/channels`, `POST /channels/:id/join`, `DELETE /channels/:id/leave`。
- **フロントエンド変更**: チャンネル一覧サイドバー、作成モーダル、参加/退出。private の可視制御。
- **テスト内容**: request spec(private が非メンバーに不可視、参加/退出、一覧の権限フィルタ)、RTL(チャンネル作成→参加)。
- **完了条件**: publicはメンバーが参加可、privateは招待メンバーのみ可視/参加、退出後は取得不可。
- **前後の依存関係**: PR2。PR4のメッセージ配置先。

## PR4 — メッセージ(REST: 投稿/編集/削除)
- **実装する機能**: チャンネルへのメッセージ投稿・取得(ページング)・編集・論理削除。
- **変更予定ファイル**: `backend/app/models/message.rb`, `backend/app/controllers/api/v1/messages_controller.rb`, `frontend/src/components/{MessageList,MessageInput}.tsx`, `frontend/src/api/messages.ts`。
- **DB変更**: `messages`(channel_id, user_id, body, parent_id nullable, edited_at, deleted_at) 追加。カーソル用index(channel_id, created_at, id)。
- **API変更**: `GET /api/v1/channels/:id/messages?cursor=`, `POST /channels/:id/messages`, `PATCH /messages/:id`, `DELETE /messages/:id`。
- **フロントエンド変更**: メッセージ一覧(無限スクロール)、入力欄、編集/削除UI。
- **テスト内容**: request spec(投稿/取得/編集は本人のみ/削除で本文非表示/ページング)、model spec、RTL(投稿→表示)。
- **完了条件**: 投稿が永続化・再取得可能、編集で`edited_at`更新、削除で本文非表示、カーソルページング動作。
- **前後の依存関係**: PR3。PR5以降(リアルタイム/スレッド/リアクション/メンション/添付/検索)の土台。

## PR5 — リアルタイム(ActionCable)
- **実装する機能**: メッセージの投稿/編集/削除をWebSocketで購読者へ即時配信。
- **変更予定ファイル**: `backend/app/channels/{application_cable/connection,channel_channel}.rb`, `backend/app/controllers/api/v1/messages_controller.rb`(broadcast追加), `config/cable.yml`, `frontend/src/lib/cable.ts`, `frontend/src/components/MessageList.tsx`(購読)。
- **DB変更**: なし(必要なら配信用の軽微なindexのみ)。
- **API変更**: WebSocket 経路 `/cable`。購読対象 `ChannelChannel(channel_id)`。REST投稿後にbroadcast。
- **フロントエンド変更**: ActionCable接続、チャンネル購読、受信でリストへ反映。
- **テスト内容**: channel spec(メンバーのみ購読可、broadcast内容)、request spec(投稿でbroadcastされる)、frontend結合(受信で描画)。
- **完了条件**: 2クライアントで一方の投稿/編集/削除が他方にリロード無しで反映、非メンバーは購読不可。
- **前後の依存関係**: PR4。PR6/PR9/PR12のリアルタイム基盤。

## PR6 — スレッド返信
- **実装する機能**: メッセージへの返信スレッド(親子)。
- **変更予定ファイル**: `backend/app/controllers/api/v1/messages_controller.rb`(parent対応), `backend/app/models/message.rb`(親子関連/返信数), `frontend/src/components/Thread*.tsx`, `frontend/src/api/messages.ts`。
- **DB変更**: `messages.parent_id`(PR4で用意済み)にindex追加、返信数カウント(カラム or 集計)。
- **API変更**: `GET /api/v1/messages/:id/replies`, `POST /messages/:id/replies`。親メッセージに `reply_count` 返却。
- **フロントエンド変更**: スレッドパネル、返信数バッジ、スレッド内投稿(PR5でリアルタイム)。
- **テスト内容**: request spec(返信作成/取得、reply_count)、RTL(スレッドを開いて返信)。
- **完了条件**: 親に返信数表示、スレッド一覧/投稿が動作しリアルタイム反映。
- **前後の依存関係**: PR5。

## PR7 — 絵文字リアクション
- **実装する機能**: メッセージへのリアクション付与/解除と集計。
- **変更予定ファイル**: `backend/app/models/reaction.rb`, `backend/app/controllers/api/v1/reactions_controller.rb`, broadcast追加, `frontend/src/components/Reactions.tsx`。
- **DB変更**: `reactions`(message_id, user_id, emoji) 追加、unique(message_id,user_id,emoji)。
- **API変更**: `POST /api/v1/messages/:id/reactions`, `DELETE /messages/:id/reactions/:emoji`。
- **フロントエンド変更**: リアクションピッカー、集計表示、トグル。
- **テスト内容**: request spec(重複付与不可、解除、集計)、channel spec(リアルタイム反映)、RTL。
- **完了条件**: 同一ユーザー同一絵文字は1つ、集計がリアルタイム反映。
- **前後の依存関係**: PR4(表示はPR5後が望ましい)。

## PR8 — メンション
- **実装する機能**: 本文中 `@user` の解析・保存・表示。
- **変更予定ファイル**: `backend/app/models/mention.rb`, `backend/app/services/mention_parser.rb`, `messages_controller.rb`(投稿時解析), `frontend/src/components/MessageInput.tsx`(補完), `MessageList.tsx`(ハイライト)。
- **DB変更**: `mentions`(message_id, mentioned_user_id) 追加、index。
- **API変更**: メッセージ投稿レスポンスに mentions を含める。`GET /api/v1/workspaces/:wid/members?query=`(補完用)。
- **フロントエンド変更**: `@` 入力でメンバー補完、メッセージ内メンションのハイライト。
- **テスト内容**: service spec(解析)、request spec(mention保存)、RTL(補完→送信)。
- **完了条件**: 投稿でメンションが保存・表示され、PR12の通知起点となる。
- **前後の依存関係**: PR4。PR12(メンション通知)の前提。

## PR9 — ダイレクトメッセージ
- **実装する機能**: ユーザー間1:1のDM会話と送受信(リアルタイム)。
- **変更予定ファイル**: `backend/app/models/{direct_message_conversation,dm_participant}.rb`, `backend/app/controllers/api/v1/{conversations,dm_messages}_controller.rb`, `backend/app/channels/conversation_channel.rb`, `frontend/src/pages/Dm*.tsx`, `frontend/src/api/dm.ts`。
- **DB変更**: `direct_message_conversations`(workspace_id), `dm_participants`(conversation_id,user_id) 追加。DMメッセージは `messages` を conversation 紐付けで再利用 or 専用。
- **API変更**: `POST/GET /api/v1/conversations`, `GET/POST /conversations/:id/messages`。WebSocket `ConversationChannel`。
- **フロントエンド変更**: DM一覧、会話開始、メッセージUI(チャンネルUI再利用)。
- **テスト内容**: request spec(参加者のみアクセス)、channel spec、RTL。
- **完了条件**: 相手を選び会話開始、送受信がリアルタイム、参加者以外は不可。
- **前後の依存関係**: PR5。

## PR10 — 画像/動画/ファイル添付
- **実装する機能**: メッセージへの添付(アップロード/プレビュー/ダウンロード)。
- **変更予定ファイル**: `backend/app/models/message.rb`(`has_many_attached`), `messages_controller.rb`(multipart対応), `config/storage.yml`, `frontend/src/components/{FileUpload,Attachment}.tsx`。
- **DB変更**: Active Storage テーブル(`active_storage_*`)導入。`messages` 直接変更なし。
- **API変更**: メッセージ投稿を multipart 対応、レスポンスに添付URL。サイズ/MIME検証。
- **フロントエンド変更**: ドラッグ&ドロップ/選択アップロード、画像/動画プレビュー、ファイルDL。
- **テスト内容**: request spec(アップロード/制限超過エラー/URL返却)、RTL(添付付き投稿)。
- **完了条件**: 添付付き投稿→他クライアントで表示/DL可能、サイズ/MIME制限が効く。
- **前後の依存関係**: PR4(表示はPR5後が望ましい)。

## PR11 — メッセージ検索
- **実装する機能**: ワークスペース内メッセージの全文検索(権限スコープ内)。
- **変更予定ファイル**: `backend/app/controllers/api/v1/search_controller.rb`, `backend/app/models/message.rb`(pg_search or tsvector), migration(検索index), `frontend/src/pages/Search.tsx`, `frontend/src/api/search.ts`。
- **DB変更**: `messages` に tsvector 列 + GIN index(または pg_search)追加。
- **API変更**: `GET /api/v1/workspaces/:wid/search?q=`。可視チャンネル/DMのみ対象。
- **フロントエンド変更**: 検索ボックス、結果一覧、該当メッセージへの遷移。
- **テスト内容**: request spec(ヒット/権限フィルタ/private除外)、RTL(検索→結果表示)。
- **完了条件**: キーワードで権限内メッセージが返り、非可視は除外される。
- **前後の依存関係**: PR4。

## PR12 — 通知(未読 / メンション通知)
- **実装する機能**: チャンネル/DMの未読件数、メンション/DMの通知と既読化。
- **変更予定ファイル**: `backend/app/models/{message_read,notification}.rb`, `backend/app/controllers/api/v1/{reads,notifications}_controller.rb`, broadcast(未読/通知), `frontend/src/components/{UnreadBadge,NotificationList}.tsx`。
- **DB変更**: `message_reads`(user_id, channel_id/conversation_id, last_read_message_id) と `notifications`(user_id, kind, source_id, read_at) 追加。
- **API変更**: `POST /api/v1/channels/:id/read`, `GET /api/v1/notifications`, `POST /notifications/:id/read`。
- **フロントエンド変更**: サイドバー未読バッジ、通知一覧/既読、閲覧で未読ゼロ化。
- **テスト内容**: request spec(新着で未読増、閲覧でゼロ化、メンションで通知生成)、channel spec(リアルタイム未読)、RTL。
- **完了条件**: 未読件数がリアルタイム更新、閲覧で解消、メンション/DMで通知が生成・既読化できる。
- **前後の依存関係**: PR5(リアルタイム) + PR8(メンション)。

---

## 補足
- ロール/認可は PR2 で導入し、以降のコントローラで policy を再利用する。
- broadcast ペイロードは PR5 で共通シリアライザを定め、PR6〜PR12 で再利用する。
- 各PRは「完了条件」をE2E相当の受け入れ基準とし、RSpec + Vitest で担保する。
