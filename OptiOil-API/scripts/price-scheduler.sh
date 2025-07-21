#!/bin/bash

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 環境変数の読み込み
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
fi

# 必要な環境変数の確認
if [ -z "$OPT_SCHEDULER_SECRET" ]; then
    echo "エラー: OPT_SCHEDULER_SECRET が設定されていません"
    exit 1
fi

# 設定
API_URL="${OPT_API_URL:-https://maruichi-opt.com}"
LOG_DIR="$PROJECT_ROOT/${OPT_LOGS_DIR:-logs}"
LOG_FILE="$LOG_DIR/price-scheduler-$(date +%Y%m%d).log"

# ログディレクトリ作成
mkdir -p "$LOG_DIR"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# メイン処理
log "価格スケジュール実行開始"

# APIリクエスト実行
response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $OPT_SCHEDULER_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"action":"apply_schedules"}' \
    "$API_URL/api/admin/batch/price-schedules")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    log "価格スケジュール適用成功"
    echo "$body" >> "$LOG_FILE"
else
    log "価格スケジュール適用失敗 (HTTP $http_code)"
    echo "$body" >> "$LOG_FILE"
    exit 1
fi

log "価格スケジュール実行終了"