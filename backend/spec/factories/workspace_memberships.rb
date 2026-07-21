FactoryBot.define do
  factory :workspace_membership do
    association :workspace
    association :user
    role { :member }
  end
end
