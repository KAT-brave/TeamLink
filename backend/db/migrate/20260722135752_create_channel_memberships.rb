class CreateChannelMemberships < ActiveRecord::Migration[8.1]
  def change
    create_table :channel_memberships do |t|
      t.references :channel, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end

    # 同じユーザーの同一チャンネルへの重複参加を防ぐ。
    add_index :channel_memberships, [ :channel_id, :user_id ], unique: true
  end
end
