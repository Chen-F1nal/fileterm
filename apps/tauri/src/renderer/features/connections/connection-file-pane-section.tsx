import type { CreateProfileInput } from '@fileterm/core'
import { t } from '../../i18n'
import { DropdownSelect } from '../common/dropdown-select'
import type { ConnectionFormSetter } from './connection-modal-utils'

export function ConnectionFilePaneSection({
  form,
  setForm
}: {
  form: CreateProfileInput
  setForm: ConnectionFormSetter
}) {
  return (
    <div className="ssh-form-page">
      <fieldset className="ssh-fieldset narrow">
        <legend>{t.filePaneDefaultMode}</legend>
        <div className="ssh-grid single">
          <label className="span-2">
            {t.filePaneDisplayMode}:
            <DropdownSelect
              ariaLabel={t.filePaneDefaultMode}
              options={[
                { value: 'local', label: t.filePaneLocal },
                { value: 'remote-tree', label: t.remoteDirectoryTree }
              ]}
              value={form.filePaneMode ?? 'local'}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  filePaneMode: value === 'remote-tree' ? 'remote-tree' : 'local'
                }))
              }
            />
          </label>
          <p className="ssh-field-hint">{t.filePaneDefaultModeHint}</p>
        </div>
      </fieldset>
    </div>
  )
}
