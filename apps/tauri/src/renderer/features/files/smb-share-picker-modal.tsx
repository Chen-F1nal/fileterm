import { FormDialogBody } from '../../components/common/dialog/form-dialog-body'
import { MaterialIcon } from '../../components/common/material-icon/material-icon'
import { useEffect, useState } from 'react'
import { CloseButton } from '../common/close-button'
import { DropdownSelect } from '../common/dropdown-select'
import { StableButtonLabel } from '../common/stable-button-content'
import { Button } from '../../components/common/button/button'
import { t } from '../../i18n'

export function SmbSharePickerModal({
  errorMessage,
  isSubmitting = false,
  path,
  shares,
  onCancel,
  onChangeCredentials,
  onSubmit
}: {
  errorMessage?: string | null
  isSubmitting?: boolean
  path: string
  shares: string[]
  onCancel(): void
  onChangeCredentials(): void
  onSubmit(share: string): void
}) {
  const [selectedShare, setSelectedShare] = useState(shares[0] ?? '')

  useEffect(() => {
    setSelectedShare(shares[0] ?? '')
  }, [path, shares])

  return (
    <div className="modal-backdrop">
      <div className="modal-card form-dialog ssh-interaction-modal network-share-picker-modal">
        <div className="network-share-modal__header modal-header">
          <span className="network-share-modal__title">
            <MaterialIcon name="folder_shared" aria-hidden="true" className="material-symbols-outlined" />
            <span>{t.networkShareSelectTitle}</span>
          </span>
          <CloseButton className="network-share-modal__close" disabled={isSubmitting} onClick={onCancel} />
        </div>

        <FormDialogBody>
          <fieldset className="ssh-fieldset network-share-fieldset" disabled={isSubmitting}>
            <legend>{t.general}</legend>
            <div className="network-share-description">{t.networkShareSelectDescription}</div>
            <div className="network-share-path-value">
              <span>{t.networkShareCredentialsPath}</span>
              <strong title={path}>{path}</strong>
            </div>

            <label className="file-action-field">
              <span>{t.networkShareSelectFolder}</span>
              <DropdownSelect
                autoFocus
                className="network-share-select-shell"
                disabled={isSubmitting}
                value={selectedShare}
                options={shares.map((share) => ({ value: share, label: share }))}
                onChange={(value) => setSelectedShare(value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isSubmitting) {
                    onSubmit(selectedShare)
                  }
                }}
              />
            </label>
          </fieldset>

          {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
        </FormDialogBody>
        <div className="form-actions">
          <Button variant="secondary" disabled={isSubmitting} onClick={onCancel} type="button">
            {t.cancel}
          </Button>
          <Button variant="secondary" disabled={isSubmitting} onClick={onChangeCredentials} type="button">
            {t.networkShareSelectChangeCredentials}
          </Button>
          <Button
            loading={isSubmitting}
            reserveLoadingSpace
            variant="primary"
            disabled={isSubmitting || !selectedShare}
            onClick={() => onSubmit(selectedShare)}
            type="button"
          >
            <StableButtonLabel label={t.networkShareSelectConfirm} />
          </Button>
        </div>
      </div>
    </div>
  )
}
