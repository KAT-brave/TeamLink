# TeamLink デモ用シードデータ。
# 機能確認(認証・権限・公開/非公開チャンネル・メッセージ・検索・未読)に使える最小構成を用意する。
#
# 冪等性: find_or_create_by! を用い、何度実行しても重大な重複を起こさない。
# 既存データは削除しない(db:reset は行わない)。
#
# 本番での実行防止: production では既定でスキップする。
#   本番でどうしても投入する場合のみ SEED_DEMO=true を明示すること(デモ用の弱いパスワードのため非推奨)。
#
# 実行: bin/rails db:seed

if Rails.env.production? && ENV["SEED_DEMO"] != "true"
  puts "[seed] production 環境のためデモデータ投入をスキップしました(強制する場合は SEED_DEMO=true)。"
  return
end

# デモ用の共通パスワード。**本番利用禁止**(README にも明記)。
DEMO_PASSWORD = "password1234".freeze

puts "[seed] デモユーザーを作成..."
users = {
  owner:    { name: "デモ オーナー",   email: "demo-owner@example.com" },
  admin:    { name: "デモ 管理者",     email: "demo-admin@example.com" },
  member:   { name: "デモ メンバー",   email: "demo-member@example.com" },
  outsider: { name: "デモ 未所属",     email: "demo-outsider@example.com" }
}.transform_values do |attrs|
  user = User.find_or_initialize_by(email: attrs[:email])
  if user.new_record?
    user.name = attrs[:name]
    user.password = DEMO_PASSWORD
    user.save!
  end
  user
end

puts "[seed] デモワークスペースを作成..."
workspace = Workspace.find_or_create_by!(name: "TeamLink Demo", owner: users[:owner])

# owner/admin/member をワークスペースに所属させる(outsider は未所属のまま)。
puts "[seed] ワークスペースメンバーシップを作成..."
{ owner: :owner, admin: :admin, member: :member }.each do |user_key, role|
  membership = WorkspaceMembership.find_or_create_by!(workspace: workspace, user: users[user_key])
  membership.update!(role: role) unless membership.role == role.to_s
end

puts "[seed] チャンネルを作成..."
channels = {
  general:     { name: "general",     kind: :public,  description: "全体連絡用の公開チャンネル" },
  development: { name: "development",  kind: :public,  description: "開発の議論用の公開チャンネル" },
  management:  { name: "management",   kind: :private, description: "管理者向けの非公開チャンネル" },
  support:     { name: "support",      kind: :private, description: "サポート対応用の非公開チャンネル" }
}.transform_values do |attrs|
  Channel.find_or_create_by!(workspace: workspace, name: attrs[:name]) do |ch|
    ch.kind = attrs[:kind]
    ch.description = attrs[:description]
    ch.created_by = users[:owner]
  end
end

# チャンネル参加状態(権限確認に使える構成):
#   - owner: 全チャンネル(公開2 + 非公開2)へ参加
#   - admin: general / development / management に参加(support は未参加=owner/admin の管理閲覧確認用)
#   - member: general / development / support に参加(management は未参加=非公開の秘匿確認用)
puts "[seed] チャンネルメンバーシップを作成..."
channel_membership_plan = {
  owner:  %i[general development management support],
  admin:  %i[general development management],
  member: %i[general development support]
}
channel_membership_plan.each do |user_key, channel_keys|
  channel_keys.each do |ch_key|
    ChannelMembership.find_or_create_by!(channel: channels[ch_key], user: users[user_key])
  end
end

puts "[seed] メッセージを作成..."
# body + channel + user で冪等化(自然キーが無いため重複投稿を防ぐ)。
messages_plan = [
  [ :general, :owner,  "TeamLink Demo ワークスペースへようこそ。まずは general で自己紹介をお願いします。" ],
  [ :general, :admin,  "運用ルールはこのチャンネルで共有します。困ったことがあれば気軽に投稿してください。" ],
  [ :general, :member, "はじめまして。よろしくお願いします。障害対応の進め方も教えてほしいです。" ],
  [ :development, :owner,  "development チャンネルでは実装方針やレビュー観点を議論します。" ],
  [ :development, :member, "検索機能のテストを書いています。ILIKE の部分一致で問題ないか確認中です。" ],
  [ :management,  :owner,  "management は管理者向けの非公開チャンネルです。権限周りの相談に使います。" ],
  [ :management,  :admin,  "メンバーの権限変更はここで合意を取ってから反映しましょう。" ],
  [ :support, :member, "サポート問い合わせのテンプレートを support に置いておきます。" ],
  [ :support, :owner,  "障害発生時はまず support で状況を共有してください。" ]
]
messages_plan.each do |ch_key, user_key, body|
  Message.find_or_create_by!(channel: channels[ch_key], user: users[user_key], body: body)
end

puts "[seed] 完了: users=#{User.count} workspaces=#{Workspace.count} channels=#{Channel.count} messages=#{Message.count}"
