import { useState, useEffect, useRef } from 'react'
import { getPrompt, updatePrompt, resetPrompt, testPrompt } from '../services/api'

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('invoice')
  const [prompt, setPrompt] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [testFile, setTestFile] = useState(null)
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadPrompt(activeTab)
  }, [activeTab])

  const loadPrompt = async (type) => {
    setLoading(true)
    try {
      const data = await getPrompt(type)
      setPrompt(data.prompt)
      setIsCustom(data.is_custom)
    } catch (err) {
      setMessage({ type: 'error', text: 'プロンプトの読み込みに失敗しました' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await updatePrompt(activeTab, prompt)
      setMessage({ type: 'success', text: 'プロンプトを保存しました' })
      setIsCustom(true)
    } catch (err) {
      setMessage({ type: 'error', text: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('プロンプトをデフォルトにリセットしますか？')) return

    setSaving(true)
    try {
      await resetPrompt(activeTab)
      await loadPrompt(activeTab)
      setMessage({ type: 'success', text: 'デフォルトにリセットしました' })
    } catch (err) {
      setMessage({ type: 'error', text: 'リセットに失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testFile) {
      setMessage({ type: 'error', text: 'テスト用ファイルを選択してください' })
      return
    }

    setTesting(true)
    setTestResult('')
    setMessage({ type: '', text: '' })

    try {
      const result = await testPrompt(testFile, activeTab, prompt)
      setTestResult(result.result)
      setMessage({ type: 'success', text: 'テスト実行が完了しました' })
    } catch (err) {
      setMessage({ type: 'error', text: 'テスト実行に失敗しました' })
    } finally {
      setTesting(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setTestFile(file)
    }
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <div className="card">
        <h2 className="card-title">プロンプト設定</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          AI解析に使用するプロンプトをカスタマイズできます。
          設定画面でユーザー自身が修正・テスト実行可能です。
        </p>

        {/* タブ */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'invoice' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoice')}
          >
            請求書
          </button>
          <button
            className={`tab ${activeTab === 'delivery' ? 'active' : ''}`}
            onClick={() => setActiveTab('delivery')}
          >
            納品書
          </button>
        </div>

        {/* メッセージ */}
        {message.text && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* プロンプトエディタ */}
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold' }}>
                プロンプト
                {isCustom && (
                  <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#667eea' }}>
                    (カスタム)
                  </span>
                )}
              </label>
              {isCustom && (
                <button
                  className="btn btn-secondary"
                  onClick={handleReset}
                  disabled={saving}
                  style={{ padding: '5px 15px', fontSize: '0.9rem' }}
                >
                  デフォルトに戻す
                </button>
              )}
            </div>
            <textarea
              className="prompt-editor"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="プロンプトを入力してください..."
            />

            <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* テスト実行 */}
      <div className="card">
        <h2 className="card-title">プロンプトをテスト</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          プロンプトを保存する前に、サンプルファイルでテスト実行できます。
        </p>

        <div style={{ marginBottom: '15px' }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
          />
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            テスト用ファイルを選択
          </button>
          {testFile && (
            <span style={{ marginLeft: '15px' }}>
              選択中: <strong>{testFile.name}</strong>
            </span>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleTest}
          disabled={testing || !testFile}
        >
          {testing ? 'テスト実行中...' : 'テスト実行'}
        </button>

        {testing && (
          <div className="loading" style={{ marginTop: '20px' }}>
            <div className="spinner"></div>
            <p>Gemini 2.0 Flashで解析中...</p>
          </div>
        )}

        {testResult && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>テスト結果</h3>
            <div className="json-display">
              <pre>{testResult}</pre>
            </div>
          </div>
        )}
      </div>

      {/* ヘルプ */}
      <div className="card">
        <h2 className="card-title">プロンプト作成のヒント</h2>
        <ul style={{ paddingLeft: '20px', color: '#555' }}>
          <li style={{ marginBottom: '10px' }}>
            <strong>JSON形式を指定:</strong> 出力形式を明確にJSONで指定すると、データ抽出が安定します。
          </li>
          <li style={{ marginBottom: '10px' }}>
            <strong>フィールド名を明示:</strong> 抽出したい項目を具体的にリストアップしてください。
          </li>
          <li style={{ marginBottom: '10px' }}>
            <strong>例示を含める:</strong> 出力例を含めると、AIがより正確に理解します。
          </li>
          <li style={{ marginBottom: '10px' }}>
            <strong>言語を指定:</strong> 日本語で回答してほしい場合は、その旨を記載してください。
          </li>
        </ul>
      </div>
    </div>
  )
}

export default SettingsPage
