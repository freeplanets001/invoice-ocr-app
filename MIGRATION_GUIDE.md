# 帳票データ化アプリ - GCP環境移行マニュアル

このマニュアルでは、帳票データ化アプリを新しいGCPアカウント/プロジェクトに移行する手順を説明します。

---

## 目次

1. [事前準備](#1-事前準備)
2. [GCPプロジェクトの作成](#2-gcpプロジェクトの作成)
3. [必要なAPIの有効化](#3-必要なapiの有効化)
4. [Firebaseプロジェクトの設定](#4-firebaseプロジェクトの設定)
5. [Artifact Registryの作成](#5-artifact-registryの作成)
6. [Gemini APIキーの取得](#6-gemini-apiキーの取得)
7. [設定ファイルの更新](#7-設定ファイルの更新)
8. [バックエンドのデプロイ](#8-バックエンドのデプロイ)
9. [フロントエンドのデプロイ](#9-フロントエンドのデプロイ)
10. [動作確認](#10-動作確認)
11. [トラブルシューティング](#11-トラブルシューティング)

---

## 1. 事前準備

### 必要なもの

- [ ] Googleアカウント（GCPに使用）
- [ ] クレジットカード（GCP課金設定用、無料枠あり）
- [ ] パソコン（Windows/Mac/Linux）
- [ ] このアプリのソースコード一式

### 必要なツールのインストール

#### 1.1 Google Cloud SDK（gcloud）のインストール

**Macの場合：**
```bash
# Homebrewを使用
brew install --cask google-cloud-sdk
```

**Windowsの場合：**
1. https://cloud.google.com/sdk/docs/install にアクセス
2. 「Windows用インストーラ」をダウンロード
3. ダウンロードしたファイルを実行してインストール

**インストール確認：**
```bash
gcloud --version
```
バージョン番号が表示されればOKです。

#### 1.2 gcloudの初期設定

```bash
gcloud init
```

画面の指示に従って：
1. Googleアカウントでログイン（ブラウザが開きます）
2. プロジェクトの選択（後で作成するので「Create a new project」は選ばずスキップしてOK）

---

## 2. GCPプロジェクトの作成

### 2.1 GCPコンソールにアクセス

1. ブラウザで https://console.cloud.google.com/ を開く
2. Googleアカウントでログイン

### 2.2 新しいプロジェクトを作成

1. 画面上部の「プロジェクトを選択」をクリック
2. 右上の「新しいプロジェクト」をクリック
3. 以下を入力：
   - **プロジェクト名**: `invoice-app`（任意の名前でOK）
   - **プロジェクトID**: 自動生成されます（メモしておいてください）
   - **場所**: 「組織なし」のままでOK
4. 「作成」をクリック

> **重要**: プロジェクトIDは後で何度も使います。例: `invoice-app-123456`

### 2.3 課金の有効化

1. 左メニューから「お支払い」を選択
2. 「アカウントをリンク」または「課金を有効にする」をクリック
3. クレジットカード情報を入力

> **補足**: 無料トライアル（$300分）があるので、テスト段階では課金されません。

---

## 3. 必要なAPIの有効化

GCPコンソールで以下のAPIを有効にします。

### 3.1 APIを有効化する方法

1. 左メニュー → 「APIとサービス」→「ライブラリ」
2. 検索ボックスでAPI名を検索
3. 該当のAPIをクリック
4. 「有効にする」をクリック

### 3.2 有効にするAPI一覧

以下のAPIを1つずつ有効化してください：

| API名 | 用途 |
|-------|------|
| Cloud Run Admin API | アプリのホスティング |
| Cloud Build API | 自動ビルド・デプロイ |
| Artifact Registry API | Dockerイメージの保存 |
| Secret Manager API | シークレット管理 |
| Generative Language API | Gemini AI |

### 3.3 コマンドで一括有効化（上級者向け）

```bash
# プロジェクトを設定
gcloud config set project YOUR_PROJECT_ID

# APIを有効化
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  generativelanguage.googleapis.com
```

> `YOUR_PROJECT_ID` は実際のプロジェクトIDに置き換えてください

---

## 4. Firebaseプロジェクトの設定

Firebaseは認証（ログイン機能）に使用します。

### 4.1 Firebaseコンソールにアクセス

1. https://console.firebase.google.com/ を開く
2. Googleアカウントでログイン

### 4.2 Firebaseプロジェクトを作成

1. 「プロジェクトを追加」をクリック
2. **先ほど作成したGCPプロジェクトを選択**（新規作成ではなく、既存のGCPプロジェクトを選ぶ）
3. 「続行」をクリック
4. Google アナリティクスは「今は設定しない」でOK
5. 「Firebaseを追加」をクリック

### 4.3 認証（Authentication）の設定

1. 左メニュー →「Authentication」をクリック
2. 「始める」をクリック
3. 「メール/パスワード」をクリック
4. 「有効にする」をオンにして「保存」

### 4.4 ウェブアプリの追加

1. プロジェクト概要画面で「</>」（ウェブ）アイコンをクリック
2. アプリのニックネームを入力（例: `invoice-frontend`）
3. 「アプリを登録」をクリック
4. 表示される設定情報をメモ（後で使います）：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← メモ
  authDomain: "xxx.firebaseapp.com",  // ← メモ
  projectId: "xxx",              // ← メモ
  storageBucket: "xxx.appspot.com",   // ← メモ
  messagingSenderId: "123456789",     // ← メモ
  appId: "1:123456789:web:abc123"     // ← メモ
};
```

### 4.5 承認済みドメインの追加

Cloud Runにデプロイ後、そのURLを承認済みドメインに追加する必要があります（後で行います）。

---

## 5. Artifact Registryの作成

DockerイメージをGCPに保存するための場所を作ります。

### 5.1 GCPコンソールで作成

1. GCPコンソール → 左メニュー →「Artifact Registry」
2. 「リポジトリを作成」をクリック
3. 以下を入力：
   - **名前**: `invoice-app`
   - **形式**: `Docker`
   - **モード**: `標準`
   - **ロケーションタイプ**: `リージョン`
   - **リージョン**: `asia-northeast1（東京）`
4. 「作成」をクリック

### 5.2 コマンドで作成（上級者向け）

```bash
gcloud artifacts repositories create invoice-app \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Invoice App Docker images"
```

---

## 6. Gemini APIキーの取得

AIによる帳票読み取りに使用するAPIキーを取得します。

### 6.1 Google AI Studioでキーを作成

1. https://aistudio.google.com/ にアクセス
2. Googleアカウントでログイン
3. 左メニュー →「Get API key」をクリック
4. 「Create API key」をクリック
5. 先ほど作成したGCPプロジェクトを選択
6. 表示されたAPIキーをメモ（安全な場所に保管）

> **重要**: APIキーは他人に見せないでください

---

## 7. 設定ファイルの更新

ソースコード内の設定を新しいプロジェクト用に更新します。

### 7.1 フロントエンドの設定（cloudbuild.yaml）

`frontend/cloudbuild.yaml` を開いて以下を更新：

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--platform'
      - 'linux/amd64'
      - '--build-arg'
      - 'VITE_FIREBASE_API_KEY=【FirebaseのapiKey】'
      - '--build-arg'
      - 'VITE_FIREBASE_AUTH_DOMAIN=【FirebaseのauthDomain】'
      - '--build-arg'
      - 'VITE_FIREBASE_PROJECT_ID=【FirebaseのprojectId】'
      - '--build-arg'
      - 'VITE_FIREBASE_STORAGE_BUCKET=【FirebaseのstorageBucket】'
      - '--build-arg'
      - 'VITE_FIREBASE_MESSAGING_SENDER_ID=【FirebaseのmessagingSenderId】'
      - '--build-arg'
      - 'VITE_FIREBASE_APP_ID=【FirebaseのappId】'
      - '--build-arg'
      - 'VITE_API_URL=【バックエンドのURL（後で設定）】'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/frontend:latest'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/frontend:latest'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'invoice-frontend'
      - '--image'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/frontend:latest'
      - '--region'
      - 'asia-northeast1'
      - '--port'
      - '80'
      - '--allow-unauthenticated'

images:
  - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/frontend:latest'
```

### 7.2 バックエンドの設定（cloudbuild.yaml）

`backend/cloudbuild.yaml` を開いて以下を更新：

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--platform'
      - 'linux/amd64'
      - '-t'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/backend:latest'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/backend:latest'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'invoice-api'
      - '--image'
      - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/backend:latest'
      - '--region'
      - 'asia-northeast1'
      - '--port'
      - '8080'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'GCP_PROJECT_ID=【プロジェクトID】,GEMINI_API_KEY=【GeminiのAPIキー】'

images:
  - 'asia-northeast1-docker.pkg.dev/【プロジェクトID】/invoice-app/backend:latest'
```

### 7.3 置き換える項目一覧

| 項目 | 説明 | 例 |
|------|------|-----|
| 【プロジェクトID】 | GCPプロジェクトID | `invoice-app-123456` |
| 【FirebaseのapiKey】 | Firebaseの設定 | `AIzaSy...` |
| 【FirebaseのauthDomain】 | Firebaseの設定 | `invoice-app-123456.firebaseapp.com` |
| 【FirebaseのprojectId】 | Firebaseの設定 | `invoice-app-123456` |
| 【FirebaseのstorageBucket】 | Firebaseの設定 | `invoice-app-123456.appspot.com` |
| 【FirebaseのmessagingSenderId】 | Firebaseの設定 | `123456789012` |
| 【FirebaseのappId】 | Firebaseの設定 | `1:123456789012:web:abc123def456` |
| 【GeminiのAPIキー】 | Google AI Studio | `AIzaSy...` |
| 【バックエンドのURL】 | デプロイ後に取得 | `https://invoice-api-xxx.asia-northeast1.run.app` |

---

## 8. バックエンドのデプロイ

### 8.1 ターミナルを開く

- **Mac**: アプリケーション → ユーティリティ → ターミナル
- **Windows**: スタートメニュー → 「cmd」で検索 → コマンドプロンプト

### 8.2 プロジェクトを設定

```bash
gcloud config set project 【プロジェクトID】
```

### 8.3 バックエンドフォルダに移動

```bash
cd /path/to/invoice-app/backend
```

> `/path/to/invoice-app` は実際のフォルダパスに置き換えてください

### 8.4 デプロイを実行

```bash
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast1
```

### 8.5 デプロイ完了を確認

成功すると以下のようなメッセージが表示されます：

```
Service [invoice-api] revision [invoice-api-00001-xxx] has been deployed
Service URL: https://invoice-api-XXXXXXXXXX.asia-northeast1.run.app
```

この **Service URL** をメモしてください（フロントエンドの設定に使います）。

---

## 9. フロントエンドのデプロイ

### 9.1 バックエンドURLを設定

`frontend/cloudbuild.yaml` の `VITE_API_URL` を、先ほどメモしたバックエンドのURLに更新します。

例：
```yaml
- 'VITE_API_URL=https://invoice-api-123456789.asia-northeast1.run.app'
```

### 9.2 フロントエンドフォルダに移動

```bash
cd /path/to/invoice-app/frontend
```

### 9.3 デプロイを実行

```bash
gcloud builds submit --config cloudbuild.yaml --region=asia-northeast1
```

### 9.4 デプロイ完了を確認

成功すると以下のようなメッセージが表示されます：

```
Service [invoice-frontend] revision [invoice-frontend-00001-xxx] has been deployed
Service URL: https://invoice-frontend-XXXXXXXXXX.asia-northeast1.run.app
```

この **Service URL** がアプリにアクセスするURLです。

---

## 10. 動作確認

### 10.1 Firebase承認済みドメインの追加

1. Firebaseコンソール → Authentication → Settings
2. 「承認済みドメイン」タブ
3. 「ドメインを追加」をクリック
4. フロントエンドのドメインを追加（例: `invoice-frontend-xxx.asia-northeast1.run.app`）

### 10.2 アプリにアクセス

1. ブラウザでフロントエンドのURLを開く
2. アカウント作成/ログインができるか確認
3. 帳票をアップロードしてデータ抽出ができるか確認

### 10.3 確認項目チェックリスト

- [ ] ログイン画面が表示される
- [ ] 新規アカウントが作成できる
- [ ] ログインできる
- [ ] ファイルアップロードができる
- [ ] AIによるデータ抽出が動作する
- [ ] Excelダウンロードができる

---

## 11. トラブルシューティング

### Q1: デプロイ時に「Permission denied」エラーが出る

**原因**: 権限が不足しています

**解決方法**:
```bash
# Cloud Buildサービスアカウントに権限を付与
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

### Q2: ログインできない

**確認ポイント**:
1. FirebaseでAuthentication（メール/パスワード）が有効になっているか
2. 承認済みドメインにCloud RunのURLが追加されているか
3. `cloudbuild.yaml`のFirebase設定が正しいか

### Q3: 帳票の読み取りができない

**確認ポイント**:
1. Gemini APIキーが正しく設定されているか
2. バックエンドのCloud Runログを確認
   - GCPコンソール → Cloud Run → invoice-api → ログ

### Q4: 「APIが有効になっていません」エラー

**解決方法**:
セクション3の手順に従って、必要なAPIを有効化してください。

### Q5: Cloud Buildが途中で失敗する

**確認ポイント**:
1. Dockerfileが正しいか
2. package.jsonに必要な依存関係があるか
3. Cloud Buildのログで詳細を確認

ログの確認方法：
```bash
gcloud builds list --limit=5
gcloud builds log 【BUILD_ID】
```

---

## 設定値まとめシート

デプロイ作業中に取得した値をメモしておくと便利です。

| 項目 | 値 |
|------|-----|
| GCPプロジェクトID | |
| Firebase apiKey | |
| Firebase authDomain | |
| Firebase projectId | |
| Firebase storageBucket | |
| Firebase messagingSenderId | |
| Firebase appId | |
| Gemini APIキー | |
| バックエンドURL | |
| フロントエンドURL | |

---

## 料金について

### 無料枠

- Cloud Run: 毎月200万リクエストまで無料
- Cloud Build: 毎月120分まで無料
- Artifact Registry: 0.5GBまで無料
- Firebase Authentication: 無料

### 料金が発生する場合

- 大量のリクエストがある場合
- Gemini APIの使用量が多い場合

> 個人利用や小規模利用であれば、ほぼ無料枠内で収まります。

---

## サポート

問題が解決しない場合は、以下の情報を添えてお問い合わせください：

1. エラーメッセージの全文
2. 実行したコマンド
3. GCPコンソールのCloud Buildログ
4. どの手順で問題が発生したか

---

作成日: 2026年1月25日
