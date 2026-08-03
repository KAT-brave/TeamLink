require "rails_helper"
require Rails.root.join("lib/config_helpers/frontend_origin_host")

RSpec.describe FrontendOriginHost do
  describe ".resolve" do
    context "FRONTEND_ORIGIN が未設定(初回デプロイ)" do
      it "nil を返し、例外にならない" do
        expect(described_class.resolve(nil)).to be_nil
      end

      it "空文字も nil を返す" do
        expect(described_class.resolve("")).to be_nil
        expect(described_class.resolve("   ")).to be_nil
      end
    end

    context "有効な絶対 URL" do
      it "https URL の host を返す" do
        expect(described_class.resolve("https://teamlink-frontend.onrender.com"))
          .to eq("teamlink-frontend.onrender.com")
      end

      it "http URL の host を返す" do
        expect(described_class.resolve("http://localhost:8080")).to eq("localhost")
      end

      it "ポート付き URL でも host のみを返す" do
        expect(described_class.resolve("https://example.com:443")).to eq("example.com")
      end
    end

    context "スキームなし" do
      it "明示的な例外を発生させる" do
        expect { described_class.resolve("teamlink-frontend.onrender.com") }
          .to raise_error(FrontendOriginHost::ERROR_MESSAGE)
      end
    end

    context "不正な URL" do
      it "明示的な例外を発生させる" do
        expect { described_class.resolve("://invalid") }
          .to raise_error(FrontendOriginHost::ERROR_MESSAGE)
      end
    end
  end
end
