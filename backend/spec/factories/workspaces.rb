FactoryBot.define do
  factory :workspace do
    sequence(:name) { |n| "Workspace#{n}" }
    association :owner, factory: :user
    # invite_code はモデルが自動採番するため未指定でよい。

    # 作成者の owner メンバーシップも同時に用意する。
    trait :with_owner_membership do
      after(:create) do |ws|
        create(:workspace_membership, workspace: ws, user: ws.owner, role: :owner)
      end
    end
  end
end
