require "uri"

# FRONTEND_ORIGIN からホスト名を安全に取り出すヘルパー。
# production.rb の Host Authorization / Action Cable 設定で利用する。
# (起動時設定で使うため Zeitwerk の autoload 対象からは除外している)
module FrontendOriginHost
  ERROR_MESSAGE =
    "FRONTEND_ORIGIN must be a valid absolute URL including http:// or https://".freeze

  # 与えられた値からホスト名を返す。
  #   - nil / 空文字        → nil(初回デプロイで未設定でも起動を妨げない)
  #   - 有効な絶対 URL      → host(ポート付きでも host のみ)
  #   - スキームなし/不正   → 例外(フェイルオープンを防ぐ)
  def self.resolve(value)
    origin = value.to_s.strip
    return nil if origin.empty?

    host =
      begin
        URI.parse(origin).host
      rescue URI::InvalidURIError
        nil
      end

    raise ERROR_MESSAGE if host.nil? || host.empty?

    host
  end
end
