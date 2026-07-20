class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :password_digest, null: false

      t.timestamps
    end

    # メールアドレスは大文字小文字を無視して一意にする(保存時に downcase する前提)。
    add_index :users, :email, unique: true
  end
end
