FactoryBot.define do
  factory :channel_read_status do
    association :user
    association :channel
    last_read_message_id { nil }
  end
end
