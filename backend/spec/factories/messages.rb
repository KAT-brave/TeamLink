FactoryBot.define do
  factory :message do
    association :channel
    association :user
    sequence(:body) { |n| "Message #{n}" }
  end
end
