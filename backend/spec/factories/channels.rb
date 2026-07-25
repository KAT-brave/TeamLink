FactoryBot.define do
  factory :channel do
    association :workspace
    sequence(:name) { |n| "channel#{n}" }
    kind { :public }
    created_by factory: :user

    # 作成者をワークスペース所属にし、チャンネルにも参加させた状態にする
    # (実際の作成フローに合わせたセットアップ用トレイト)。
    trait :with_creator_membership do
      after(:create) do |channel|
        creator = channel.created_by
        unless channel.workspace.membership_for(creator)
          create(:workspace_membership, workspace: channel.workspace, user: creator, role: :member)
        end
        channel.channel_memberships.create!(user: creator)
      end
    end
  end
end
