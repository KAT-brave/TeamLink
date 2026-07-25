class CreateChannels < ActiveRecord::Migration[8.1]
  def change
    create_table :channels do |t|
      t.references :workspace, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      # kind: public=0 / private=1。既定値は設定しない(明示指定を強制)。
      t.integer :kind, null: false
      t.references :created_by, null: false, foreign_key: { to_table: :users }

      t.timestamps
    end

    # 同一ワークスペース内では大文字小文字を無視してチャンネル名を一意にする。
    # 前後空白はモデルで除去。関数インデックスで同時登録時の重複も防止する。
    add_index :channels, "workspace_id, lower(name)",
              unique: true, name: "index_channels_on_workspace_id_and_lower_name"
  end
end
