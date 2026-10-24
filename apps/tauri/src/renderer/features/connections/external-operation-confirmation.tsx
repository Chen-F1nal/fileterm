import { useRef } from 'react'
import type { ActionApprovalRequest } from '@fileterm/core'
import { t } from '../../i18n'
import { AppIcon } from '../common/app-icon'
import { CloseButton } from '../common/close-button'
import { ConfirmActionDialog } from '../common/confirm-action-dialog'
import { SelectionControl } from '../common/selection-control'
import { VerticalScrollbar } from '../common/vertical-scrollbar'
import './external-operation-confirmation.css'

export function ExternalOperationConfirmation({
  request,
  isSubmitting,
  riskAcknowledged,
  onRiskAcknowledged,
  onResolve
}: {
  request: ActionApprovalRequest
  isSubmitting: boolean
  riskAcknowledged: boolean
  onRiskAcknowledged(value: boolean): void
  onResolve(approved: boolean): void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const commandRef = useRef<HTMLPreElement>(null)
  const sourceLabel =
    request.source === 'cli' ? t.sessionSourceCli : request.source === 'mcp' ? t.sessionSourceMcp : 'Copilot'

  return (
    <ConfirmActionDialog
      className="external-operation-confirmation"
      confirmLabel={t.confirm}
      confirmVariant={request.destructive ? 'danger' : 'primary'}
      confirmDisabled={Boolean(request.requiresRiskAcknowledgement && !riskAcknowledged)}
      initialFocus="none"
      isSubmitting={isSubmitting}
      onClose={() => onResolve(false)}
      onConfirm={() => onResolve(true)}
      title={
        <>
          <span className="external-operation-confirmation__title">
            <AppIcon name="shield-check" size={16} />
            <span>{request.title}</span>
          </span>
          <CloseButton aria-label={t.cancel} disabled={isSubmitting} onClick={() => onResolve(false)} />
        </>
      }
      description={
        <div className="external-operation-confirmation__body">
          <div ref={bodyRef} className="external-operation-confirmation__content">
            <fieldset className="external-operation-confirmation__group">
              <legend>{t.general}</legend>
              <p>{request.summary}</p>
              <div className="external-operation-confirmation__source-row">
                <span>{t.sessionSource}</span>
                <span className={`external-operation-confirmation__source is-${request.source}`}>{sourceLabel}</span>
              </div>
              {request.target ? (
                <div className="external-operation-confirmation__field">
                  <span>{t.actionApprovalTarget}</span>
                  <div className="external-operation-confirmation__value">{request.target}</div>
                </div>
              ) : null}
            </fieldset>
            {request.details ? (
              <fieldset className="external-operation-confirmation__group">
                <legend>{t.actionApprovalCommand}</legend>
                <div className="external-operation-confirmation__code">
                  <pre ref={commandRef} tabIndex={0} aria-label={t.actionApprovalCommand}>
                    {request.details}
                  </pre>
                  <VerticalScrollbar scrollRef={commandRef} ariaLabel={t.actionApprovalCommand} />
                </div>
              </fieldset>
            ) : null}
            {request.requiresRiskAcknowledgement ? (
              <label className="external-operation-confirmation__warning">
                <SelectionControl
                  checked={riskAcknowledged}
                  disabled={isSubmitting}
                  onChange={(event) => onRiskAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                <span>{t.actionApprovalRiskAcknowledgement}</span>
              </label>
            ) : null}
          </div>
          <VerticalScrollbar scrollRef={bodyRef} />
        </div>
      }
    />
  )
}
