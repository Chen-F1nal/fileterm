import { MaterialIcon } from '../../components/common/material-icon/material-icon'
import { t } from '../../i18n'

export function AiCopilotSetup({ onOpenSettings }: { onOpenSettings(): void }) {
  return (
    <section className="ai-copilot-setup" aria-labelledby="ai-copilot-setup-title">
      <MaterialIcon name="auto_awesome" aria-hidden="true" className="material-symbols-outlined ai-copilot-setup-orb" />
      <span className="ai-copilot-eyebrow">{t.aiCopilotPreview}</span>
      <h2 id="ai-copilot-setup-title">{t.aiCopilotNotConfigured}</h2>
      <p>{t.aiCopilotNotConfiguredDescription}</p>
      <button className="ai-copilot-setup-action" type="button" onClick={onOpenSettings}>
        <MaterialIcon name="tune" aria-hidden="true" className="material-symbols-outlined" />
        <span>{t.aiCopilotConfigureProvider}</span>
        <MaterialIcon
          name="arrow_forward"
          aria-hidden="true"
          className="material-symbols-outlined ai-copilot-action-arrow"
        />
      </button>
      <div className="ai-copilot-principles" aria-label={t.aiCopilotPreview}>
        <article>
          <MaterialIcon name="shield" aria-hidden="true" className="material-symbols-outlined" />
          <span>
            <strong>{t.aiCopilotPrivacyTitle}</strong>
            <small>{t.aiCopilotPrivacyDescription}</small>
          </span>
        </article>
        <article>
          <MaterialIcon name="terminal" aria-hidden="true" className="material-symbols-outlined" />
          <span>
            <strong>{t.aiCopilotCommandTitle}</strong>
            <small>{t.aiCopilotCommandDescription}</small>
          </span>
        </article>
      </div>
    </section>
  )
}
