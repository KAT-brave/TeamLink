require 'rails_helper'

RSpec.describe ChannelReadStatus, type: :model do
  describe 'associations' do
    it 'belongs_to user' do
      read_status = create(:channel_read_status)
      expect(read_status.user).to be_a(User)
    end

    it 'belongs_to channel' do
      read_status = create(:channel_read_status)
      expect(read_status.channel).to be_a(Channel)
    end
  end

  describe 'validations' do
    it 'requires user_id' do
      read_status = build(:channel_read_status, user: nil)
      expect(read_status).not_to be_valid
      expect(read_status.errors[:user_id]).to be_present
    end

    it 'requires channel_id' do
      read_status = build(:channel_read_status, channel: nil)
      expect(read_status).not_to be_valid
      expect(read_status.errors[:channel_id]).to be_present
    end

    it 'validates uniqueness of user_id scoped to channel_id' do
      read_status = create(:channel_read_status)
      duplicate = build(:channel_read_status, user: read_status.user, channel: read_status.channel)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:user_id]).to be_present
    end

    it 'validates last_read_message_id as non-negative integer' do
      user = create(:user)
      channel = create(:channel)
      expect(build(:channel_read_status, user: user, channel: channel, last_read_message_id: -1)).not_to be_valid
      expect(build(:channel_read_status, user: user, channel: channel, last_read_message_id: 0)).to be_valid
      expect(build(:channel_read_status, user: user, channel: channel, last_read_message_id: nil)).to be_valid
    end
  end

  describe 'database constraints' do
    it 'enforces uniqueness at database level' do
      read_status = create(:channel_read_status)
      duplicate = build(:channel_read_status, user: read_status.user, channel: read_status.channel)
      expect { duplicate.save(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it 'cascades delete when user is deleted' do
      read_status = create(:channel_read_status)
      user = read_status.user
      expect { user.destroy }.to change { ChannelReadStatus.count }.by(-1)
    end

    it 'cascades delete when channel is deleted' do
      read_status = create(:channel_read_status)
      channel = read_status.channel
      expect { channel.destroy }.to change { ChannelReadStatus.count }.by(-1)
    end
  end

  describe 'last_read_message_id handling' do
    it 'allows nil last_read_message_id' do
      read_status = create(:channel_read_status, last_read_message_id: nil)
      expect(read_status.last_read_message_id).to be_nil
    end

    it 'persists when message is deleted' do
      read_status = create(:channel_read_status, last_read_message_id: nil)
      channel = read_status.channel
      message = create(:message, channel: channel)
      read_status.update(last_read_message_id: message.id)
      expect(read_status.reload.last_read_message_id).to eq(message.id)

      message.destroy
      expect(read_status.reload.last_read_message_id).to eq(message.id)
    end
  end
end
