#!/bin/bash
# ==============================================
# 帳票データ化システム - 自動デプロイスクリプト
# ==============================================

set -e

# 色付きログ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 設定ファイル読み込み
if [ -f ".env" ]; then
    source .env
else
    log_error ".envファイルが見つかりません。.env.exampleをコピーして設定してください。"
    exit 1
fi

# 必須変数チェック
: "${GCP_PROJECT_ID:?GCP_PROJECT_IDが設定されていません}"
: "${GCP_REGION:?GCP_REGIONが設定されていません}"
: "${GEMINI_API_KEY:?GEMINI_API_KEYが設定されていません}"

ARTIFACT_REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/invoice-app"

# ----------------------------------------------
# 初期セットアップ
# ----------------------------------------------
setup_gcp() {
    log_info "GCPプロジェクトを設定中..."
    gcloud config set project ${GCP_PROJECT_ID}

    log_info "必要なAPIを有効化中..."
    gcloud services enable \
        run.googleapis.com \
        cloudbuild.googleapis.com \
        artifactregistry.googleapis.com \
        secretmanager.googleapis.com \
        firebase.googleapis.com \
        identitytoolkit.googleapis.com

    log_info "Artifact Registryリポジトリを作成中..."
    gcloud artifacts repositories create invoice-app \
        --repository-format=docker \
        --location=${GCP_REGION} \
        --description="Invoice App Docker Images" \
        2>/dev/null || log_warn "リポジトリは既に存在します"

    log_info "Docker認証を設定中..."
    gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev --quiet
}

# ----------------------------------------------
# バックエンドのビルド&デプロイ
# ----------------------------------------------
deploy_backend() {
    log_info "バックエンドをビルド中..."
    cd ../backend

    docker build -t ${ARTIFACT_REGISTRY}/backend:latest .

    log_info "バックエンドイメージをプッシュ中..."
    docker push ${ARTIFACT_REGISTRY}/backend:latest

    log_info "Cloud Runにデプロイ中..."
    gcloud run deploy invoice-api \
        --image ${ARTIFACT_REGISTRY}/backend:latest \
        --platform managed \
        --region ${GCP_REGION} \
        --allow-unauthenticated \
        --set-env-vars "GCP_PROJECT_ID=${GCP_PROJECT_ID}" \
        --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10

    # バックエンドURLを取得
    BACKEND_URL=$(gcloud run services describe invoice-api \
        --region ${GCP_REGION} \
        --format 'value(status.url)')

    log_info "バックエンドURL: ${BACKEND_URL}"
    echo "BACKEND_URL=${BACKEND_URL}" >> ../.env.deployed

    cd ../scripts
}

# ----------------------------------------------
# フロントエンドのビルド&デプロイ
# ----------------------------------------------
deploy_frontend() {
    log_info "フロントエンドをビルド中..."
    cd ../frontend

    # バックエンドURLを読み込み
    if [ -f "../.env.deployed" ]; then
        source ../.env.deployed
    fi

    docker build \
        --build-arg VITE_FIREBASE_API_KEY="${FIREBASE_API_KEY}" \
        --build-arg VITE_FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN}" \
        --build-arg VITE_FIREBASE_PROJECT_ID="${GCP_PROJECT_ID}" \
        --build-arg VITE_FIREBASE_STORAGE_BUCKET="${GCP_PROJECT_ID}.appspot.com" \
        --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID}" \
        --build-arg VITE_FIREBASE_APP_ID="${FIREBASE_APP_ID}" \
        --build-arg VITE_API_URL="${BACKEND_URL}" \
        -t ${ARTIFACT_REGISTRY}/frontend:latest .

    log_info "フロントエンドイメージをプッシュ中..."
    docker push ${ARTIFACT_REGISTRY}/frontend:latest

    log_info "Cloud Runにデプロイ中..."
    gcloud run deploy invoice-frontend \
        --image ${ARTIFACT_REGISTRY}/frontend:latest \
        --platform managed \
        --region ${GCP_REGION} \
        --allow-unauthenticated \
        --memory 256Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 5

    FRONTEND_URL=$(gcloud run services describe invoice-frontend \
        --region ${GCP_REGION} \
        --format 'value(status.url)')

    log_info "フロントエンドURL: ${FRONTEND_URL}"
    echo "FRONTEND_URL=${FRONTEND_URL}" >> ../.env.deployed

    cd ../scripts
}

# ----------------------------------------------
# Secret Managerの設定
# ----------------------------------------------
setup_secrets() {
    log_info "Secret Managerを設定中..."

    # Gemini API Keyを保存
    echo -n "${GEMINI_API_KEY}" | gcloud secrets create gemini-api-key \
        --data-file=- \
        2>/dev/null || \
    echo -n "${GEMINI_API_KEY}" | gcloud secrets versions add gemini-api-key \
        --data-file=-

    log_info "シークレットを設定しました"
}

# ----------------------------------------------
# Terraformでのデプロイ
# ----------------------------------------------
deploy_terraform() {
    log_info "Terraformでインフラをデプロイ中..."
    cd ../terraform

    # terraform.tfvarsを生成
    cat > terraform.tfvars << EOF
project_id     = "${GCP_PROJECT_ID}"
region         = "${GCP_REGION}"
gemini_api_key = "${GEMINI_API_KEY}"
EOF

    terraform init
    terraform plan
    terraform apply -auto-approve

    cd ../scripts
}

# ----------------------------------------------
# メイン処理
# ----------------------------------------------
main() {
    log_info "=========================================="
    log_info "帳票データ化システム デプロイ開始"
    log_info "=========================================="

    case "${1:-all}" in
        setup)
            setup_gcp
            setup_secrets
            ;;
        backend)
            deploy_backend
            ;;
        frontend)
            deploy_frontend
            ;;
        terraform)
            deploy_terraform
            ;;
        all)
            setup_gcp
            setup_secrets
            deploy_backend
            deploy_frontend
            ;;
        *)
            echo "Usage: $0 {setup|backend|frontend|terraform|all}"
            exit 1
            ;;
    esac

    log_info "=========================================="
    log_info "デプロイが完了しました！"
    log_info "=========================================="

    if [ -f "../.env.deployed" ]; then
        log_info "デプロイ情報:"
        cat ../.env.deployed
    fi
}

main "$@"
