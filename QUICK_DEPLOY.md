# クイックデプロイガイド

詳細は `MIGRATION_GUIDE.md` を参照してください。

---

## 事前準備完了チェックリスト

- [ ] GCPプロジェクト作成済み
- [ ] Firebase設定済み
- [ ] Artifact Registry作成済み
- [ ] Gemini APIキー取得済み
- [ ] gcloud CLIインストール済み

---

## デプロイコマンド

### 1. プロジェクト設定
```bash
gcloud config set project 【プロジェクトID】
```

### 2. バックエンドデプロイ
```bash
cd backend

gcloud builds submit \
  --config cloudbuild.yaml \
  --region=asia-northeast1 \
  --substitutions=_GEMINI_API_KEY="【GeminiのAPIキー】"
```

### 3. フロントエンドのcloudbuild.yaml更新

`frontend/cloudbuild.yaml` の以下を更新：
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_API_URL（バックエンドのURL）
- イメージタグのプロジェクトID

### 4. フロントエンドデプロイ
```bash
cd frontend

gcloud builds submit \
  --config cloudbuild.yaml \
  --region=asia-northeast1
```

### 5. Firebase承認ドメイン追加

Firebaseコンソール → Authentication → Settings → 承認済みドメイン
→ フロントエンドのドメインを追加

---

## 取得したURL

| サービス | URL |
|----------|-----|
| バックエンド | |
| フロントエンド | |

---

## 権限エラーが出た場合

```bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```
