class CreateChannelReadStatuses < ActiveRecord::Migration[8.1]
  def change
    create_table :channel_read_statuses do |t|
      t.bigint :user_id, null: false
      t.bigint :channel_id, null: false
      t.bigint :last_read_message_id

      t.timestamps
    end

    add_foreign_key :channel_read_statuses, :users, on_delete: :cascade
    add_foreign_key :channel_read_statuses, :channels, on_delete: :cascade

    add_index :channel_read_statuses, [ :user_id, :channel_id ], unique: true
  end
end
