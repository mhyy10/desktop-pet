import { useState } from 'react'
import type { PetTheme } from '../pet/types'
import { SKINS, defaultTheme } from '../pet'
import type { CustomSkin } from '../pet'
import {
  createCustomSkin,
  addCustomSkin,
  saveCustomSkins,
  loadCustomSkins,
} from '../utils/customSkins'
import { registerCustomSkin } from '../pet/skinRegistry'
import {
  serializeSkinPack,
  downloadSkinPack,
} from '../pet/skinPack'
import { SkinPreview } from './SkinPreview'
import './SkinEditor.css'

// ============================================
// 皮肤编辑器（模态）
// 支持新建 / 编辑自定义皮肤配色
// ============================================

interface SkinEditorProps {
  /** 新建 or 编辑 */
  mode: 'create' | 'edit'
  /** 编辑模式下的已有皮肤；新建模式可传一个作为起点（如基于某内置皮肤派生） */
  existingSkin?: CustomSkin
  onClose: () => void
  /** 保存成功后回调，参数为保存后的皮肤 */
  onSaved: (skin: CustomSkin) => void
}

/** 核心配色字段（真正影响像素外观） */
const CORE_FIELDS: { key: keyof PetTheme; label: string }[] = [
  { key: 'bodyColor', label: '身体' },
  { key: 'glowColor', label: '光晕' },
  { key: 'eyeColor', label: '眼睛' },
  { key: 'cheekColor', label: '腮红' },
]

/** 高级配色字段（两渲染器基本闲置，保留可调） */
const ADVANCED_FIELDS: { key: keyof PetTheme; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'warm', label: 'Warm' },
  { key: 'cool', label: 'Cool' },
]

export function SkinEditor({ mode, existingSkin, onClose, onSaved }: SkinEditorProps) {
  const isEdit = mode === 'edit'

  const [name, setName] = useState(existingSkin?.name ?? '新皮肤')
  const [icon, setIcon] = useState(existingSkin?.icon ?? '🌟')
  const [description, setDescription] = useState(existingSkin?.description ?? '')
  const [theme, setTheme] = useState<PetTheme>(
    existingSkin?.theme ? { ...existingSkin.theme } : { ...defaultTheme }
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setColor = (key: keyof PetTheme, value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  const applyPreset = (presetTheme: PetTheme) => {
    // 深拷贝，避免与内置皮肤共享引用
    setTheme({ ...presetTheme })
  }

  const handleSave = () => {
    setError(null)
    if (!name.trim()) {
      setError('请填写皮肤名称')
      return
    }
    if (!icon.trim()) {
      setError('请填写图标（emoji）')
      return
    }

    try {
      if (isEdit && existingSkin) {
        // 编辑：theme 改变后旧 IndexedDB 缓存会命中错误 sheet，
        // 因此换新 id（custom_ + 新 uuid），旧缓存自然废弃。
        // localStorage 侧：删旧记录 + 加新记录。
        const newId = 'custom_' + crypto.randomUUID()
        const updated: CustomSkin = {
          ...existingSkin,
          id: newId,
          name: name.trim(),
          icon: icon.trim(),
          description: description.trim(),
          theme,
          updatedAt: Date.now(),
        }
        const withoutOld = loadCustomSkins().filter((s) => s.id !== existingSkin.id)
        withoutOld.push(updated)
        saveCustomSkins(withoutOld)
        registerCustomSkin(updated)
        onSaved(updated)
      } else {
        // 新建
        const skin = createCustomSkin(name.trim(), icon.trim(), description.trim(), theme)
        addCustomSkin(skin)
        registerCustomSkin(skin)
        onSaved(skin)
      }
      onClose()
    } catch (err) {
      setError('保存失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleExport = () => {
    try {
      const json = serializeSkinPack({ name, icon, description, theme })
      const filename = `skin-${name || 'custom'}`
      downloadSkinPack(filename, json)
    } catch (err) {
      setError('导出失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <>
      <div className="tool-panel-overlay" onClick={onClose} />
      <div className="tool-panel skin-editor">
        <div className="tool-panel-header">
          <span className="tool-panel-title">{isEdit ? '✏️ 编辑皮肤' : '🎨 新建皮肤'}</span>
          <button className="tool-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="tool-panel-body skin-editor-body">
          {/* 实时预览 */}
          <div className="skin-editor-preview-wrap">
            <SkinPreview theme={theme} size={144} />
          </div>

          {/* 基本信息 */}
          <div className="skin-editor-form-row">
            <label className="skin-editor-label">名称</label>
            <input
              className="skin-editor-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              placeholder="给皮肤起个名字"
            />
          </div>
          <div className="skin-editor-form-row">
            <label className="skin-editor-label">图标</label>
            <input
              className="skin-editor-input skin-editor-icon-input"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              placeholder="🌟"
            />
          </div>
          <div className="skin-editor-form-row">
            <label className="skin-editor-label">描述</label>
            <input
              className="skin-editor-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={40}
              placeholder="一句话描述"
            />
          </div>

          {/* 核心配色 */}
          <div className="skin-editor-section-title">配色</div>
          <div className="skin-editor-colors">
            {CORE_FIELDS.map(({ key, label }) => (
              <ColorField
                key={key}
                label={label}
                value={theme[key]}
                onChange={(v) => setColor(key, v)}
              />
            ))}
          </div>

          {/* 高级配色 */}
          <button
            className="skin-editor-advanced-toggle"
            onClick={() => setShowAdvanced((s) => !s)}
          >
            {showAdvanced ? '▼' : '▶'} 高级配色
          </button>
          {showAdvanced && (
            <div className="skin-editor-colors">
              {ADVANCED_FIELDS.map(({ key, label }) => (
                <ColorField
                  key={key}
                  label={label}
                  value={theme[key]}
                  onChange={(v) => setColor(key, v)}
                />
              ))}
            </div>
          )}

          {/* 预设模板 */}
          <div className="skin-editor-section-title">从模板开始</div>
          <div className="skin-editor-presets">
            {SKINS.map((skin) => (
              <button
                key={skin.id}
                className="skin-editor-preset"
                onClick={() => applyPreset(skin.theme)}
                title={skin.description}
              >
                <span>{skin.icon}</span>
                <span>{skin.name}</span>
              </button>
            ))}
          </div>

          {error && <div className="skin-editor-error">{error}</div>}
        </div>

        <div className="skin-editor-footer">
          <button className="skin-editor-btn skin-editor-btn-ghost" onClick={handleExport}>
            ⬇️ 导出
          </button>
          <button className="skin-editor-btn skin-editor-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="skin-editor-btn skin-editor-btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </>
  )
}

/** 单个颜色字段：拾色器 + hex 文本框 */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="skin-editor-color-field">
      <input
        type="color"
        className="skin-editor-color-picker"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="skin-editor-color-label">{label}</span>
      <input
        type="text"
        className="skin-editor-color-hex"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          // 宽松输入，校验交给 color picker
          if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v)
        }}
        maxLength={7}
      />
    </div>
  )
}
