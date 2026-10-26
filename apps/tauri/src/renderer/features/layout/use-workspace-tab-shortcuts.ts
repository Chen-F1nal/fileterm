import { useEffect } from 'react'
import type { OrderedTabEntry } from './tab-bar'

function targetTabIndex(event: KeyboardEvent, isMac: boolean, activeIndex: number, count: number): number | null {
  const { key, ctrlKey, metaKey, altKey, shiftKey } = event
  let direction = 0
  if (ctrlKey && !metaKey && !altKey) {
    if (key === 'Tab') direction = shiftKey ? -1 : 1
    else if (!isMac && !shiftKey && key === 'PageDown') direction = 1
    else if (!isMac && !shiftKey && key === 'PageUp') direction = -1
  }
  if (isMac && metaKey && altKey && !ctrlKey && !shiftKey) {
    if (key === 'ArrowRight') direction = 1
    else if (key === 'ArrowLeft') direction = -1
  }
  if (direction) {
    return activeIndex < 0 ? (direction > 0 ? 0 : count - 1) : (activeIndex + direction + count) % count
  }

  const matchesNumberModifier = isMac ? metaKey && !ctrlKey : ctrlKey && !metaKey
  if (matchesNumberModifier && !altKey && !shiftKey && /^[1-9]$/.test(key)) {
    return key === '9' ? count - 1 : Number(key) - 1
  }
  return null
}

export function useWorkspaceTabShortcuts({
  tabs,
  activeKey,
  onActivateHome,
  onActivateSession
}: {
  tabs: readonly OrderedTabEntry[]
  activeKey: string | null
  onActivateHome(id: string): void
  onActivateSession(id: string): void
}) {
  useEffect(() => {
    if (!tabs.length) return
    const isMac = window.fileterm?.platform === 'darwin'
    let activeIndex = tabs.findIndex((entry) => entry.key === activeKey)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || document.querySelector('[aria-modal="true"]')) return
      const index = targetTabIndex(event, isMac, activeIndex, tabs.length)
      if (index === null) return

      // Capture before xterm so tab navigation never reaches the remote shell.
      event.preventDefault()
      event.stopPropagation()
      const entry = tabs[index]
      if (!entry || index === activeIndex) return
      activeIndex = index
      if (entry.kind === 'local') onActivateHome(entry.id)
      else onActivateSession(entry.tab.id)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [tabs, activeKey, onActivateHome, onActivateSession])
}
