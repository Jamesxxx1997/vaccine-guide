#!/bin/zsh
# 部署 CDC 轉送服務到 Google Cloud Run（台灣機房 asia-east1，離疾管署最近；GitHub 的美國主機抓 od.cdc.gov.tw 常逾時）。
# 前提（使用者自己做一次）：安裝 gcloud、`gcloud auth login`、建立專案並啟用計費（免費額度：每月 200 萬次請求）。
# 用法：PROJECT=<gcp-project-id> zsh backend/deploy_cloud_run.sh
set -eu
: "${PROJECT:?請設定 PROJECT=<gcp-project-id>}"
REGION="${REGION:-asia-east1}"
SERVICE="${SERVICE:-vaccine-cdc-relay}"
ORIGINS="${ORIGINS:-https://jamesxxx1997.github.io}"
HOSTS="${HOSTS:-}"   # 首次留空；拿到網址後設成 <service>-xxxx.a.run.app 再跑一次，收緊 Host 檢查
gcloud config set project "$PROJECT" >/dev/null
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
# 從原始碼建置（Cloud Build 讀根目錄 Dockerfile）；不驗證身分（網站前端直接呼叫），靠 Origin 白名單＋每 IP 限流＋並行上限
gcloud run deploy "$SERVICE" --source . --region "$REGION" --platform managed --allow-unauthenticated \
  --port 8080 --cpu 1 --memory 512Mi --concurrency 8 --min-instances 0 --max-instances 2 --timeout 60 \
  --set-env-vars "PUBLIC=1,ALLOWED_ORIGINS=$ORIGINS,PUBLIC_HOSTS=$HOSTS,RATE_LIMIT=60"
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')
echo "服務網址：$URL"
echo "健康檢查："; curl -s "$URL/api/health"; echo
echo "下一步：1) travel-live.js 的 PUBLIC_SERVICE 設成 '$URL'，npm test 後 commit/push；2) HOSTS=${URL#https://} 再跑本腳本一次收緊 Host 檢查。"
