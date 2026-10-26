import { FormDialogBody } from '../../components/common/dialog/form-dialog-body'
import { MaterialIcon } from '../../components/common/material-icon/material-icon'
import { useEffect, useState } from 'react'
import { CloseButton } from '../common/close-button'
import { StableButtonLabel } from '../common/stable-button-content'
import { Button } from '../../components/common/button/button'
import { t } from '../../i18n'

function isSmbHostPath(path: string) {
  const withoutScheme = path.trim().replace(/^smb:\/\//i, '')
  return withoutScheme.split(/[\\/]+/).filter(Boolean).length === 1
}

export function SmbCredentialsModal({
  errorMessage,
  isSubmitting = false,
  path,
  onCancel,
  onSubmit
}: {
  errorMessage?: string | null
  isSubmitting?: boolean
  path: string
  onCancel(): void
  onSubmit(input: { username: string; password: string }): void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const needsShareSelection = isSmbHostPath(path)

  useEffect(() => {
    setUsername('')
    setPassword('')
  }, [path])

  const submit = () => {
    onSubmit({ username, password })
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card form-dialog ssh-interaction-modal network-share-credentials-modal">
        <div className="network-share-modal__header modal-header">
          <span className="network-share-modal__title">
            <MaterialIcon name="folder_shared" aria-hidden="true" className="material-symbols-outlined" />
            <span>{t.networkShareCredentialsTitle}</span>
          </span>
          <CloseButton className="network-share-modal__close" disabled={isSubmitting} onClick={onCancel} />
        </div>

        <FormDialogBody>
          <fieldset className="ssh-fieldset network-share-fieldset">
            <legend>{t.general}</legend>
            <div className="network-share-description">
              {needsShareSelection ? t.networkShareCredentialsHostDescription : t.networkShareCredentialsDescription}
            </div>
            <div className="network-share-path-value">
              <span>{t.networkShareCredentialsPath}</span>
              <strong title={path}>{path}</strong>
            </div>
          </fieldset>

          <fieldset className="ssh-fieldset network-share-fieldset" disabled={isSubmitting}>
            <legend>{t.auth}</legend>
            <label className="file-action-field">
              <span>{t.networkShareCredentialsUsername}</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isSubmitting) {
                    submit()
                  }
                }}
              />
            </label>

            <label className="file-action-field">
              <span>{t.networkShareCredentialsPassword}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isSubmitting) {
                    submit()
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
          <Button
            loading={isSubmitting}
            reserveLoadingSpace
            variant="primary"
            disabled={isSubmitting}
            onClick={submit}
            type="button"
          >
            <StableButtonLabel
              label={needsShareSelection ? t.networkShareCredentialsSelect : t.networkShareCredentialsConfirm}
              reserveLabel={needsShareSelection ? t.networkShareCredentialsConfirm : t.networkShareCredentialsSelect}
            />
          </Button>
        </div>
      </div>
    </div>
  )
}
