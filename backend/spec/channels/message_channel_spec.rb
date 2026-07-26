require 'rails_helper'

describe MessageChannel, type: :channel do
  let(:workspace) { create(:workspace) }
  let(:public_channel) { create(:channel, workspace:, kind: :public) }
  let(:private_channel) { create(:channel, workspace:, kind: :private) }

  let(:owner) { create(:user) }
  let(:admin) { create(:user) }
  let(:member) { create(:user) }
  let(:non_participant) { create(:user) }
  let(:other_workspace_user) { create(:user) }

  before do
    # owner / admin / member を workspace に追加
    create(:workspace_membership, workspace:, user: owner, role: :owner)
    create(:workspace_membership, workspace:, user: admin, role: :admin)
    create(:workspace_membership, workspace:, user: member, role: :member)
    create(:workspace_membership, workspace:, user: non_participant, role: :member)

    # public/private チャンネルにメンバーを追加
    create(:channel_membership, channel: public_channel, user: member)
    create(:channel_membership, channel: private_channel, user: member)
  end

  describe "公開チャンネル購読" do
    it "参加済みmemberは購読成功" do
      stub_connection current_user: member
      subscribe(channel_id: public_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(public_channel)
    end

    it "未参加memberも購読成功（公開チャンネル）" do
      stub_connection current_user: non_participant
      subscribe(channel_id: public_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(public_channel)
    end

    it "ownerは購読成功" do
      stub_connection current_user: owner
      subscribe(channel_id: public_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(public_channel)
    end

    it "adminは購読成功" do
      stub_connection current_user: admin
      subscribe(channel_id: public_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(public_channel)
    end

    it "別チャンネルのstreamは購読しない" do
      stub_connection current_user: member
      subscribe(channel_id: public_channel.id)
      expect(subscription).not_to have_stream_for(private_channel)
    end
  end

  describe "非公開チャンネル購読" do
    it "参加済みmemberは購読成功" do
      stub_connection current_user: member
      subscribe(channel_id: private_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(private_channel)
    end

    it "未参加ownerは購読成功" do
      stub_connection current_user: owner
      subscribe(channel_id: private_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(private_channel)
    end

    it "未参加adminは購読成功" do
      stub_connection current_user: admin
      subscribe(channel_id: private_channel.id)
      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_for(private_channel)
    end

    it "未参加一般memberは購読拒否" do
      stub_connection current_user: non_participant
      subscribe(channel_id: private_channel.id)
      expect(subscription).to be_rejected
    end
  end

  describe "その他の購読ルール" do
    it "ワークスペース未所属者は購読拒否" do
      stub_connection current_user: other_workspace_user
      subscribe(channel_id: public_channel.id)
      expect(subscription).to be_rejected
    end

    it "存在しないchannel_idは購読拒否" do
      stub_connection current_user: member
      subscribe(channel_id: 999999)
      expect(subscription).to be_rejected
    end

    it "別ワークスペースのチャンネルを購読できない" do
      other_workspace = create(:workspace)
      other_channel = create(:channel, workspace: other_workspace, kind: :public)

      stub_connection current_user: member
      subscribe(channel_id: other_channel.id)
      expect(subscription).to be_rejected
    end
  end
end
