import { FormDialogBody } from '../../components/common/dialog/form-dialog-body'
import { useEffect, useId, useState } from 'react'
import { CloseButton } from '../common/close-button'
import { Button } from '../../components/common/button/button'
import { StableButtonLabel } from '../common/stable-button-content'
import { t } from '../../i18n'
import './file-action-modal.css'

export function FileActionModal({
  confirmLabel,
  description,
  errorMessage,
  hint,
  initialValue = '',
  inputLabel,
  inputPlaceholder,
  isSubmitting = false,
  onClose,
  onConfirm,
  title
}: {
  confirmLabel: string
  description?: string
  errorMessage?: string | null
  hint?: string
  initialValue?: string
  inputLabel?: string
  inputPlaceholder?: string
  isSubmitting?: boolean
  onClose(): void
  onConfirm(value: string): void
  title: string
}) {
  const titleId = useId()
  const fieldId = useId()
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card form-dialog file-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!isSubmitting) onClose()
          }
        }}
      >
        <div className="modal-header">
          <span id={titleId}>{title}</span>
          <CloseButton disabled={isSubmitting} onClick={onClose} />
        </div>
        <FormDialogBody>
          <div className="file-action-fields">
            {inputLabel ? (
              <label className="file-action-label" htmlFor={fieldId}>
                {inputLabel}
              </label>
            ) : null}
            {description ? <div className="file-action-description">{description}</div> : null}
            {inputLabel ? (
              <div className="file-action-field">
                <input
                  autoFocus
                  id={fieldId}
                  disabled={isSubmitting}
                  placeholder={inputPlaceholder}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isSubmitting) {
                      onConfirm(value)
                    }
                  }}
                />
              </div>
            ) : null}
            {hint ? <div className="file-action-hint">{hint}</div> : null}
            {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
          </div>
        </FormDialogBody>
        <div className="form-actions">
          <Button variant="secondary" disabled={isSubmitting} onClick={onClose} type="button">
            {t.cancel}
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            reserveLoadingSpace
            className="file-action-submit-button"
            disabled={isSubmitting}
            onClick={() => onConfirm(value)}
            type="button"
          >
            <StableButtonLabel label={confirmLabel} />
          </Button>
        </div>
      </div>
    </div>
  )
}
