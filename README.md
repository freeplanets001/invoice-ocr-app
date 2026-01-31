# 帳票データ化 & 自動整形 Webアプリ

請求書・納品書をAI（Gemini 2.0 Flash）で自動解析し、データ化するWebアプリケーションです。

## 機能

- PDFファイル（請求書/納品書）のアップロード
- Gemini 2.0 FlashによるAI解析
- 解析結果をワンクリックでExcel形式にコピー
- プロンプトのカスタマイズ・テスト機能
- Firebase Authによるログイン認証

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React (Vite) |
| バックエンド | Python (FastAPI) |
| AI | Gemini 2.0 Flash |
| 認証 | Firebase Auth |
| インフラ | GCP Cloud Run |
| IaC | Terraform |

## プロジェクト構造

```
invoice-app/
├── frontend/          # Reactフロントエンド
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   ├── Dockerfile
│   └── package.json
├── backend/           # FastAPIバックエンド
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── terraform/         # インフラ定義
│   └── main.tf
└── scripts/           # デプロイスクリプト
    └── deploy.sh
```

## セットアップ

### 1. 前提条件

- GCPアカウント & プロジェクト
- gcloud CLI インストール済み
- Docker インストール済み
- Node.js 20+ インストール済み
- Python 3.11+ インストール済み

### 2. GCPプロジェクトの準備

```bash
# GCPにログイン
gcloud auth login

# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID
```

### 3. Firebase設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Authentication を有効化し、Google ログインを設定
3. ウェブアプリを追加し、設定情報を取得

### 4. Gemini API Keyの取得

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. API Keyを作成

### 5. 環境変数の設定

```bash
cd scripts
cp .env.example .env
# .envファイルを編集して必要な情報を入力
```

### 6. デプロイ

```bash
# 実行権限を付与
chmod +x deploy.sh

# 全てをデプロイ
./deploy.sh all

# または個別にデプロイ
./deploy.sh setup      # 初期セットアップ
./deploy.sh backend    # バックエンドのみ
./deploy.sh frontend   # フロントエンドのみ
```

## ローカル開発

### バックエンド

```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=your-api-key
uvicorn main:app --reload --port 8080
```

### フロントエンド

```bash
cd frontend
npm install
cp .env.example .env.local
# .env.localを編集
npm run dev
```

## API エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | /health | ヘルスチェック |
| POST | /api/process | PDF解析 |
| GET | /api/prompts/{type} | プロンプト取得 |
| PUT | /api/prompts | プロンプト更新 |
| POST | /api/prompts/test | プロンプトテスト |
| DELETE | /api/prompts/{type} | プロンプトリセット |

## セキュリティ

- Firebase Auth によるトークン認証
- Cloud Run の自動スケーリング
- Secret Manager によるAPIキー管理
- HTTPS強制（Cloud Run標準）

## コスト最適化

- Cloud Run: 最小インスタンス0で未使用時は課金なし
- Gemini 2.0 Flash: 高速・低コストモデル使用

## ライセンス

Private
