import { useEffect, useRef, useState } from 'react'
import './diagnostic-log-settings.css'
import {
  DIAGNOSTIC_LOG_CATEGORIES,
  type DiagnosticLogCategories,
  type DiagnosticLogCategory,
  type FileTermDesktopApi
} from '@fileterm/core'
import type { LocaleMessages } from '../../../../i18n'
import { SelectionControl } from '../../../common/selection-control'

export function DiagnosticLogSettings({
  desktopApi,
  t
}: {
  desktopApi: FileTermDesktopApi | undefined
  t: LocaleMessages
}) {
  const [categories, setCategories] = useState<DiagnosticLogCategories | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!desktopApi) return
    let active = true
    const apply = (preferences: { diagnosticLogCategories: DiagnosticLogCategories }) => {
      if (active) setCategories(preferences.diagnosticLogCategories)
    }
    void desktopApi
      .getUiPreferences()
      .then(apply)
      .catch(() => {
        if (active) setError(true)
      })
    const unsubscribe = desktopApi.onUiPreferencesChanged(apply)
    return () => {
      active = false
      unsubscribe()
    }
  }, [desktopApi])

  const save = async (category: DiagnosticLogCategory, enabled: boolean) => {
    if (!desktopApi || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(false)
    try {
      const preferences = await desktopApi.setUiPreferences({ diagnosticLogCategories: { [category]: enabled } })
      setCategories(preferences.diagnosticLogCategories)
    } catch {
      setError(true)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="diagnostic-log-settings">
      <div className="diagnostic-log-intro">
        <p>{t.diagnosticLogCategoriesHint}</p>
        <p>{t.diagnosticLogRetentionHint}</p>
      </div>
      <div className="diagnostic-log-grid" aria-busy={saving}>
        {DIAGNOSTIC_LOG_CATEGORIES.map((category) => (
          <label className="diagnostic-log-card" key={category} title={t[`diagnosticLogCategory_${category}`]}>
            <span className="diagnostic-log-card-label">{t[`diagnosticLogCategory_${category}`]}</span>
            <span className="command-toggle">
              <SelectionControl
                type="checkbox"
                checked={categories?.[category] ?? false}
                disabled={!categories || saving}
                onChange={(event) => void save(category, event.target.checked)}
              />
            </span>
          </label>
        ))}
      </div>
      <p className="diagnostic-log-help">{t.diagnosticLogTroubleshootingHint}</p>
      {error ? (
        <p className="modal-error" role="alert">
          {t.diagnosticLogSettingsFailed}
        </p>
      ) : null}
    </div>
  )
}
