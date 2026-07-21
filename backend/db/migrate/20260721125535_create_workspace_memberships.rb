class CreateWorkspaceMemberships < ActiveRecord::Migration[8.1]
  def change
    create_table :workspace_memberships do |t|
      t.references :workspace, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      # 役割: member(0) / admin(1) / owner(2)
      t.integer :role, null: false, default: 0

      t.timestamps
    end

    # 同じユーザーの重複参加を防ぐ。
    add_index :workspace_memberships, [ :workspace_id, :user_id ], unique: true
  end
end
