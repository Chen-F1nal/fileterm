import { FormDialogBody } from '../../components/common/dialog/form-dialog-body'
import type { SshHostVerificationRequest } from '@fileterm/core'
import { CloseButton } from '../common/close-button'
import { StableButtonLabel } from '../common/stable-button-content'
import { Button } from '../../components/common/button/button'
import { t } from '../../i18n'
import { sshInteractionConnectionLabel } from './ssh-interaction-labels'

export function SshHostVerificationModal({
  isSubmitting = false,
  request,
  onAcceptAndSave,
  onAcceptOnce,
  onReject
}: {
  isSubmitting?: boolean
  request: SshHostVerificationRequest
  onAcceptAndSave(): void
  onAcceptOnce(): void
  onReject(): void
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card form-dialog ssh-interaction-modal ssh-host-verification-modal">
        <div className="modal-header">
          <span>{t.sshHostVerificationTitle}</span>
          <CloseButton disabled={isSubmitting} onClick={onReject} />
        </div>
        <FormDialogBody>
          <fieldset className="ssh-fieldset ssh-verification-fieldset">
            <legend>{t.general}</legend>
            <div className="root-access-description">{t.sshHostVerificationDescription}</div>

            <div className="root-access-meta">
              <span>{t.sshKeyboardInteractiveConnection}</span>
              <strong>{sshInteractionConnectionLabel(request.authenticationTarget, request.connectionName)}</strong>
            </div>

            <div className="root-access-meta">
              <span>{t.host}</span>
              <strong>{`${request.host}:${request.port}`}</strong>
            </div>
          </fieldset>

          {request.knownFingerprint ? <div className="modal-error">{t.sshHostVerificationChanged}</div> : null}

          <fieldset className="ssh-fieldset ssh-verification-fieldset">
            <legend>{t.sshHostFingerprintLabel}</legend>
            <div className="ssh-verification-box">
              <span>{t.sshHostFingerprintLabel}</span>
              <strong>{request.fingerprint}</strong>
            </div>

            {request.knownFingerprint ? (
              <div className="ssh-verification-box">
                <span>{t.sshHostKnownFingerprintLabel}</span>
                <strong>{request.knownFingerprint}</strong>
              </div>
            ) : null}
          </fieldset>
        </FormDialogBody>
        <div className="form-actions ssh-verification-actions">
          <Button variant="secondary" disabled={isSubmitting} onClick={onReject} type="button">
            {t.sshHostReject}
          </Button>
          <Button variant="secondary" disabled={isSubmitting} onClick={onAcceptOnce} type="button">
            {t.sshHostAcceptOnce}
          </Button>
          <Button
            loading={isSubmitting}
            reserveLoadingSpace
            variant="primary"
            disabled={isSubmitting}
            onClick={onAcceptAndSave}
            type="button"
          >
            <StableButtonLabel label={t.sshHostAcceptAndSave} />
          </Button>
        </div>
      </div>
    </div>
  )
}
