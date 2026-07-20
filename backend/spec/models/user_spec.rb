require "rails_helper"

RSpec.describe User, type: :model do
  it "有効なファクトリを持つ" do
    expect(build(:user)).to be_valid
  end

  it "name が必須" do
    expect(build(:user, name: "")).not_to be_valid
  end

  it "email が必須" do
    expect(build(:user, email: "")).not_to be_valid
  end

  it "email の形式を検証する" do
    expect(build(:user, email: "invalid")).not_to be_valid
  end

  it "email は大文字小文字を無視して一意" do
    create(:user, email: "dup@example.com")
    expect(build(:user, email: "DUP@example.com")).not_to be_valid
  end

  it "email を保存時に downcase する" do
    user = create(:user, email: "Mixed@Example.com")
    expect(user.email).to eq("mixed@example.com")
  end

  it "8文字未満のパスワードを拒否する" do
    expect(build(:user, password: "short")).not_to be_valid
  end

  it "パスワードを平文で保存しない(digest化)" do
    user = create(:user, password: "password123")
    expect(user.password_digest).to be_present
    expect(user.password_digest).not_to eq("password123")
    expect(user.authenticate("password123")).to be_truthy
  end
end
