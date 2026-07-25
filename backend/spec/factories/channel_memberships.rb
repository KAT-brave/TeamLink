FactoryBot.define do
  factory :channel_membership do
    association :channel
    association :user
  end
end
