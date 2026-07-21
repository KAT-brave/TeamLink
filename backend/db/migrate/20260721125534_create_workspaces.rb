class CreateWorkspaces < ActiveRecord::Migration[8.1]
  def change
    create_table :workspaces do |t|
      t.string :name, null: false
      # owner は users を参照する。
      t.references :owner, null: false, foreign_key: { to_table: :users }
      # 招待コードは推測しにくい値。重複させない。
      t.string :invite_code, null: false

      t.timestamps
    end

    add_index :workspaces, :invite_code, unique: true
  end
end
