import type { ConnectionProfile, CreateProfileInput, SshProfile } from '@fileterm/core'
import { t } from '../../i18n'
import { resolveSshJumpRoute } from '../../app/ssh-jump-route'
import './ssh-jump-route.css'
import { AppIcon } from '../common/app-icon'
import { DropdownSelect } from '../common/dropdown-select'
import { ConnectionProxySection } from './connection-proxy-section'
import { ConnectionTunnelSection } from './connection-tunnel-section'
import type { ConnectionFormSetter } from './connection-modal-utils'

export function ConnectionNetworkSection({
  form,
  jumpHosts,
  profiles,
  jumpRoute,
  routeError,
  routingMode,
  setForm,
  setRoutingMode
}: {
  form: CreateProfileInput
  jumpHosts: ConnectionProfile[]
  profiles: ConnectionProfile[]
  jumpRoute: SshProfile[]
  routeError: string | null
  routingMode: 'direct' | 'jump'
  setForm: ConnectionFormSetter
  setRoutingMode(value: 'direct' | 'jump'): void
}) {
  const supportsRouting = form.type === 'ssh'
  const supportsProxy = form.type === 'ssh' || form.type === 'telnet' || form.type === 'ftp'
  const supportsTunnel = form.type === 'ssh'

  return (
    <div className="ssh-form-page network-form-page">
      <div className="network-overview-tip">
        <AppIcon name="info" size={14} className="network-overview-tip__icon" />
        <p className="network-overview-tip__text">{t.networkProfilesLocationHint}</p>
      </div>

      {supportsRouting ? (
        <fieldset className="ssh-fieldset">
          <legend>{t.networkRouting}</legend>
          <div className="network-card__body">
            <div className="network-setting-row">
              <span className="network-setting-row__label">{t.route}</span>
              <div className="network-setting-row__control">
                <div className="network-routing-modes" role="radiogroup" aria-label={t.route}>
                  <button
                    aria-checked={routingMode === 'direct'}
                    className={routingMode === 'direct' ? 'is-active' : undefined}
                    onClick={() => {
                      setRoutingMode('direct')
                      setForm((prev) => ({ ...prev, jumpProfileId: undefined }))
                    }}
                    role="radio"
                    type="button"
                  >
                    {t.direct}
                  </button>
                  <button
                    aria-checked={routingMode === 'jump'}
                    className={routingMode === 'jump' ? 'is-active' : undefined}
                    onClick={() => setRoutingMode('jump')}
                    role="radio"
                    type="button"
                  >
                    {t.viaJumpHost}
                  </button>
                </div>
              </div>
            </div>

            {routingMode === 'jump' && jumpHosts.length ? (
              <div className="network-setting-subgroup">
                <div className="network-setting-row">
                  <label className="network-setting-row__label" htmlFor="connection-jump-host">
                    {t.jumpHost}
                  </label>
                  <div className="network-setting-row__control">
                    <DropdownSelect
                      id="connection-jump-host"
                      ariaLabel={t.jumpHost}
                      className="network-select-control network-routing-select"
                      placeholder={t.selectJumpHost}
                      value={form.jumpProfileId ?? ''}
                      options={[
                        { value: '', label: t.selectJumpHost, disabled: true },
                        ...jumpHosts.map((profile) => ({
                          value: profile.id,
                          label: `${resolveSshJumpRoute({ jumpProfileId: profile.id }, profiles)
                            .jumpHosts.map((hop) => hop.name)
                            .join(' → ')} (${profile.host})`
                        }))
                      ]}
                      onChange={(value) => setForm((prev) => ({ ...prev, jumpProfileId: value || undefined }))}
                    />
                  </div>
                </div>
                <p className="network-field-hint">{t.jumpHostHint}</p>
              </div>
            ) : null}

            {routingMode === 'jump' && form.jumpProfileId ? (
              routeError ? (
                <p className="network-field-hint network-field-hint--warning" role="alert">
                  {routeError}
                </p>
              ) : (
                <ol className="ssh-jump-route" aria-label={t.route}>
                  <li>FileTerm</li>
                  {jumpRoute.map((hop) => (
                    <li key={hop.id} title={`${hop.host}:${hop.port}`}>
                      {hop.name}
                    </li>
                  ))}
                  <li>{form.name?.trim() || form.host || t.sshJumpRouteTarget}</li>
                </ol>
              )
            ) : null}

            {routingMode === 'jump' && !jumpHosts.length ? (
              <p className="network-field-hint network-field-hint--warning">{t.noAvailableJumpHost}</p>
            ) : null}
          </div>
        </fieldset>
      ) : null}

      {supportsProxy ? <ConnectionProxySection form={form} setForm={setForm} /> : null}

      {supportsTunnel ? <ConnectionTunnelSection form={form} setForm={setForm} /> : null}
    </div>
  )
}
