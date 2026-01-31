"""
帳票データ化 & 自動整形 API
GCP Cloud Run + Gemini 2.0 Flash
"""

import os
import json
import base64
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from google.cloud import storage
from firebase_admin import auth, credentials, initialize_app
import firebase_admin

# Firebase Admin初期化
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    initialize_app(cred)

app = FastAPI(title="帳票データ化API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に制限
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 環境変数
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# デフォルトプロンプト
DEFAULT_PROMPTS = {
    "invoice": """この画像を「請求書」として読み取り、以下の情報を JSON 形式のリストで出力してください。
ページ内に複数の請求書がある場合や、複数ページの場合は、すべてリスト化してください。

【重要：会社ごとの特殊ルール（最優先）】
1. **「株式会社グラフィッククリエーション」の場合：**
   - 「今回発生額（current_billing_amount）」には、明細行にある「税抜御買上額」と「消費税額等」を足した合計値を入れてください。（※一番右の「今回御請求額」ではありません）

2. **「戸田工業株式会社」の場合：**
   - 「今回発生額（current_billing_amount）」には、「今回お買上高」欄の中にある「合計金額」を入れてください。（※右端の「今回ご請求高」ではありません）

3. **その他の会社（基本ルール）：**
   - 「前回請求額」 - 「入金額」 = 「繰越額」 の関係が成り立つ場所を探してください。
   - 「今回発生額（current_billing_amount）」は、今回新しく発生した「合計請求金額（税込）」または「今回売上高」を抽出してください。
   - 都度払い（スポット）で前回額などの記載がない場合は、0 または null にしてください。

【出力項目】
Markdown 記法は禁止。純粋な JSON テキストのみ出力すること。
ルート要素は "invoices" という配列にする。

{
  "invoices": [
    {
      "supplier": "請求元の会社名",
      "issue_date": "請求書発行日（YYYY/MM/DD 形式、なければ null）",
      "closing_date": "締日（YYYY/MM/DD 形式、なければ null）",
      "previous_balance": "前回請求額（数値のみ、なければ 0）",
      "payment_amount": "入金額（数値のみ、なければ 0）",
      "carried_over_amount": "繰越額（数値のみ、なければ 0）",
      "current_billing_amount": "今回発生額（ルールに基づいて抽出）"
    }
  ]
}""",
    "delivery": """以下のPDF画像は納品書です。以下の情報を抽出してJSON形式で出力してください：
- 納品書番号
- 納品日
- 納品元（会社名、住所、電話番号）
- 納品先（会社名、住所）
- 明細（品名、数量、単価、金額）のリスト
- 合計金額
- 備考

出力形式:
```json
{
  "delivery_number": "",
  "delivery_date": "",
  "vendor": {"name": "", "address": "", "phone": ""},
  "client": {"name": "", "address": ""},
  "items": [{"name": "", "quantity": 0, "unit_price": 0, "amount": 0}],
  "total": 0,
  "remarks": ""
}
```"""
}

# カスタムプロンプト保存用（本番ではDBに保存）
custom_prompts = {}


class PromptUpdate(BaseModel):
    document_type: str
    prompt: str


class ProcessRequest(BaseModel):
    document_type: str  # "invoice" or "delivery"
    custom_prompt: Optional[str] = None


class APIKeyUpdate(BaseModel):
    api_key: str


async def verify_token(authorization: str = Header(...)) -> dict:
    """Firebase IDトークンを検証"""
    try:
        token = authorization.replace("Bearer ", "")
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"認証エラー: {str(e)}")


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}


@app.post("/api/process")
async def process_document(
    file: UploadFile = File(...),
    document_type: str = Form("invoice"),
    user: dict = Depends(verify_token)
):
    """
    PDFをアップロードしてGemini 2.0 Flashで解析
    """
    if not file.filename.lower().endswith(('.pdf', '.png', '.jpg', '.jpeg')):
        raise HTTPException(status_code=400, detail="PDF、PNG、JPGファイルのみ対応")

    try:
        # ファイルを読み込み
        contents = await file.read()

        # Gemini APIの設定
        api_key = GEMINI_API_KEY
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini APIキーが設定されていません")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash-exp")

        # プロンプト取得（カスタムまたはデフォルト）
        user_id = user.get("uid", "default")
        prompt = custom_prompts.get(f"{user_id}_{document_type}") or DEFAULT_PROMPTS.get(document_type)

        if not prompt:
            raise HTTPException(status_code=400, detail="無効なドキュメントタイプ")

        # 画像データをBase64エンコード
        image_data = base64.b64encode(contents).decode("utf-8")

        # MIMEタイプの判定
        if file.filename.lower().endswith('.pdf'):
            mime_type = "application/pdf"
        elif file.filename.lower().endswith('.png'):
            mime_type = "image/png"
        else:
            mime_type = "image/jpeg"

        # Geminiに送信
        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_data}
        ])

        # JSONを抽出
        result_text = response.text

        # JSON部分を抽出
        if "```json" in result_text:
            json_str = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            json_str = result_text.split("```")[1].split("```")[0].strip()
        else:
            json_str = result_text.strip()

        try:
            parsed_data = json.loads(json_str)
        except json.JSONDecodeError:
            parsed_data = {"raw_text": result_text}

        return {
            "success": True,
            "document_type": document_type,
            "data": parsed_data,
            "raw_response": result_text
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"処理エラー: {str(e)}")


@app.get("/api/prompts/{document_type}")
async def get_prompt(document_type: str, user: dict = Depends(verify_token)):
    """プロンプトを取得"""
    user_id = user.get("uid", "default")
    custom = custom_prompts.get(f"{user_id}_{document_type}")
    default = DEFAULT_PROMPTS.get(document_type)

    return {
        "document_type": document_type,
        "prompt": custom or default,
        "is_custom": custom is not None
    }


@app.put("/api/prompts")
async def update_prompt(data: PromptUpdate, user: dict = Depends(verify_token)):
    """プロンプトを更新"""
    user_id = user.get("uid", "default")
    key = f"{user_id}_{data.document_type}"
    custom_prompts[key] = data.prompt

    return {
        "success": True,
        "message": "プロンプトを更新しました"
    }


@app.post("/api/prompts/test")
async def test_prompt(
    file: UploadFile = File(...),
    document_type: str = Form("invoice"),
    prompt: str = Form(""),
    user: dict = Depends(verify_token)
):
    """プロンプトをテスト実行"""
    if not prompt:
        prompt = DEFAULT_PROMPTS.get(document_type, "")

    try:
        contents = await file.read()

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash-exp")

        image_data = base64.b64encode(contents).decode("utf-8")

        if file.filename.lower().endswith('.pdf'):
            mime_type = "application/pdf"
        elif file.filename.lower().endswith('.png'):
            mime_type = "image/png"
        else:
            mime_type = "image/jpeg"

        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_data}
        ])

        return {
            "success": True,
            "result": response.text
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"テストエラー: {str(e)}")


@app.delete("/api/prompts/{document_type}")
async def reset_prompt(document_type: str, user: dict = Depends(verify_token)):
    """プロンプトをデフォルトにリセット"""
    user_id = user.get("uid", "default")
    key = f"{user_id}_{document_type}"

    if key in custom_prompts:
        del custom_prompts[key]

    return {
        "success": True,
        "message": "プロンプトをデフォルトにリセットしました"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
