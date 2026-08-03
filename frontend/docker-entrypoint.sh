#!/bin/sh
set -e

# 本番用フロント(Nginx)のエントリポイント。
# 環境変数から Nginx 設定を生成する(ホスト名やポートをソースへ固定しない)。
#   PORT         : リッスンポート(Render は自動割り当て。既定 80)
#   BACKEND_HOST : バックエンドのホスト名(既定 backend)
#   BACKEND_PORT : バックエンドのポート(既定 3000)

: "${PORT:=80}"
: "${BACKEND_HOST:=backend}"
: "${BACKEND_PORT:=3000}"

# DNS リゾルバは /etc/resolv.conf の nameserver を使う(Docker/Render 両対応)。
NGINX_RESOLVER="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf 2>/dev/null || true)"
: "${NGINX_RESOLVER:=127.0.0.11}"

export PORT BACKEND_HOST BACKEND_PORT NGINX_RESOLVER

# envsubst は列挙した変数だけを置換し、nginx のランタイム変数($host 等)は保持する。
envsubst '${PORT} ${BACKEND_HOST} ${BACKEND_PORT} ${NGINX_RESOLVER}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "[nginx] listen=${PORT} backend=${BACKEND_HOST}:${BACKEND_PORT} resolver=${NGINX_RESOLVER}"

# CMD(既定は nginx -g 'daemon off;')を起動する。
exec "$@"
