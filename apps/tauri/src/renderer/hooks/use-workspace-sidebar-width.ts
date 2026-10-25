import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SIDEBAR_WIDTH, retainOpenTabUiState } from '../app/app-shell-utils'

export function useWorkspaceSidebarWidth(
  activeTabId: string | null,
  sessionTabs: readonly { id: string }[],
  localTabs: readonly { id: string }[]
) {
  const [widths, setWidths] = useState<Record<string, number>>({})
  const activeSidebarWidth = activeTabId ? (widths[activeTabId] ?? DEFAULT_SIDEBAR_WIDTH) : DEFAULT_SIDEBAR_WIDTH
  const setActiveSidebarWidth = useCallback(
    (width: number) => {
      if (!activeTabId) return
      setWidths((current) => (current[activeTabId] === width ? current : { ...current, [activeTabId]: width }))
    },
    [activeTabId]
  )

  useEffect(() => {
    const openTabIds = new Set([...sessionTabs.map((tab) => tab.id), ...localTabs.map((tab) => tab.id)])
    setWidths((current) => retainOpenTabUiState(current, openTabIds))
  }, [sessionTabs, localTabs])

  return { activeSidebarWidth, setActiveSidebarWidth }
}
