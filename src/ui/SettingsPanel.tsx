import { useState, useRef, useEffect } from 'react'
import {
  loadSettings,
  updateSettings,
  type PetSettings,
} from '../utils/storage'
import { setAutoStart } from '../utils/autostart'
import { AVAILABLE_MODELS } from '../ai'
import type { ChatEngine } from '../ai'
import {
  audioManager,
  getAllSkins,
  unregisterCustomSkin,
  parseSkinPack,
  skinPackToCustomSkin,
  serializeSkinPack,
  downloadSkinPack,
} from '../pet'
import type { CustomSkin, RegisteredSkin } from '../pet'
import { deleteCustomSkin, loadCustomSkins, saveCustomSkins } from '../utils/customSkins'
import { registerCustomSkin } from '../pet/skinRegistry'
import { SkinEditor } from './SkinEditor'
import './SettingsPanel.css'

interface SettingsPanelProps {
  chatEngine: ChatEngine
  onClose: () => void
  onSettingsChange?: (settings: PetSettings) => void
}

export function SettingsPanel({ chatEngine, onClose, onSettingsChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<PetSettings>(loadSettings)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [skinList, setSkinList] = useState<RegisteredSkin[]>(getAllSkins)
  const [editorState, setEditorState] = useState<
    { mode: 'create' } | { mode: 'edit'; skin: CustomSkin } | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleChange = (patch: Partial<PetSettings>) => {
    const updated = updateSettings(patch)
    setSettings(updated)

    // 同步到 ChatEngine
    if (patch.apiKey !== undefined || patch.baseUrl !== undefined || patch.model !== undefined) {
      chatEngine.updateConfig({
        ...(patch.apiKey !== undefined && { apiKey: patch.apiKey }),
        ...(patch.baseUrl !== undefined && { baseUrl: patch.baseUrl }),
        ...(patch.model !== undefined && { model: patch.model }),
      })
    }

    onSettingsChange?.(updated)
  }

  /** 刷新皮肤列表（注册中心 + localStorage 同步） */
  const refreshSkinList = () => setSkinList(getAllSkins())

  /** 删除自定义皮肤 */
  const handleDeleteSkin = (skin: RegisteredSkin) => {
    if (skin.isBuiltIn) return
    if (!confirm(`确定删除皮肤「${skin.name}」？`)) return
    deleteCustomSkin(skin.id)
    unregisterCustomSkin(skin.id)
    // 若删除的是当前皮肤，回退到默认
    if (settings.skin === skin.id) {
      handleChange({ skin: 'lumie' })
    }
    refreshSkinList()
  }

  /** 导入皮肤包 */
  const handleImportSkin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 清空，允许重复导入同一文件
    if (!file) return
    try {
      const text = await file.text()
      const pack = parseSkinPack(text)
      const skin = skinPackToCustomSkin(pack)
      addCustomSkinImport(skin)
      refreshSkinList()
      alert(`已导入皮肤「${skin.name}」`)
    } catch (err) {
      alert('导入失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  /** 编辑器保存后回调 */
  const handleSkinSaved = (skin: CustomSkin) => {
    refreshSkinList()
    // 提示是否立即应用
    if (confirm(`皮肤「${skin.name}」已保存，是否立即应用？`)) {
      handleChange({ skin: skin.id })
    }
  }

  /** 把导入的皮肤写入 localStorage + 注册中心 */
  const addCustomSkinImport = (skin: CustomSkin) => {
    const list = loadCustomSkins()
    list.push(skin)
    saveCustomSkins(list)
    registerCustomSkin(skin)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const reply = await chatEngine.chat('你好，这是一条连接测试消息')
      setTestResult(reply && !reply.includes('🥺') ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTesting(false)
    setTimeout(() => setTestResult(null), 5000)
  }

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel settings-panel" ref={panelRef}>
        <div className="tool-panel-header">
          <span className="tool-panel-title">⚙️ 设置</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="tool-panel-body settings-body">
          {/* ---- 皮肤 ---- */}
          <div className="settings-section">
            <div className="settings-section-title">🎨 皮肤</div>
            <div className="skin-grid">
              {skinList.map((skin) => (
                <div
                  key={skin.id}
                  className={`skin-card ${settings.skin === skin.id ? 'active' : ''}`}
                  onClick={() => handleChange({ skin: skin.id })}
                  title={skin.description}
                >
                  <span className="skin-icon">{skin.icon}</span>
                  <span className="skin-name">{skin.name}</span>
                  {!skin.isBuiltIn && (
                    <span className="skin-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="skin-card-action"
                        title="编辑"
                        onClick={() => setEditorState({ mode: 'edit', skin })}
                      >
                        ✏️
                      </button>
                      <button
                        className="skin-card-action"
                        title="导出"
                        onClick={() => {
                          const json = serializeSkinPack({
                            name: skin.name,
                            icon: skin.icon,
                            description: skin.description,
                            theme: skin.theme,
                          })
                          downloadSkinPack(`skin-${skin.name}`, json)
                        }}
                      >
                        ⬇️
                      </button>
                      <button
                        className="skin-card-action"
                        title="删除"
                        onClick={() => handleDeleteSkin(skin)}
                      >
                        🗑️
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="skin-grid-actions">
              <button
                className="skin-grid-action-btn"
                onClick={() => setEditorState({ mode: 'create' })}
              >
                ➕ 新建皮肤
              </button>
              <button
                className="skin-grid-action-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📥 导入皮肤
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={handleImportSkin}
              />
            </div>
          </div>

          {/* ---- AI 模型 ---- */}
          <div className="settings-section">
            <div className="settings-section-title">🤖 AI 模型</div>

            <div className="settings-row">
              <label className="settings-label">模型</label>
              <select
                className="settings-select"
                value={settings.model}
                onChange={(e) => handleChange({ model: e.target.value })}
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.tag})
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">API Key</label>
              <div className="settings-input-group">
                <input
                  className="settings-input"
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => handleChange({ apiKey: e.target.value })}
                  placeholder="sk-..."
                />
                <button
                  className="settings-eye-btn"
                  onClick={() => setShowKey(!showKey)}
                  title={showKey ? '隐藏' : '显示'}
                >
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="settings-row">
              <label className="settings-label">API 地址</label>
              <input
                className="settings-input"
                type="text"
                value={settings.baseUrl}
                onChange={(e) => handleChange({ baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
              />
            </div>

            <div className="settings-row settings-row-center">
              <button
                className="settings-test-btn"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? '测试中…' : '🔌 测试连接'}
              </button>
              {testResult === 'ok' && <span className="settings-test-ok">✓ 连接成功</span>}
              {testResult === 'fail' && <span className="settings-test-fail">✗ 连接失败</span>}
            </div>
          </div>

          {/* ---- 宠物 ---- */}
          <div className="settings-section">
            <div className="settings-section-title">🐾 宠物</div>

            <div className="settings-row">
              <label className="settings-label">名字</label>
              <input
                className="settings-input settings-input-short"
                type="text"
                value={settings.petName}
                onChange={(e) => handleChange({ petName: e.target.value })}
                placeholder="小光"
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">渲染器</label>
              <select
                className="settings-select"
                value={settings.rendererType}
                onChange={(e) => handleChange({ rendererType: e.target.value as 'pixel' | 'canvas' })}
              >
                <option value="pixel">像素风（推荐）</option>
                <option value="canvas">程序化绘制</option>
              </select>
            </div>

            <div className="settings-row settings-row-center">
              <label className="settings-label">开机自启</label>
              <button
                className={`settings-toggle ${settings.autoStart ? 'on' : ''}`}
                onClick={async () => {
                  const newVal = !settings.autoStart
                  handleChange({ autoStart: newVal })
                  await setAutoStart(newVal)
                }}
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>

            <div className="settings-row settings-row-center">
              <label className="settings-label">主动提醒</label>
              <button
                className={`settings-toggle ${settings.reminderEnabled ? 'on' : ''}`}
                onClick={() => handleChange({ reminderEnabled: !settings.reminderEnabled })}
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>

            {settings.reminderEnabled && (
              <div className="settings-row">
                <label className="settings-label">提醒间隔</label>
                <div className="settings-range-group">
                  <input
                    className="settings-range"
                    type="range"
                    min={15}
                    max={120}
                    step={15}
                    value={settings.reminderInterval}
                    onChange={(e) => handleChange({ reminderInterval: Number(e.target.value) })}
                  />
                  <span className="settings-range-value">{settings.reminderInterval} 分钟</span>
                </div>
              </div>
            )}
          </div>

          {/* ---- 音效 ---- */}
          <div className="settings-section">
            <div className="settings-section-title">🔊 音效</div>

            <div className="settings-row settings-row-center">
              <label className="settings-label">启用音效</label>
              <button
                className={`settings-toggle ${settings.soundEnabled ? 'on' : ''}`}
                onClick={() => {
                  handleChange({ soundEnabled: !settings.soundEnabled })
                  audioManager.setEnabled(!settings.soundEnabled)
                }}
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>

            {settings.soundEnabled && (
              <div className="settings-row">
                <label className="settings-label">音量</label>
                <div className="settings-range-group">
                  <input
                    className="settings-range"
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={Math.round(settings.soundVolume * 100)}
                    onChange={(e) => {
                      const vol = Number(e.target.value) / 100
                      handleChange({ soundVolume: vol })
                      audioManager.setVolume(vol)
                    }}
                  />
                  <span className="settings-range-value">{Math.round(settings.soundVolume * 100)}%</span>
                </div>
              </div>
            )}

            {settings.soundEnabled && (
              <div className="settings-row settings-row-center">
                <button
                  className="settings-test-btn"
                  onClick={() => {
                    audioManager.init()
                    audioManager.play('click')
                  }}
                >
                  🔔 试听音效
                </button>
              </div>
            )}
          </div>

          {/* ---- 关于 ---- */}
          <div className="settings-section">
            <div className="settings-section-title">ℹ️ 关于</div>
            <div className="settings-row">
              <span className="settings-label">版本</span>
              <span className="settings-value">0.1.0</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">引擎</span>
              <span className="settings-value">Tauri 2.0 + React</span>
            </div>
          </div>
        </div>
      </div>

      {editorState && (
        <SkinEditor
          mode={editorState.mode}
          existingSkin={editorState.mode === 'edit' ? editorState.skin : undefined}
          onClose={() => setEditorState(null)}
          onSaved={handleSkinSaved}
        />
      )}
    </>
  )
}
