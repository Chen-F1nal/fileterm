import { FormDialogBody } from '../../components/common/dialog/form-dialog-body'
import { useEffect, useState } from 'react'
import type { SshKeyPassphrasePromptRequest } from '@fileterm/core'
import { t } from '../../i18n'
import { CloseButton } from '../common/close-button'
import { SelectionControl } from '../common/selection-control'
import { StableButtonLabel } from '../common/stable-button-content'
import { Button } from '../../components/common/button/button'
import { sshInteractionConnectionLabel } from './ssh-interaction-labels'

export function SshKeyPassphraseModal({
  errorMessage,
  isSubmitting = false,
  request,
  onCancel,
  onSubmit
}: {
  errorMessage?: string | null
  isSubmitting?: boolean
  request: SshKeyPassphrasePromptRequest
  onCancel(): void
  onSubmit(input: { passphrase: string; savePassphrase: boolean }): void
}) {
  const [passphrase, setPassphrase] = useState('')
  const [savePassphrase, setSavePassphrase] = useState(false)

  useEffect(() => {
    setPassphrase('')
    setSavePassphrase(false)
  }, [request])

  const submit = () => onSubmit({ passphrase, savePassphrase })

  return (
    <div className="modal-backdrop">
      <div className="modal-card form-dialog ssh-interaction-modal">
        <div className="modal-header">
          <span>{t.sshKeyPassphraseTitle}</span>
          <CloseButton disabled={isSubmitting} onClick={onCancel} />
        </div>
        <FormDialogBody>
          <fieldset className="ssh-fieldset">
            <legend>{t.general}</legend>
            <div className="root-access-description">
              {request.reason === 'invalid-saved' ? t.sshKeyPassphraseInvalidSaved : t.sshKeyPassphraseRequired}
            </div>
            <div className="root-access-meta">
              <span>{t.sshKeyboardInteractiveConnection}</span>
              <strong>{sshInteractionConnectionLabel(request.authenticationTarget, request.connectionName)}</strong>
            </div>
            <div className="root-access-meta">
              <span>{t.sshKeyPassphraseKey}</span>
              <strong>{request.keyName}</strong>
            </div>
            <label className="file-action-field">
              <span>{t.sshKeyPassphraseLabel}</span>
              <input
                autoFocus
                disabled={isSubmitting}
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submit()
                }}
              />
            </label>
            <label className="ssh-checkbox">
              <SelectionControl
                checked={savePassphrase}
                disabled={isSubmitting}
                type="checkbox"
                onChange={(event) => setSavePassphrase(event.target.checked)}
              />
              <span>{t.sshKeyPassphraseSave}</span>
            </label>
            {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
          </fieldset>
        </FormDialogBody>
        <div className="form-actions">
          <Button variant="secondary" disabled={isSubmitting} onClick={onCancel} type="button">
            {t.cancel}
          </Button>
          <Button
            loading={isSubmitting}
            reserveLoadingSpace
            variant="primary"
            disabled={!passphrase || isSubmitting}
            onClick={submit}
            type="button"
          >
            <StableButtonLabel label={t.sshKeyPassphraseContinue} />
          </Button>
        </div>
      </div>
    </div>
  )
}
