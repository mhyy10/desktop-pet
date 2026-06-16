import { useState, useRef, useEffect } from 'react'
import {
  loadSettings,
  updateSettings,
  type PetSettings,
} from '../utils/storage'
import { AVAILABLE_MODELS } from '../ai'
import type { ChatEngine } from '../ai'
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

  useEffect(() => {
    // ESC 关闭
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
    // 5 秒后清除结果
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
    </>
  )
}
