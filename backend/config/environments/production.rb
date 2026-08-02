require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Code is not reloaded between requests.
  config.enable_reloading = false

  # Eager load code on boot for better performance and memory savings (ignored by Rake tasks).
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Cache assets for far-future expiry since they are all digest stamped.
  config.public_file_server.headers = { "cache-control" => "public, max-age=#{1.year.to_i}" }

  # Enable serving of images, stylesheets, and JavaScripts from an asset server.
  # config.asset_host = "http://assets.example.com"

  # Store uploaded files on the local file system (see config/storage.yml for options).
  config.active_storage.service = :local

  # Assume all access to the app is happening through a SSL-terminating reverse proxy.
  config.assume_ssl = true

  # Force all access to the app over SSL, use Strict-Transport-Security, and use secure cookies.
  config.force_ssl = true

  # Skip http-to-https redirect for the default health check endpoint.
  # config.ssl_options = { redirect: { exclude: ->(request) { request.path == "/up" } } }

  # Log to STDOUT with the current request id as a default log tag.
  config.log_tags = [ :request_id ]
  config.logger   = ActiveSupport::TaggedLogging.logger(STDOUT)

  # Change to "debug" to log everything (including potentially personally-identifiable information!).
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  # Prevent health checks from clogging up the logs.
  config.silence_healthcheck_path = "/up"

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Replace the default in-process memory cache store with a durable alternative.
  # config.cache_store = :mem_cache_store

  # Replace the default in-process and non-durable queuing backend for Active Job.
  # config.active_job.queue_adapter = :resque

  # Ignore bad email addresses and do not raise email delivery errors.
  # Set this to true and configure the email server for immediate delivery to raise delivery errors.
  # config.action_mailer.raise_delivery_errors = false

  # Set host to be used by links generated in mailer templates.
  config.action_mailer.default_url_options = { host: "example.com" }

  # Specify outgoing SMTP server. Remember to add smtp/* credentials via bin/rails credentials:edit.
  # config.action_mailer.smtp_settings = {
  #   user_name: Rails.application.credentials.dig(:smtp, :user_name),
  #   password: Rails.application.credentials.dig(:smtp, :password),
  #   address: "smtp.example.com",
  #   port: 587,
  #   authentication: :plain
  # }

  # Enable locale fallbacks for I18n (makes lookups for any locale fall back to
  # the I18n.default_locale when a translation cannot be found).
  config.i18n.fallbacks = true

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Only use :id for inspections in production.
  config.active_record.attributes_for_inspect = [ :id ]

  # Host Authorization(DNS リバインディング保護)を有効に保ちつつ、
  # 正規のホストだけを環境変数から許可する(全ホスト許可や無効化はしない)。
  #   - フロント(Nginx)は Host: <FRONTEND_ORIGIN のホスト> を転送するため、それを許可
  #   - Render は RENDER_EXTERNAL_HOSTNAME を自動設定するため、それも許可(ヘルスチェック用)
  # いずれも実値はコードへ直書きせず環境変数から取得する。
  frontend_host = URI.parse(ENV.fetch("FRONTEND_ORIGIN")).host
  config.hosts << frontend_host if frontend_host.present?
  config.hosts << ENV["RENDER_EXTERNAL_HOSTNAME"] if ENV["RENDER_EXTERNAL_HOSTNAME"].present?
  # ヘルスチェックは Host 認証をスキップし、プラットフォームの死活監視を妨げない。
  config.host_authorization = { exclude: ->(request) { request.path == "/api/v1/health" } }

  # Action Cable の許可 Origin を FRONTEND_ORIGIN から明示的に設定する。
  # Host ヘッダの正規化に依存した既定判定では、リバースプロキシ配下で
  # scheme/port の不一致により WebSocket 接続が拒否されるため。
  # 値は環境変数から取得し、コードへ直書きしない。
  config.action_cable.allowed_request_origins = [ ENV.fetch("FRONTEND_ORIGIN") ]
end
