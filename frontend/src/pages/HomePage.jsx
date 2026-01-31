import { useState, useRef, useEffect, useCallback } from 'react'
import { testPrompt } from '../services/api'
import * as XLSX from 'xlsx'

// 帳票タイプ
const DOCUMENT_TYPES = {
  invoice: { id: 'invoice', label: '請求書', icon: '📄' },
  delivery: { id: 'delivery', label: '納品書', icon: '📦' },
}

// プリセット項目（よく使う抽出項目）- 請求書用
const PRESET_FIELDS_INVOICE = [
  { id: 'company_name', label: '会社名（請求元）', description: '請求書を発行した会社名' },
  { id: 'issue_date', label: '発行日', description: '請求書の発行日' },
  { id: 'closing_date', label: '締日', description: '締め日' },
  { id: 'due_date', label: '支払期限', description: '支払い期限日' },
  { id: 'invoice_number', label: '請求書番号', description: '請求書の番号' },
  { id: 'previous_balance', label: '前回請求額', description: '前回の請求金額' },
  { id: 'payment_received', label: '入金額', description: '入金された金額' },
  { id: 'carried_over', label: '繰越額', description: '繰り越し金額' },
  { id: 'current_amount', label: '今回発生額', description: '今回新規に発生した金額' },
  { id: 'subtotal', label: '小計', description: '税抜き小計' },
  { id: 'tax', label: '消費税', description: '消費税額' },
  { id: 'total', label: '合計金額', description: '税込み合計金額' },
  { id: 'tax_excluded_purchase', label: '税抜御買上額', description: '税抜きの購入金額' },
  { id: 'tax_amount', label: '消費税額等', description: '消費税額' },
  { id: 'current_purchase', label: '今回お買上高', description: '今回のお買い上げ金額' },
  { id: 'total_request', label: '今回御請求額', description: '今回の請求総額' },
  { id: 'adjustment', label: '調整額', description: '調整金額' },
  { id: 'discount', label: '値引', description: '値引き金額' },
]

// プリセット項目（よく使う抽出項目）- 納品書用
const PRESET_FIELDS_DELIVERY = [
  { id: 'company_name', label: '会社名（納品元）', description: '納品書を発行した会社名' },
  { id: 'delivery_date', label: '納品日', description: '納品日' },
  { id: 'delivery_number', label: '納品書番号', description: '納品書の番号' },
  { id: 'client_name', label: '納品先', description: '納品先の会社名' },
  { id: 'product_name', label: '品名', description: '商品・品目名' },
  { id: 'quantity', label: '数量', description: '数量' },
  { id: 'unit_price', label: '単価', description: '単価' },
  { id: 'amount', label: '金額', description: '金額' },
  { id: 'subtotal', label: '小計', description: '税抜き小計' },
  { id: 'tax', label: '消費税', description: '消費税額' },
  { id: 'total', label: '合計金額', description: '税込み合計金額' },
  { id: 'remarks', label: '備考', description: '備考欄' },
]

// ★ デフォルトの会社別ルール（統一管理）
const DEFAULT_COMPANY_RULES = `■「株式会社グラフィッククリエーション」の場合：
「今回御請求額」には、帳票から「税抜御買上額」の値と「消費税額等」の値を足し算した合計を入れる。
（帳票の右端にある「今回御請求額」欄の数値をそのまま使ってはいけない）
計算式：今回御請求額 = 税抜御買上額 + 消費税額等

■「戸田工業株式会社」の場合：
「今回御請求額」には、「今回お買上高」セクション内の「合計金額」を入れる。
（右端の「今回ご請求高」欄の値ではない）

■その他の会社（デフォルト）：
帳票に記載されている値をそのまま抽出する。`

// ★ プリセットテンプレート（すぐに使える設定）- 請求書用
const PRESET_TEMPLATES_INVOICE = [
  {
    id: 'preset_graphic_creation',
    name: 'グラフィッククリエーション用',
    documentType: 'invoice',
    isPreset: true,
    fields: [
      { id: 'f1', key: 'field_1', label: '前回御請求額', extractName: '前回御請求額', column: 'A', enabled: true },
      { id: 'f2', key: 'field_2', label: '御入金金額', extractName: '御入金金額', column: 'B', enabled: true },
      { id: 'f3', key: 'field_3', label: '調整額', extractName: '調整額', column: 'C', enabled: true },
      { id: 'f4', key: 'field_4', label: '差引繰越金額', extractName: '差引繰越金額', column: 'D', enabled: true },
      { id: 'f5', key: 'field_5', label: '税抜御買上額', extractName: '税抜御買上額', column: 'E', enabled: true },
      { id: 'f6', key: 'field_6', label: '消費税額等', extractName: '消費税額等', column: 'F', enabled: true },
      { id: 'f7', key: 'field_7', label: '今回御請求額', extractName: '今回御請求額', column: 'G', enabled: true },
    ],
  },
  {
    id: 'preset_toda',
    name: '戸田工業用',
    documentType: 'invoice',
    isPreset: true,
    fields: [
      { id: 'f1', key: 'field_1', label: '前回請求額', extractName: '前回請求額', column: 'A', enabled: true },
      { id: 'f2', key: 'field_2', label: '入金額', extractName: '入金額', column: 'B', enabled: true },
      { id: 'f3', key: 'field_3', label: '繰越額', extractName: '繰越額', column: 'C', enabled: true },
      { id: 'f4', key: 'field_4', label: '今回お買上高', extractName: '今回お買上高', column: 'D', enabled: true },
      { id: 'f5', key: 'field_5', label: '今回御請求額', extractName: '今回御請求額', column: 'E', enabled: true },
    ],
  },
  {
    id: 'preset_standard_invoice',
    name: '標準請求書',
    documentType: 'invoice',
    isPreset: true,
    fields: [
      { id: 'f1', key: 'field_1', label: '会社名（請求元）', extractName: '会社名（請求元）', column: 'A', enabled: true },
      { id: 'f2', key: 'field_2', label: '発行日', extractName: '発行日', column: 'B', enabled: true },
      { id: 'f3', key: 'field_3', label: '前回請求額', extractName: '前回請求額', column: 'C', enabled: true },
      { id: 'f4', key: 'field_4', label: '入金額', extractName: '入金額', column: 'D', enabled: true },
      { id: 'f5', key: 'field_5', label: '繰越額', extractName: '繰越額', column: 'E', enabled: true },
      { id: 'f6', key: 'field_6', label: '今回発生額', extractName: '今回発生額', column: 'F', enabled: true },
      { id: 'f7', key: 'field_7', label: '合計金額', extractName: '合計金額', column: 'G', enabled: true },
    ],
  },
]

// ★ プリセットテンプレート（すぐに使える設定）- 納品書用
const PRESET_TEMPLATES_DELIVERY = [
  {
    id: 'preset_standard_delivery',
    name: '標準納品書',
    documentType: 'delivery',
    isPreset: true,
    fields: [
      { id: 'f1', key: 'field_1', label: '会社名（納品元）', extractName: '会社名（納品元）', column: 'A', enabled: true },
      { id: 'f2', key: 'field_2', label: '納品日', extractName: '納品日', column: 'B', enabled: true },
      { id: 'f3', key: 'field_3', label: '納品書番号', extractName: '納品書番号', column: 'C', enabled: true },
      { id: 'f4', key: 'field_4', label: '納品先', extractName: '納品先', column: 'D', enabled: true },
      { id: 'f5', key: 'field_5', label: '小計', extractName: '小計', column: 'E', enabled: true },
      { id: 'f6', key: 'field_6', label: '消費税', extractName: '消費税', column: 'F', enabled: true },
      { id: 'f7', key: 'field_7', label: '合計金額', extractName: '合計金額', column: 'G', enabled: true },
    ],
  },
  {
    id: 'preset_delivery_detail',
    name: '納品書（明細付き）',
    documentType: 'delivery',
    isPreset: true,
    fields: [
      { id: 'f1', key: 'field_1', label: '納品元', extractName: '納品元', column: 'A', enabled: true },
      { id: 'f2', key: 'field_2', label: '納品日', extractName: '納品日', column: 'B', enabled: true },
      { id: 'f3', key: 'field_3', label: '品名', extractName: '品名', column: 'C', enabled: true },
      { id: 'f4', key: 'field_4', label: '数量', extractName: '数量', column: 'D', enabled: true },
      { id: 'f5', key: 'field_5', label: '単価', extractName: '単価', column: 'E', enabled: true },
      { id: 'f6', key: 'field_6', label: '金額', extractName: '金額', column: 'F', enabled: true },
      { id: 'f7', key: 'field_7', label: '合計金額', extractName: '合計金額', column: 'G', enabled: true },
    ],
  },
]

// Excel列名を生成（A-Z, AA-AZ...）
const getColumnName = (index) => {
  let name = ''
  while (index >= 0) {
    name = String.fromCharCode(65 + (index % 26)) + name
    index = Math.floor(index / 26) - 1
  }
  return name
}

// 列名からインデックスを取得
const getColumnIndex = (name) => {
  let index = 0
  for (let i = 0; i < name.length; i++) {
    index = index * 26 + (name.charCodeAt(i) - 64)
  }
  return index - 1
}

function HomePage() {
  const [files, setFiles] = useState([]) // 複数ファイル対応
  const [results, setResults] = useState([]) // 複数結果
  const [loading, setLoading] = useState(false)
  const [processingIndex, setProcessingIndex] = useState(-1)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // ★ 帳票タイプ（請求書 or 納品書）
  const [documentType, setDocumentType] = useState('invoice')

  // フィールド設定
  const [fields, setFields] = useState([
    { id: 'f1', key: 'field_1', label: '会社名（請求元）', extractName: '会社名（請求元）', column: 'A', enabled: true },
    { id: 'f2', key: 'field_2', label: '発行日', extractName: '発行日', column: 'B', enabled: true },
    { id: 'f3', key: 'field_3', label: '合計金額', extractName: '合計金額', column: 'C', enabled: true },
  ])
  const [fieldCounter, setFieldCounter] = useState(4)

  // UI状態
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [showPresetSelector, setShowPresetSelector] = useState(false)
  const [companyRules, setCompanyRules] = useState('')
  const [activeTab, setActiveTab] = useState('settings') // 'settings', 'results', 'history'

  // テンプレート管理
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [defaultTemplateId, setDefaultTemplateId] = useState(null)

  // 処理履歴
  const [history, setHistory] = useState([])

  // 現在の帳票タイプに応じたプリセットを取得
  const currentPresetFields = documentType === 'invoice' ? PRESET_FIELDS_INVOICE : PRESET_FIELDS_DELIVERY
  const currentPresetTemplates = documentType === 'invoice' ? PRESET_TEMPLATES_INVOICE : PRESET_TEMPLATES_DELIVERY

  // 結果編集モード
  const [editingCell, setEditingCell] = useState(null)

  // ★ 範囲選択関連の状態
  const [selectedFileIndex, setSelectedFileIndex] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [selection, setSelection] = useState(null) // { startX, startY, endX, endY }
  const [isSelecting, setIsSelecting] = useState(false)
  const [fileSelections, setFileSelections] = useState({}) // ファイルごとの選択範囲を保存
  const canvasRef = useRef(null)
  const imageRef = useRef(null)

  // 初期化：テンプレートと履歴を読み込み
  useEffect(() => {
    const savedData = localStorage.getItem('invoice_app_data_v4')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setTemplates(parsed.templates || [])
        setFieldCounter(parsed.fieldCounter || 4)
        setDefaultTemplateId(parsed.defaultTemplateId || null)
        setHistory(parsed.history || [])
        // ★ 会社別ルールは統一管理：保存済みがあれば使用、なければデフォルト
        setCompanyRules(parsed.companyRules || DEFAULT_COMPANY_RULES)

        // デフォルトテンプレートがあれば適用（フィールドのみ）
        if (parsed.defaultTemplateId) {
          const defaultTemplate = parsed.templates?.find(t => t.id === parsed.defaultTemplateId)
          if (defaultTemplate) {
            setFields(defaultTemplate.fields)
            // ★ テンプレートからcompanyRulesを設定しない（統一管理のため）
          }
        }
      } catch (e) {
        console.error('Data load error:', e)
      }
    } else {
      // ★ 初回起動時はデフォルトの会社別ルールを設定
      setCompanyRules(DEFAULT_COMPANY_RULES)
    }
  }, [])

  // データ保存
  const saveData = (newTemplates = templates, newHistory = history, newDefaultId = defaultTemplateId, newCompanyRules = companyRules) => {
    localStorage.setItem('invoice_app_data_v4', JSON.stringify({
      templates: newTemplates,
      fieldCounter,
      defaultTemplateId: newDefaultId,
      history: newHistory.slice(0, 50),
      companyRules: newCompanyRules
    }))
  }

  // ファイル選択（複数対応）
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles])
      setError('')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles])
      setError('')
    }
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
    setResults(results.filter((_, i) => i !== index))
    // 選択範囲も削除
    const newSelections = { ...fileSelections }
    delete newSelections[index]
    setFileSelections(newSelections)
    if (selectedFileIndex === index) {
      setSelectedFileIndex(null)
      setImagePreview(null)
      setSelection(null)
    }
  }

  const clearAllFiles = () => {
    setFiles([])
    setResults([])
    setFileSelections({})
    setSelectedFileIndex(null)
    setImagePreview(null)
    setSelection(null)
  }

  // ★ 画像プレビューを表示
  const showImagePreview = async (fileIndex) => {
    const file = files[fileIndex]
    if (!file) return

    setSelectedFileIndex(fileIndex)

    // 既存の選択範囲があれば復元
    if (fileSelections[fileIndex]) {
      setSelection(fileSelections[fileIndex])
    } else {
      setSelection(null)
    }

    // 画像ファイルの場合は直接プレビュー
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'application/pdf') {
      // PDFの場合はプレビュー不可のメッセージ
      setImagePreview('PDF_PREVIEW_NOT_SUPPORTED')
    }
  }

  // ★ Canvasに画像を描画
  useEffect(() => {
    if (!imagePreview || imagePreview === 'PDF_PREVIEW_NOT_SUPPORTED' || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      imageRef.current = img

      // キャンバスサイズを画像に合わせる（最大幅800px）
      const maxWidth = 800
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      // 画像を描画
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // 既存の選択範囲があれば描画
      if (selection) {
        drawSelection(ctx, selection, canvas.width, canvas.height)
      }
    }
    img.src = imagePreview
  }, [imagePreview, selection])

  // ★ 選択範囲を描画
  const drawSelection = (ctx, sel, canvasWidth, canvasHeight) => {
    if (!sel || !imageRef.current) return

    const img = imageRef.current
    const scale = canvasWidth / img.width

    // 画像を再描画
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)

    // 選択範囲外を暗くする
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'

    const x1 = Math.min(sel.startX, sel.endX) * scale
    const y1 = Math.min(sel.startY, sel.endY) * scale
    const x2 = Math.max(sel.startX, sel.endX) * scale
    const y2 = Math.max(sel.startY, sel.endY) * scale
    const w = x2 - x1
    const h = y2 - y1

    // 上部
    ctx.fillRect(0, 0, canvasWidth, y1)
    // 下部
    ctx.fillRect(0, y2, canvasWidth, canvasHeight - y2)
    // 左部
    ctx.fillRect(0, y1, x1, h)
    // 右部
    ctx.fillRect(x2, y1, canvasWidth - x2, h)

    // 選択範囲の枠
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 3
    ctx.strokeRect(x1, y1, w, h)

    // コーナーハンドル
    ctx.fillStyle = '#2196f3'
    const handleSize = 8
    ctx.fillRect(x1 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize)
    ctx.fillRect(x2 - handleSize / 2, y1 - handleSize / 2, handleSize, handleSize)
    ctx.fillRect(x1 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize)
    ctx.fillRect(x2 - handleSize / 2, y2 - handleSize / 2, handleSize, handleSize)
  }

  // ★ マウスイベントハンドラ
  const handleMouseDown = (e) => {
    if (!canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = imageRef.current.width / canvas.width

    const x = (e.clientX - rect.left) * scale
    const y = (e.clientY - rect.top) * scale

    setIsSelecting(true)
    setSelection({ startX: x, startY: y, endX: x, endY: y })
  }

  const handleMouseMove = useCallback((e) => {
    if (!isSelecting || !canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = imageRef.current.width / canvas.width

    const x = Math.max(0, Math.min((e.clientX - rect.left) * scale, imageRef.current.width))
    const y = Math.max(0, Math.min((e.clientY - rect.top) * scale, imageRef.current.height))

    setSelection(prev => prev ? { ...prev, endX: x, endY: y } : null)
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return
    setIsSelecting(false)

    // 選択範囲が小さすぎる場合はクリア
    if (selection) {
      const width = Math.abs(selection.endX - selection.startX)
      const height = Math.abs(selection.endY - selection.startY)
      if (width < 10 || height < 10) {
        setSelection(null)
        return
      }

      // ファイルごとの選択範囲を保存
      if (selectedFileIndex !== null) {
        setFileSelections(prev => ({ ...prev, [selectedFileIndex]: selection }))
      }
    }
  }, [isSelecting, selection, selectedFileIndex])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ★ 選択範囲をリセット
  const resetSelection = () => {
    setSelection(null)
    if (selectedFileIndex !== null) {
      const newSelections = { ...fileSelections }
      delete newSelections[selectedFileIndex]
      setFileSelections(newSelections)
    }

    // Canvasを再描画
    if (canvasRef.current && imageRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      ctx.drawImage(imageRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  // ★ 画像をクロップ
  const cropImage = async (file, sel) => {
    if (!sel) return file // 選択範囲がなければ元ファイルを返す

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          const x1 = Math.min(sel.startX, sel.endX)
          const y1 = Math.min(sel.startY, sel.endY)
          const width = Math.abs(sel.endX - sel.startX)
          const height = Math.abs(sel.endY - sel.startY)

          canvas.width = width
          canvas.height = height

          ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height)

          canvas.toBlob((blob) => {
            const croppedFile = new File([blob], file.name, { type: 'image/png' })
            resolve(croppedFile)
          }, 'image/png')
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  // フィールド操作
  const addField = (preset = null) => {
    const newKey = `field_${fieldCounter}`
    const newId = `f${fieldCounter}`
    const label = preset ? preset.label : newFieldLabel.trim()
    if (!label) return

    const newField = {
      id: newId,
      key: newKey,
      label: label,
      extractName: label,
      column: getNextAvailableColumn(),
      enabled: true
    }

    setFields([...fields, newField])
    setFieldCounter(fieldCounter + 1)
    setNewFieldLabel('')
    setShowPresetSelector(false)
  }

  const getNextAvailableColumn = () => {
    const usedColumns = fields.filter(f => f.enabled).map(f => f.column)
    for (let i = 0; i < 26; i++) {
      const col = getColumnName(i)
      if (!usedColumns.includes(col)) return col
    }
    return 'A'
  }

  const removeField = (fieldId) => setFields(fields.filter(f => f.id !== fieldId))

  const updateFieldColumn = (fieldId, newColumn) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, column: newColumn.toUpperCase() } : f))
  }

  const toggleField = (fieldId) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, enabled: !f.enabled } : f))
  }

  const updateFieldLabel = (fieldId, newLabel) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, label: newLabel, extractName: newLabel } : f))
  }

  // テンプレート管理
  const saveTemplate = () => {
    if (!templateName.trim()) return

    // ★ 会社別ルールはテンプレートに含めない（統一管理のため）
    const newTemplate = {
      id: Date.now(),
      name: templateName,
      documentType: documentType,
      fields: fields,
      createdAt: new Date().toISOString()
    }

    const updated = [...templates, newTemplate]
    setTemplates(updated)
    saveData(updated, history, defaultTemplateId, companyRules)
    setTemplateName('')
  }

  const loadTemplate = (template) => {
    setFields(template.fields)
    // ★ 会社別ルールはテンプレートから設定しない（統一管理のため）
    // テンプレートの帳票タイプがあれば切り替え
    if (template.documentType) {
      setDocumentType(template.documentType)
    }
  }

  const deleteTemplate = (templateId) => {
    const updated = templates.filter(t => t.id !== templateId)
    const newDefaultId = defaultTemplateId === templateId ? null : defaultTemplateId
    setTemplates(updated)
    setDefaultTemplateId(newDefaultId)
    saveData(updated, history, newDefaultId, companyRules)
  }

  const importTemplate = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        if (imported.fields && Array.isArray(imported.fields)) {
          const newTemplate = {
            ...imported,
            id: Date.now(),
            name: imported.name + ' (インポート)',
            createdAt: new Date().toISOString()
          }
          const updated = [...templates, newTemplate]
          setTemplates(updated)
          saveData(updated, history, defaultTemplateId, companyRules)
        }
      } catch (err) {
        setError('テンプレートの読み込みに失敗しました')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ★ プロンプト生成（会社別ルール強化 - 自動判定対応）
  const generatePrompt = () => {
    const enabledFields = fields.filter(f => f.enabled)
    if (enabledFields.length === 0) return null

    // フィールド名とキーの対応表
    const fieldMapping = enabledFields.map(f => `${f.key} = "${f.extractName}"`).join('\n')

    // サンプル出力を生成
    const sampleOutput = {}
    enabledFields.forEach(f => {
      sampleOutput[f.key] = `(値)`
    })

    // 会社別ルールがある場合、最優先で記載（AIが自動判定）
    let prompt = ''

    if (companyRules.trim()) {
      // 「今回御請求額」のfield keyを特定
      const targetField = enabledFields.find(f =>
        f.extractName.includes('今回御請求') ||
        f.extractName.includes('今回請求') ||
        f.extractName.includes('御請求額')
      )
      const targetFieldKey = targetField ? targetField.key : 'field_X'

      prompt = `【最重要：会社別の計算ルール - AIが自動判定して適用】
※このルールは絶対に守ること。帳票を見て会社名を特定し、該当するルールを適用すること。

【ステップ1】まず帳票から「請求元」または「発行元」の会社名を読み取る

【ステップ2】以下のルール一覧から該当する会社を探し、ルールを適用する

${companyRules}

【ステップ3】該当する会社が見つかった場合
- その会社のルールに従って値を計算・抽出する
- 単純に帳票の数値をコピーするのではなく、ルールに基づいた計算を行う
- 例：「税抜御買上額」+「消費税額等」の計算結果を${targetFieldKey}に出力

【ステップ4】該当する会社が見つからない場合
- 「その他の会社（デフォルト）」のルールを適用する
- デフォルトルールもない場合は、帳票の値をそのまま抽出する

【項目とキーの対応】
${fieldMapping}

【抽出ルール】
- 金額は数値のみ（カンマ・円記号除去）
- 日付は "YYYY/MM/DD" 形式
- 該当なしは null

【出力形式】JSONのみ出力。マークダウン禁止。
{
  "items": [
    ${JSON.stringify(sampleOutput, null, 4).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n')}
  ]
}`
    } else {
      prompt = `【タスク】帳票画像から以下の項目を抽出してJSON出力

【項目とキーの対応】
${fieldMapping}

【抽出ルール】
- 金額は数値のみ（カンマ・円記号除去）
- 日付は "YYYY/MM/DD" 形式
- 該当なしは null
- 明細行ではなくサマリー行の値を優先

【出力形式】JSONのみ。マークダウン禁止。
{
  "items": [
    ${JSON.stringify(sampleOutput, null, 4).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n')}
  ]
}`
    }

    return prompt
  }

  // ★ 一括処理（範囲選択対応）
  const handleProcessAll = async () => {
    if (files.length === 0) {
      setError('ファイルを選択してください')
      return
    }

    const enabledFields = fields.filter(f => f.enabled)
    if (enabledFields.length === 0) {
      setError('抽出項目を1つ以上設定してください')
      return
    }

    setLoading(true)
    setError('')
    setResults([])
    setActiveTab('results')

    const prompt = generatePrompt()
    const newResults = []

    for (let i = 0; i < files.length; i++) {
      setProcessingIndex(i)
      try {
        // 選択範囲がある場合はクロップ
        let fileToProcess = files[i]
        const sel = fileSelections[i]

        if (sel && files[i].type.startsWith('image/')) {
          fileToProcess = await cropImage(files[i], sel)
        }

        const response = await testPrompt(fileToProcess, 'custom', prompt)

        if (response.result) {
          let jsonStr = response.result.trim()
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0].trim()
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0].trim()
          }
          jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '')

          try {
            const parsedData = JSON.parse(jsonStr)
            newResults.push({
              success: true,
              fileName: files[i].name,
              data: parsedData,
              rawResponse: response.result,
              extractedValues: extractValues(parsedData, enabledFields),
              hadSelection: !!sel
            })
          } catch {
            newResults.push({
              success: false,
              fileName: files[i].name,
              error: 'JSON解析エラー',
              rawResponse: response.result
            })
          }
        }
      } catch (err) {
        newResults.push({
          success: false,
          fileName: files[i].name,
          error: err.message || '処理エラー'
        })
      }

      setResults([...newResults])
    }

    // 履歴に保存
    const historyEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      fileCount: files.length,
      successCount: newResults.filter(r => r.success).length,
      fields: enabledFields.map(f => f.label),
      results: newResults
    }
    const newHistory = [historyEntry, ...history]
    setHistory(newHistory)
    saveData(templates, newHistory, defaultTemplateId, companyRules)

    setProcessingIndex(-1)
    setLoading(false)
  }

  // データ抽出
  const extractValues = (data, enabledFields) => {
    const items = data.items || (Array.isArray(data) ? data : [data])
    return items.map(item => {
      const row = {}
      enabledFields.forEach(f => {
        row[f.id] = getFieldValue(item, f)
      })
      return row
    })
  }

  // 結果からフィールドの値を取得（超柔軟マッチング）
  const getFieldValue = (item, field) => {
    if (!item || typeof item !== 'object') return null

    const label = field.label
    const labelLower = label.toLowerCase()

    // 1. 直接キーで取得（最優先）
    if (item[field.key] !== undefined) return item[field.key]
    if (item[field.label] !== undefined) return item[field.label]
    if (item[field.extractName] !== undefined) return item[field.extractName]

    // 2. 全フラットキーを取得
    const allKeys = getAllKeys(item)

    // 3. 日本語ラベル→英語キーのマッピング（より包括的）
    const keywordMappings = [
      // 前回系
      { keywords: ['前回御請求', '前回請求', '前回', '前月請求', 'previous'], paths: ['previous_balance', 'previous_amount', 'last_balance', 'previous', 'prev_balance'] },
      // 入金系
      { keywords: ['御入金', '入金額', '入金', 'ご入金', 'payment', 'paid'], paths: ['payment_received', 'payment_amount', 'paid_amount', 'payment', 'deposit'] },
      // 調整系
      { keywords: ['調整額', '調整', 'adjustment'], paths: ['adjustment', 'adjustment_amount', 'adjust'] },
      // 繰越系
      { keywords: ['差引繰越', '繰越額', '繰越', '差引', 'carried', 'balance'], paths: ['carried_over', 'carry_over', 'balance_forward', 'carried_forward', 'balance'] },
      // 税抜買上系
      { keywords: ['税抜御買上', '税抜買上', '税抜', '買上', 'subtotal', 'tax_excluded'], paths: ['subtotal', 'sub_total', 'tax_excluded', 'tax_excluded_amount', 'net_amount'] },
      // 消費税系
      { keywords: ['消費税額等', '消費税額', '消費税', '税額', 'tax', 'vat'], paths: ['tax', 'tax_amount', 'consumption_tax', 'vat', 'sales_tax'] },
      // 今回請求系
      { keywords: ['今回御請求', '今回請求', '御請求額', '請求額', 'total', 'invoice'], paths: ['total', 'total_amount', 'grand_total', 'invoice_total', 'current_invoice', 'amount'] },
      // 今回発生系
      { keywords: ['今回発生', '今回売上', '発生額', 'current', 'sales'], paths: ['current_amount', 'current_charge', 'new_charges', 'sales', 'current_sales'] },
      // 会社系
      { keywords: ['会社', '請求元', '発行元', 'vendor', 'supplier', 'company'], paths: ['vendor.name', 'supplier', 'company_name', 'company', 'vendor_name', 'name'] },
      // 日付系
      { keywords: ['発行日', '請求日', 'issue', 'date', '日付'], paths: ['issue_date', 'date', 'invoice_date', 'issued_date', 'due_date'] },
      // 値引系
      { keywords: ['値引', '割引', 'discount'], paths: ['discount', 'discount_amount'] },
    ]

    // 4. キーワードマッチング（部分一致をより厳密に）
    for (const mapping of keywordMappings) {
      const matches = mapping.keywords.some(kw => {
        const kwLower = kw.toLowerCase()
        return labelLower.includes(kwLower) || kwLower.includes(labelLower) ||
               label.includes(kw) || kw.includes(label)
      })
      if (matches) {
        for (const path of mapping.paths) {
          const value = getNestedValue(item, path)
          if (value !== undefined && value !== null) return value
        }
        // allKeysからも検索
        for (const { path, value } of allKeys) {
          for (const pathCandidate of mapping.paths) {
            if (path.toLowerCase().includes(pathCandidate.toLowerCase())) {
              return value
            }
          }
        }
      }
    }

    // 5. ラベルの各文字で部分一致検索（日本語対応）
    const labelChars = label.replace(/[（）()・\s御]/g, '') // 「御」も除去
    for (const { path, value } of allKeys) {
      const pathLower = path.toLowerCase()
      if (pathLower.includes(labelLower) || labelLower.includes(pathLower)) {
        return value
      }
      // 3文字以上の連続マッチ
      for (let i = 0; i < labelChars.length - 2; i++) {
        const substr = labelChars.substring(i, i + 3)
        if (pathLower.includes(substr.toLowerCase())) {
          return value
        }
      }
    }

    // 6. 英語キーワードの類似マッチ
    const englishKeywords = {
      '金額': ['amount', 'total', 'sum', 'price'],
      '日': ['date', 'day'],
      '番号': ['number', 'no', 'id'],
      '名': ['name'],
      '額': ['amount', 'sum', 'total'],
      '税': ['tax'],
    }

    for (const [jpKey, enKeys] of Object.entries(englishKeywords)) {
      if (label.includes(jpKey)) {
        for (const enKey of enKeys) {
          for (const { path, value } of allKeys) {
            if (path.toLowerCase().includes(enKey)) {
              return value
            }
          }
        }
      }
    }

    return null
  }

  const getNestedValue = (obj, path) => {
    const parts = path.split('.')
    let current = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      current = current[part]
    }
    return current
  }

  const getAllKeys = (obj, prefix = '', results = []) => {
    if (!obj || typeof obj !== 'object') return results
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (Array.isArray(value)) continue
      else if (typeof value === 'object' && value !== null) getAllKeys(value, path, results)
      else results.push({ path, value })
    }
    return results
  }

  // 結果の値を編集
  const updateResultValue = (resultIndex, rowIndex, fieldId, newValue) => {
    setResults(results.map((result, ri) => {
      if (ri !== resultIndex) return result
      const newExtractedValues = result.extractedValues.map((row, rowi) => {
        if (rowi !== rowIndex) return row
        return { ...row, [fieldId]: newValue }
      })
      return { ...result, extractedValues: newExtractedValues }
    }))
    setEditingCell(null)
  }

  // Excel出力
  const downloadExcel = () => {
    if (results.length === 0 || results.every(r => !r.success)) return

    const wb = XLSX.utils.book_new()
    const enabledFields = fields.filter(f => f.enabled)
    const maxColIndex = Math.max(...enabledFields.map(f => getColumnIndex(f.column)))

    const headerRow = new Array(maxColIndex + 2).fill('')
    headerRow[0] = 'ファイル名'
    enabledFields.forEach(f => {
      headerRow[getColumnIndex(f.column) + 1] = f.label
    })

    const rows = [headerRow]

    results.forEach(result => {
      if (!result.success || !result.extractedValues) return
      result.extractedValues.forEach(item => {
        const dataRow = new Array(maxColIndex + 2).fill('')
        dataRow[0] = result.fileName
        enabledFields.forEach(f => {
          dataRow[getColumnIndex(f.column) + 1] = item[f.id] ?? ''
        })
        rows.push(dataRow)
      })
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = headerRow.map((_, i) => ({ wch: i === 0 ? 30 : 15 }))

    XLSX.utils.book_append_sheet(wb, ws, '抽出データ')
    XLSX.writeFile(wb, `抽出データ_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // CSV出力
  const downloadCSV = () => {
    if (results.length === 0 || results.every(r => !r.success)) return

    const enabledFields = fields.filter(f => f.enabled)
    const maxColIndex = Math.max(...enabledFields.map(f => getColumnIndex(f.column)))

    const headerRow = new Array(maxColIndex + 2).fill('')
    headerRow[0] = 'ファイル名'
    enabledFields.forEach(f => {
      headerRow[getColumnIndex(f.column) + 1] = f.label
    })

    const rows = [headerRow]

    results.forEach(result => {
      if (!result.success || !result.extractedValues) return
      result.extractedValues.forEach(item => {
        const dataRow = new Array(maxColIndex + 2).fill('')
        dataRow[0] = result.fileName
        enabledFields.forEach(f => {
          dataRow[getColumnIndex(f.column) + 1] = item[f.id] ?? ''
        })
        rows.push(dataRow)
      })
    })

    const csvContent = rows.map(row => row.map(cell => {
      const str = String(cell)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `抽出データ_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const successCount = results.filter(r => r.success).length

  return (
    <div style={{ marginTop: '20px' }}>
      {/* ★ 帳票タイプ切り替え */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '20px',
        padding: '15px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px'
      }}>
        {Object.values(DOCUMENT_TYPES).map(type => (
          <button
            key={type.id}
            onClick={() => setDocumentType(type.id)}
            style={{
              padding: '15px 40px',
              border: 'none',
              background: documentType === type.id ? '#fff' : 'rgba(255,255,255,0.2)',
              color: documentType === type.id ? '#667eea' : '#fff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              transition: 'all 0.2s',
              boxShadow: documentType === type.id ? '0 4px 15px rgba(0,0,0,0.2)' : 'none'
            }}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      {/* タブナビゲーション */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', paddingBottom: '10px' }}>
        {[
          { id: 'settings', label: '設定', icon: '⚙️' },
          { id: 'results', label: `結果 ${results.length > 0 ? `(${successCount}/${results.length})` : ''}`, icon: '📊' },
          { id: 'history', label: `履歴 (${history.length})`, icon: '📜' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === tab.id ? '#2196f3' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#666',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: '1rem'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* 設定タブ */}
      {activeTab === 'settings' && (
        <>
          {/* ★ テンプレート選択（常に表示） */}
          <div className="card" style={{ marginBottom: '20px', background: '#e8f5e9', border: '2px solid #4caf50' }}>
            <h2 className="card-title" style={{ margin: '0 0 15px 0', color: '#2e7d32' }}>
              📋 テンプレートを選択（ワンクリックで設定を適用）
            </h2>

            {/* プリセットテンプレート */}
            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#555' }}>
                {documentType === 'invoice' ? '請求書用プリセット' : '納品書用プリセット'}
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {currentPresetTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(t)}
                    style={{
                      padding: '12px 20px',
                      background: '#fff',
                      border: '2px solid #4caf50',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      color: '#2e7d32',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => { e.target.style.background = '#4caf50'; e.target.style.color = '#fff' }}
                    onMouseOut={(e) => { e.target.style.background = '#fff'; e.target.style.color = '#2e7d32' }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存済みテンプレート */}
            {templates.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#555' }}>保存済みテンプレート</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        onClick={() => loadTemplate(t)}
                        style={{
                          padding: '10px 16px',
                          background: defaultTemplateId === t.id ? '#2196f3' : '#fff',
                          border: defaultTemplateId === t.id ? '2px solid #2196f3' : '1px solid #ddd',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          color: defaultTemplateId === t.id ? '#fff' : '#333'
                        }}
                      >
                        {t.documentType === 'delivery' ? '📦' : '📄'} {t.name} {defaultTemplateId === t.id && '★'}
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1rem' }}
                        title="削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 現在の設定を保存 */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #c8e6c9' }}>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="テンプレート名を入力して保存"
                style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ddd', maxWidth: '300px' }}
              />
              <button className="btn btn-primary" onClick={saveTemplate} disabled={!templateName.trim()} style={{ padding: '10px 20px' }}>
                現在の設定を保存
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '10px 16px' }}>
                JSONインポート
                <input type="file" accept=".json" onChange={importTemplate} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* 抽出項目設定 */}
          <div className="card">
            <h2 className="card-title" style={{ margin: '0 0 15px 0' }}>1. 抽出項目と出力列を設定</h2>

            {/* Excel出力プレビュー */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: '#333' }}>出力プレビュー（Excel列の配置）</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' }}>
                <div style={{ display: 'flex', minWidth: 'max-content', borderBottom: '2px solid #5b9bd5' }}>
                  {Array.from({ length: 15 }, (_, i) => {
                    const colName = getColumnName(i)
                    const field = fields.find(f => f.enabled && f.column === colName)
                    return (
                      <div key={colName} style={{
                        minWidth: '100px', padding: '10px 8px', textAlign: 'center', borderRight: '1px solid #ddd',
                        background: field ? '#e3f2fd' : '#f5f5f5', fontWeight: 'bold', fontSize: '0.85rem'
                      }}>
                        <div style={{ color: '#666', fontSize: '0.75rem' }}>{colName}列</div>
                        <div style={{ marginTop: '5px', color: field ? '#1976d2' : '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                          {field ? field.label : '---'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 設定済みフィールド一覧 */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ marginBottom: '10px', color: '#333' }}>
                設定済み項目 <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#666' }}>（有効: {fields.filter(f => f.enabled).length}件）</span>
              </h4>
              {fields.length === 0 ? (
                <p style={{ color: '#888' }}>項目を追加してください</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {fields.map((field) => (
                    <div key={field.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px',
                      background: field.enabled ? '#fff' : '#f5f5f5',
                      border: field.enabled ? '2px solid #2196f3' : '1px solid #ddd',
                      borderRadius: '8px', opacity: field.enabled ? 1 : 0.6
                    }}>
                      <input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.id)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                      <input type="text" value={field.label} onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                        style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '0.95rem' }} placeholder="抽出項目名" />
                      <span style={{ color: '#666' }}>→</span>
                      <select value={field.column} onChange={(e) => updateFieldColumn(field.id, e.target.value)}
                        style={{ padding: '8px 12px', border: '2px solid #2196f3', borderRadius: '5px', background: '#e3f2fd', fontWeight: 'bold', cursor: 'pointer' }}>
                        {Array.from({ length: 26 }, (_, i) => (
                          <option key={i} value={getColumnName(i)}>{getColumnName(i)}列</option>
                        ))}
                      </select>
                      <button onClick={() => removeField(field.id)} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #dc3545', borderRadius: '5px', color: '#dc3545', cursor: 'pointer' }}>
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 項目追加 */}
            <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '8px', border: '2px dashed #2196f3' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>+ 項目を追加</h4>
              <div style={{ marginBottom: '15px' }}>
                <button className="btn btn-secondary" onClick={() => setShowPresetSelector(!showPresetSelector)}>
                  {showPresetSelector ? 'プリセットを閉じる ▲' : 'プリセットから選択 ▼'}
                </button>
                {showPresetSelector && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', padding: '15px', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                    {currentPresetFields.map(preset => {
                      const isAdded = fields.some(f => f.label === preset.label)
                      return (
                        <button key={preset.id} onClick={() => !isAdded && addField(preset)} disabled={isAdded}
                          style={{ padding: '8px 14px', background: isAdded ? '#e0e0e0' : '#e3f2fd', border: isAdded ? '1px solid #ccc' : '1px solid #2196f3',
                            borderRadius: '20px', cursor: isAdded ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: isAdded ? '#999' : '#1976d2' }}
                          title={preset.description}>
                          {preset.label} {isAdded && '✓'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="カスタム項目名を入力（例: 担当者名、部門コード）"
                  style={{ flex: 1, padding: '12px', border: '1px solid #ddd', borderRadius: '5px' }}
                  onKeyDown={(e) => {
                    // IME入力中（日本語変換中）はEnterで確定のみ、追加しない
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      addField()
                    }
                  }} />
                <button className="btn btn-primary" onClick={() => addField()} disabled={!newFieldLabel.trim()} style={{ padding: '12px 24px' }}>
                  追加
                </button>
              </div>
            </div>

            {/* ★ 会社別ルール（統一管理 - 自動判定対応） */}
            <div style={{ marginTop: '20px', background: '#fff3cd', padding: '20px', borderRadius: '8px', border: '2px solid #ffc107' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#856404', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🏢</span>
                会社別の特殊ルール（統一管理・AI自動判定）
              </h4>
              <div style={{
                background: '#fff8e1',
                padding: '10px 15px',
                borderRadius: '6px',
                marginBottom: '15px',
                fontSize: '0.9rem',
                color: '#6d4c00'
              }}>
                <strong>このルールは全テンプレート共通です。</strong><br />
                AIが帳票から会社名を自動的に読み取り、該当するルールを適用します。<br />
                テンプレートごとに設定する必要はありません。
              </div>
              <textarea
                value={companyRules}
                onChange={(e) => {
                  setCompanyRules(e.target.value)
                  saveData(templates, history, defaultTemplateId, e.target.value)
                }}
                placeholder={`会社名ごとに抽出ルールを指定できます。AIが帳票から会社名を読み取り、該当するルールを自動適用します。

【書き方の例】

■「株式会社グラフィッククリエーション」の場合：
「今回御請求額」には、帳票の「税抜御買上額」と「消費税額等」を足した合計値を入れる。
（右端の「今回御請求額」欄の値ではない）

■「戸田工業株式会社」の場合：
「今回御請求額」には、「今回お買上高」セクション内の「合計金額」を入れる。
（「今回ご請求高」欄の値ではない）

■その他の会社（デフォルト）：
「前回請求額」-「入金額」=「繰越額」の関係を確認し、
今回新規発生分の合計を「今回御請求額」に入れる。`}
                style={{
                  width: '100%',
                  minHeight: '180px',
                  padding: '12px',
                  border: '1px solid #ffc107',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  background: '#fffef5'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: '#856404', marginTop: '10px', marginBottom: 0 }}>
                ヒント: 「■「会社名」の場合：」の形式で記述すると、AIが会社名をマッチングしやすくなります。
              </p>
            </div>
          </div>

          {/* ★ ファイルアップロード & 範囲選択 */}
          <div className="card">
            <h2 className="card-title">2. ファイルをアップロード & 抽出範囲を選択</h2>

            <div className={`upload-area ${dragOver ? 'dragover' : ''}`}
              onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">{files.length > 0 ? '📄' : '📁'}</div>
              {files.length > 0 ? (
                <p><strong>{files.length}件</strong>のファイルが選択されています</p>
              ) : (
                <>
                  <p>ここにファイルをドラッグ&ドロップ（複数可）</p>
                  <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>対応形式: PDF, PNG, JPG</p>
                </>
              )}
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg" multiple onChange={handleFileSelect} />

            {/* ★ ファイル一覧（範囲選択ボタン付き） */}
            {files.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold' }}>選択ファイル ({files.length}件)</span>
                  <button className="btn btn-outline" onClick={clearAllFiles} style={{ fontSize: '0.85rem', color: '#dc3545' }}>
                    すべて削除
                  </button>
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                  {files.map((file, index) => (
                    <div key={index} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px',
                      borderBottom: index < files.length - 1 ? '1px solid #e0e0e0' : 'none',
                      background: selectedFileIndex === index ? '#e3f2fd' : processingIndex === index ? '#fff3e0' : 'white'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {processingIndex === index && <span>🔄</span>}
                        <span style={{ fontSize: '0.9rem' }}>{file.name}</span>
                        {fileSelections[index] && (
                          <span style={{
                            fontSize: '0.75rem',
                            background: '#4caf50',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '10px'
                          }}>
                            範囲指定済
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {file.type.startsWith('image/') && (
                          <button
                            onClick={() => showImagePreview(index)}
                            style={{
                              background: selectedFileIndex === index ? '#2196f3' : '#e3f2fd',
                              color: selectedFileIndex === index ? '#fff' : '#1976d2',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: '5px',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            {selectedFileIndex === index ? '選択中' : '範囲選択'}
                          </button>
                        )}
                        <button onClick={() => removeFile(index)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '1.2rem' }}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ★ 画像プレビュー & 範囲選択UI */}
            {imagePreview && selectedFileIndex !== null && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '2px solid #2196f3'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0, color: '#1976d2' }}>
                    📌 抽出範囲を選択: {files[selectedFileIndex]?.name}
                  </h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {selection && (
                      <button
                        className="btn btn-outline"
                        onClick={resetSelection}
                        style={{ color: '#dc3545', borderColor: '#dc3545' }}
                      >
                        選択をリセット
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedFileIndex(null)
                        setImagePreview(null)
                      }}
                    >
                      閉じる
                    </button>
                  </div>
                </div>

                {imagePreview === 'PDF_PREVIEW_NOT_SUPPORTED' ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p style={{ fontSize: '1.2rem' }}>📄 PDFファイルのプレビューは現在対応していません</p>
                    <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>PDFファイルは全体が処理されます。</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
                      ドラッグして抽出したい範囲を囲んでください。選択範囲外のデータは無視されます。
                    </p>
                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'auto', maxHeight: '600px', background: '#fff' }}>
                      <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        style={{ cursor: 'crosshair', display: 'block' }}
                      />
                    </div>
                    {selection && (
                      <div style={{ marginTop: '10px', padding: '10px', background: '#e8f5e9', borderRadius: '4px' }}>
                        <span style={{ color: '#2e7d32' }}>
                          ✓ 範囲が選択されました。この範囲のみ抽出されます。
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {error && <div className="alert alert-error" style={{ marginTop: '15px' }}>{error}</div>}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button className="btn btn-primary" onClick={handleProcessAll}
                disabled={loading || files.length === 0 || fields.filter(f => f.enabled).length === 0}
                style={{ padding: '15px 50px', fontSize: '1.1rem' }}>
                {loading ? `🔄 処理中... (${processingIndex + 1}/${files.length})` : `🚀 ${files.length}件を一括処理`}
              </button>
              <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '10px' }}>
                {fields.filter(f => f.enabled).length}個の項目を抽出します
                {Object.keys(fileSelections).length > 0 && (
                  <span style={{ color: '#4caf50' }}> | {Object.keys(fileSelections).length}件に範囲指定あり</span>
                )}
              </p>
            </div>
          </div>
        </>
      )}

      {/* 結果タブ */}
      {activeTab === 'results' && (
        <div className="card">
          <h2 className="card-title">解析結果</h2>

          {results.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
              まだ結果がありません。設定タブでファイルを処理してください。
            </p>
          ) : (
            <>
              <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                ✅ {successCount}/{results.length}件の処理が完了しました
                {successCount < results.length && <span style={{ color: '#dc3545' }}> ({results.length - successCount}件失敗)</span>}
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                <button className="btn btn-primary" onClick={downloadExcel} disabled={successCount === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px' }}>
                  📊 Excelダウンロード（統合）
                </button>
                <button className="btn btn-secondary" onClick={downloadCSV} disabled={successCount === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px' }}>
                  📋 CSVダウンロード（統合）
                </button>
              </div>

              {results.map((result, resultIndex) => (
                <div key={resultIndex} style={{
                  marginBottom: '20px', padding: '15px', border: result.success ? '1px solid #4caf50' : '1px solid #dc3545',
                  borderRadius: '8px', background: result.success ? '#f1f8e9' : '#ffebee'
                }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>
                    {result.success ? '✅' : '❌'} {result.fileName}
                    {result.hadSelection && (
                      <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#666' }}>
                        (範囲指定あり)
                      </span>
                    )}
                  </h4>

                  {result.success && result.extractedValues ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="excel-table" style={{ minWidth: '100%' }}>
                        <thead>
                          <tr>
                            {fields.filter(f => f.enabled).map(f => (
                              <th key={f.id} style={{ background: '#5b9bd5', color: '#fff', padding: '10px', minWidth: '120px' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{f.column}列</div>
                                <div>{f.label}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.extractedValues.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {fields.filter(f => f.enabled).map(f => {
                                const cellKey = `${resultIndex}-${rowIndex}-${f.id}`
                                const isEditing = editingCell === cellKey
                                const value = row[f.id]

                                return (
                                  <td key={f.id} style={{ padding: '8px', cursor: 'pointer' }}
                                    onClick={() => !isEditing && setEditingCell(cellKey)}>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        defaultValue={value ?? ''}
                                        autoFocus
                                        onBlur={(e) => updateResultValue(resultIndex, rowIndex, f.id, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') updateResultValue(resultIndex, rowIndex, f.id, e.target.value)
                                          if (e.key === 'Escape') setEditingCell(null)
                                        }}
                                        style={{ width: '100%', padding: '5px', border: '2px solid #2196f3', borderRadius: '4px' }}
                                      />
                                    ) : (
                                      <span style={{ color: value === null || value === undefined || value === '' ? '#ccc' : 'inherit' }}>
                                        {value !== null && value !== undefined && value !== '' ? String(value) : '(クリックで編集)'}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: '#dc3545' }}>{result.error}</p>
                  )}

                  {result.rawResponse && (
                    <details style={{ marginTop: '10px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>AIレスポンスを表示</summary>
                      <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', overflow: 'auto', maxHeight: '200px', marginTop: '5px' }}>
                        {result.rawResponse}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 履歴タブ */}
      {activeTab === 'history' && (
        <div className="card">
          <h2 className="card-title">処理履歴</h2>

          {history.length === 0 ? (
            <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
              処理履歴はありません。
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map((entry) => (
                <div key={entry.id} style={{
                  padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>
                        {new Date(entry.date).toLocaleString('ja-JP')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                        {entry.successCount}/{entry.fileCount}件成功 | 抽出項目: {entry.fields.join(', ')}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setResults(entry.results)
                        setActiveTab('results')
                      }}
                      style={{ padding: '8px 16px' }}
                    >
                      結果を表示
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ローディングオーバーレイ */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
            <p style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>処理中...</p>
            <p style={{ color: '#666' }}>{processingIndex + 1} / {files.length} ファイル</p>
            <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>
              {files[processingIndex]?.name}
            </p>
            {fileSelections[processingIndex] && (
              <p style={{ fontSize: '0.85rem', color: '#4caf50', marginTop: '5px' }}>
                📌 選択範囲のみ処理中
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default HomePage
