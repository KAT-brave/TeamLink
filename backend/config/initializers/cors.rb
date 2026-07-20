# 開発時、フロント(Vite)からのクレデンシャル付きリクエストを許可する。
# 本番は同一オリジン配信を想定し、必要に応じて FRONTEND_ORIGIN を設定する。
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGIN", "http://localhost:5173")
    resource "*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      credentials: true
  end
end
