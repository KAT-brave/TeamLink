# TeamLink Render デプロイ手順書

TeamLink を [Render](https://render.com/) へデプロイするための手順です。初めての方でも進められるよう、画面操作を順に説明します。

> **重要**: 同じ Render アカウントで **SupportLog** も稼働しています。本手順では **SupportLog のサービス・DB・Redis・環境変数を一切変更しません**。TeamLink 専用のリソースだけを新規作成します。

TeamLink は次の 4 リソースで構成します(すべて TeamLink 専用)。

| リソース | 種類 | 役割 |
| --- | --- | --- |
| `teamlink-frontend` | Docker Web Service | React ビルドを Nginx で配信し、`/api`・`/cable` を backend へプロキシ |
| `teamlink-backend` | Docker Web Service | Rails API + Action Cable |
| `teamlink-db` | PostgreSQL | TeamLink 専用データベース |
| `teamlink-redis` | Redis(Key Value) | Action Cable 用 |

ブラウザからのアクセス先は **`teamlink-frontend` の公開 URL だけ**です。frontend の Nginx が `/api`・`/cable` を backend へ内部プロキシするため、Cookie 認証(httpOnly + CSRF)は同一オリジンとして扱われます。

---

## 1. Render へログイン

1. https://dashboard.render.com/ を開きログインします。

## 2. SupportLog を触らないこと

- ダッシュボードに既存の SupportLog サービスが表示されますが、**クリックして設定変更しないでください**。
- 本手順で作成するのは名前が `teamlink-` で始まるリソースだけです。

## 3. TeamLink 専用 Project を新規作成

1. 左上の **Projects**(または Workspace)から **New Project** を作成し、名前を `TeamLink` にします。
2. 以降で作る 4 リソースはすべてこの Project にまとめると、SupportLog と混ざりません。

## 4. GitHub リポジトリを接続

1. **New +** → **Blueprint** を選びます。
2. リポジトリ選択で **`KAT-brave/TeamLink`** を選びます。

## 5. リポジトリが表示されない場合(GitHub App 設定)

1. リポジトリ一覧に TeamLink が出ない場合、**Configure account / Configure in GitHub** を押します。
2. GitHub の画面で Render の GitHub App に **`KAT-brave/TeamLink`** へのアクセスを許可します。
3. Render に戻ると TeamLink が選べるようになります。

## 6. Blueprint の作成

1. **New +** → **Blueprint** を選びます。
2. TeamLink リポジトリを選ぶと、Render がリポジトリルートの `render.yaml` を自動検出します。

## 7. render.yaml の選択

1. 検出された `render.yaml` の内容(4 リソース)が表示されます。
2. サービス名が `teamlink-frontend` / `teamlink-backend` / `teamlink-db` / `teamlink-redis` になっていることを確認します。
3. **Apply**(または Create）を押すとリソースが作成されます。

## 8. TeamLink 専用サービス名の確認

- 作成されるサービス名がすべて `teamlink-` で始まっていることを確認します。
- SupportLog の名前(例: `supportlog-*`)と一致するものが無いことを確認します。

## 9. 全サービスを同じリージョンにする

- `render.yaml` にはリージョンを固定していません。各サービス作成時、または作成後の **Settings → Region** で、**4 リソースすべてを同じリージョン**(例: Singapore など任意の1つ)に揃えます。
- リージョンが異なると内部ネットワーク接続ができないことがあります。

## 10. PostgreSQL が SupportLog と別であることの確認

- `teamlink-db` の詳細画面を開き、名前が `teamlink-db`、Database 名が `teamlink_production`、ユーザーが `teamlink` であることを確認します。
- SupportLog の DB とは別インスタンスであることを確認します(接続情報は共有しません)。

## 11. Redis が SupportLog と別であることの確認

- `teamlink-redis` の詳細画面を開き、名前が `teamlink-redis` であることを確認します。
- SupportLog の Redis とは別インスタンスであることを確認します。

## 12. RAILS_MASTER_KEY の登録場所

1. `teamlink-backend` → **Environment** を開きます。
2. `RAILS_MASTER_KEY` は空欄で作成されています(`sync: false`)。
3. ローカルの `backend/config/master.key` の中身を値として入力します。
   - **注意**: 本アプリは実行時に暗号化 credentials を参照しないため、`RAILS_MASTER_KEY` が未設定でも起動します。将来 credentials を使う場合に備えて設定しておくと安全です。
   - master.key の値はこの画面(Secret 扱い)以外に貼り付けたり Git に登録したりしないでください。

## 13. SECRET_KEY_BASE の設定方法

- `SECRET_KEY_BASE` は `render.yaml` で **自動生成(generateValue)** に設定済みです。Render が安全なランダム値を自動で入れます。
- 手動入力は不要です。値を確認・変更したい場合は `teamlink-backend` → Environment で扱えます(Secret 扱い)。

## 14. FRONTEND_ORIGIN の設定方法

1. まず `teamlink-frontend` の公開 URL(例: `https://teamlink-frontend-xxxx.onrender.com`)を確認します。
2. `teamlink-backend` → **Environment** の `FRONTEND_ORIGIN` に、その URL を **末尾スラッシュ無し**で入力します。
   - 例: `https://teamlink-frontend-xxxx.onrender.com`
3. この値は CORS 許可・Action Cable 許可 Origin・Host 認証に使われます。誤ると API/WebSocket がブロックされます。
4. 入力後、`teamlink-backend` を **Manual Deploy → Deploy latest commit** で再デプロイして反映します。

## 15. Backend 接続先(BACKEND_HOST / BACKEND_PORT)の設定方法

- `teamlink-frontend` の `BACKEND_HOST` / `BACKEND_PORT` は `render.yaml` で `teamlink-backend` から自動取得(fromService)する設定です。
- もし自動取得されない場合は、`teamlink-backend` の詳細(Connect / Internal Address)で内部ホスト名とポートを確認し、`teamlink-frontend` → Environment に手動入力します。
  - `BACKEND_HOST` = backend の内部ホスト名
  - `BACKEND_PORT` = backend が待ち受けるポート
- 変更後は `teamlink-frontend` を再デプロイします。

## 16. DATABASE_URL の接続確認

- `teamlink-backend` の `DATABASE_URL` は `teamlink-db` から自動取得されます(手動入力不要)。
- `teamlink-backend` → **Logs** で、起動時に DB へ接続できていること(マイグレーションが走ること)を確認します。

## 17. REDIS_URL の接続確認

- `teamlink-backend` の `REDIS_URL` は `teamlink-redis` から自動取得されます(手動入力不要)。
- Action Cable(WebSocket)接続時にエラーが出ないことを Logs で確認します。

## 18. 初回デプロイ手順

1. Blueprint 適用後、4 リソースが順に作成・ビルドされます。
2. `teamlink-backend` と `teamlink-frontend` の Docker イメージがビルドされ、デプロイされます。
3. `FRONTEND_ORIGIN`(手順14)を設定したら backend を再デプロイします。

## 19. db:prepare の実行確認

- `teamlink-backend` は **preDeployCommand** に `bundle exec rails db:prepare` を設定しています。
- デプロイ時に一度だけ実行され、Logs に「migrating」等が出ます。
- 既存 DB では未適用のマイグレーションだけを適用します。`db:reset` や `db:drop` は使いません(データを初期化しません)。

## 20. seed が自動実行されないこと

- `db:prepare` は **seed を自動実行しません**(DB は Render が作成済みのためマイグレーションのみ)。
- さらに `db/seeds.rb` には production ガードがあり、`RAILS_ENV=production` では `SEED_DEMO=true` を明示しない限りスキップされます。
- したがって本番でデモデータが勝手に投入されることはありません。

## 21. デモデータを手動投入する場合(任意)

デモアカウントで動作確認したい場合のみ、手動で投入します。

1. `teamlink-backend` → **Shell** を開きます。
2. 次を実行します。
   ```
   SEED_DEMO=true bundle exec rails db:seed
   ```
3. デモアカウント(共通パスワード `password1234`、**本番利用禁止**)が作成されます。
   - `demo-owner@example.com` / `demo-admin@example.com` / `demo-member@example.com` / `demo-outsider@example.com`
4. 公開デモとして使う場合は、確認後にパスワードを変更するか、デモデータを削除してください。

## 22. Backend の health check 確認

- `teamlink-backend` の Health Check Path は `/api/v1/health` です。
- Render のサービス状態が **Live / Healthy** になっていることを確認します。

## 23. Frontend の表示確認

1. `teamlink-frontend` の公開 URL をブラウザで開きます。
2. ログイン画面が表示されれば OK です。
3. 直接 URL(例: `/workspaces`)を開いても 404 にならない(SPA フォールバック)ことを確認します。

## 24. ログイン確認

1. デモデータを投入した場合、`demo-owner@example.com` / `password1234` でログインできることを確認します。
2. ログイン後にワークスペース・チャンネルが表示されることを確認します。

## 25. Action Cable(WebSocket)確認

1. チャンネル詳細を開き、ブラウザの開発者ツール → Network → WS で `/cable` 接続が **101 Switching Protocols** になることを確認します。
2. エラー(接続失敗の繰り返し)が無いことを確認します。

## 26. 未読・リアルタイム通信確認

1. 通常ウィンドウ(owner)とシークレットウィンドウ(member)で同じチャンネルを開きます。
2. 一方の投稿が**再読み込みなしで**もう一方に反映されることを確認します。
3. 別チャンネルへの投稿で未読件数が増え、開くと消えることを確認します。

## 27. Render ログの確認方法

- 各サービスの **Logs** タブでリアルタイムログを確認できます。
- backend でエラー例外・`Blocked hosts`・Redis 接続失敗が出ていないか確認します。

## 28. デプロイ失敗時の確認箇所

- **Build ログ**: Docker イメージのビルドに失敗していないか。
- **Deploy / Runtime ログ**: 起動時に例外が出ていないか。
- 主な原因候補:
  - `FRONTEND_ORIGIN` 未設定/誤り → Host 認証・Cable 拒否・CORS エラー
  - `BACKEND_HOST` / `BACKEND_PORT` 誤り → frontend から backend へ 502/504
  - `DATABASE_URL` / `REDIS_URL` 未解決 → backend 起動失敗
  - リージョン不一致 → 内部接続不可

## 29. ロールバック方法

1. 対象サービス → **Deploys** タブを開きます。
2. 正常だった過去のデプロイの **Rollback** を実行します。
3. コード側を戻す場合は、GitHub 側で該当 PR を revert し、再デプロイします。

## 30. SupportLog へ影響していないことの確認方法

- SupportLog の各サービスの **Deploys / Logs** を開き、**新たなデプロイやエラーが発生していない**ことを確認します。
- SupportLog の Environment 変数・DB・Redis に変更が無いことを確認します(本手順では触れていません)。

## 31. 課金が TeamLink 分として追加されること

- Render の **Billing** で、TeamLink の 4 リソース(free プランなら $0、有料化した場合は各サービス分)が **SupportLog とは別に**加算されることを確認します。
- free プランは制限(スリープ・PostgreSQL の有効期限等)があります。継続運用する場合は各サービスのプランを見直してください。

---

## 手動入力する環境変数一覧

| 変数名 | 登録サービス | 自動/手動 | 秘密情報 | 設定例(実値は書かない) |
| --- | --- | --- | --- | --- |
| `RAILS_ENV` | teamlink-backend | 自動(render.yaml) | いいえ | `production` |
| `RAILS_LOG_TO_STDOUT` | teamlink-backend | 自動(render.yaml) | いいえ | `1` |
| `SECRET_KEY_BASE` | teamlink-backend | 自動生成(Render) | **はい** | (Render が生成) |
| `RAILS_MASTER_KEY` | teamlink-backend | **手動** | **はい** | `config/master.key` の中身 |
| `DATABASE_URL` | teamlink-backend | 自動(fromDatabase) | **はい** | `postgres://...`(自動) |
| `REDIS_URL` | teamlink-backend | 自動(fromService) | **はい** | `redis://...`(自動) |
| `FRONTEND_ORIGIN` | teamlink-backend | **手動** | いいえ | `https://teamlink-frontend-xxxx.onrender.com` |
| `BACKEND_HOST` | teamlink-frontend | 自動(fromService)/必要時手動 | いいえ | backend の内部ホスト名 |
| `BACKEND_PORT` | teamlink-frontend | 自動(fromService)/必要時手動 | いいえ | backend の待受ポート |
| `PORT` | teamlink-frontend / teamlink-backend | 自動(Render) | いいえ | (Render が割り当て) |

> `RENDER_EXTERNAL_HOSTNAME` は Render が各 Web Service に自動設定します。backend はこれを Host 認証の許可ホストに自動追加します(設定不要)。

## 補足: VITE_CABLE_URL について

- フロントは Nginx が `/cable` を同一オリジンでプロキシするため、Action Cable の接続先はビルド時に既定 `/cable`(相対)で焼き込まれます。
- そのため **Render 上で `VITE_CABLE_URL` を設定する必要はありません**(既定値のままで同一オリジン接続になります)。

## 対象外

- 本手順は構成の追加のみで、**実際の Render デプロイは行っていません**。
- SupportLog の変更、新機能追加、認証方式の変更、本番データの投入は含みません。
