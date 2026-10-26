import { MaterialIcon } from '../../components/common/material-icon/material-icon'
import { t } from '../../i18n'
import { CloseButton } from '../common/close-button'

export function AiCopilotHeader({
  canChat,
  isStreaming,
  onClose,
  onOpenSettings,
  openNewConversation
}: {
  canChat: boolean
  isStreaming: boolean
  onClose(): void
  onOpenSettings(): void
  openNewConversation(): void
}) {
  return (
    <header className="ai-copilot-header">
      <div className="ai-copilot-title">
        <MaterialIcon
          name="auto_awesome"
          aria-hidden="true"
          className="material-symbols-outlined ai-copilot-title-icon"
        />
        <span>
          <strong>{t.aiCopilot}</strong>
        </span>
      </div>
      <div className="ai-copilot-header-actions">
        <button
          aria-label={t.aiCopilotNewChat}
          className="ai-copilot-icon-button"
          disabled={!canChat || isStreaming}
          title={t.aiCopilotNewChat}
          type="button"
          onClick={openNewConversation}
        >
          <MaterialIcon name="add_comment" aria-hidden="true" className="material-symbols-outlined" />
        </button>
        <button
          aria-label={t.aiCopilotConfigureProvider}
          className="ai-copilot-icon-button"
          title={t.aiCopilotConfigureProvider}
          type="button"
          onClick={onOpenSettings}
        >
          <MaterialIcon name="settings_suggest" aria-hidden="true" className="material-symbols-outlined" />
        </button>
        <CloseButton aria-label={t.closeAiCopilot} onClick={onClose} size="compact" />
      </div>
    </header>
  )
}
