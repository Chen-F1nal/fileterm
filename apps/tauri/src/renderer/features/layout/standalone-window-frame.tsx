import { useEffect, useState, type ReactNode } from 'react'
import { t } from '../../i18n'
import './standalone-window-frame.css'
import { AppIcon } from '../common/app-icon'
import { CloseButton } from '../common/close-button'

export function StandaloneWindowFrame({
  children,
  isWindows,
  showPlatformTitlebar = true,
  title
}: {
  children: ReactNode
  isWindows: boolean
  showPlatformTitlebar?: boolean
  title: string
}) {
  const shouldShowPlatformTitlebar = isWindows && showPlatformTitlebar
  return (
    <div className={`standalone-window-frame ${shouldShowPlatformTitlebar ? 'has-standalone-titlebar' : ''}`}>
      <StandaloneWindowTitlebar isWindows={shouldShowPlatformTitlebar} title={title} />
      {children}
    </div>
  )
}

export function StandaloneWindowTitlebar({ isWindows, title }: { isWindows: boolean; title: string }) {
  const desktopApi = window.fileterm
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isWindows || !desktopApi) {
      return
    }
    desktopApi.isCurrentWindowMaximized().then(setIsMaximized).catch(console.error)
    const unsubscribe = desktopApi.onWindowMaximizedChange(setIsMaximized)
    return unsubscribe
  }, [isWindows, desktopApi])

  if (!isWindows) {
    return null
  }

  return (
    <div className="standalone-window-titlebar" data-tauri-drag-region="deep">
      <div className="window-brandmark">
        <AppIcon name="brand" size={18} />
        <strong>{t.appTitle}</strong>
        <span>{title}</span>
      </div>
      <div className="window-control-buttons">
        <button
          aria-label="Minimize"
          type="button"
          onClick={() => {
            void desktopApi?.minimizeCurrentWindow()
          }}
        >
          <AppIcon name="window-minimize" size={10} strokeWidth={1} />
        </button>
        <button
          aria-label="Maximize"
          type="button"
          onClick={() => {
            void desktopApi?.toggleMaximizeCurrentWindow()
          }}
        >
          <AppIcon name={isMaximized ? 'window-restore' : 'window-maximize'} size={10} strokeWidth={1} />
        </button>
        <CloseButton
          aria-label="Close"
          onClick={() => {
            void desktopApi?.closeCurrentWindow()
          }}
          size="window"
        />
      </div>
    </div>
  )
}
