import { useEffect, useRef, useState } from 'react'
import type { FileTermDesktopApi, RemoteFileItem, SessionSnapshot } from '@fileterm/core'
import { withParentRow } from '../../app/app-utils'
import { t } from '../../i18n'

export function useTransferPane(
  api: FileTermDesktopApi | undefined,
  sessions: Record<string, SessionSnapshot>,
  initialTabId?: string,
  initialPath?: string
) {
  const [endpoint, setEndpoint] = useState(initialTabId ?? 'local')
  const [path, setPath] = useState(initialPath ?? '')
  const [draftPath, setDraftPath] = useState(initialPath ?? '')
  const [items, setItems] = useState<RemoteFileItem[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const loaded = useRef<{ endpoint: string; path: string } | null>(null)
  const failed = useRef<{ endpoint: string; path: string } | null>(null)
  const connected =
    endpoint === 'local' || Boolean(sessions[endpoint]?.connected && sessions[endpoint]?.fileAccessMode !== 'root')
  const load = async (nextPath: string, nextEndpoint = endpoint) => {
    const id = ++request.current
    setLoading(true)
    if (failed.current?.endpoint !== nextEndpoint || failed.current.path !== nextPath) setError(null)
    const refreshing = loaded.current?.endpoint === nextEndpoint && loaded.current.path === nextPath
    const draftAtStart = refreshing ? draftPath : nextPath
    if (!refreshing) {
      setDraftPath(nextPath)
      setSelected([])
      setItems([])
    }
    try {
      if (!api) throw new Error(t.fileTransferDesktopRequired)
      const snapshot =
        nextEndpoint === 'local'
          ? await api.listLocalDirectory(nextPath || undefined)
          : { path: nextPath || '/', items: await api.browseTransferDirectory(nextEndpoint, nextPath || '/') }
      if (id !== request.current) return
      const nextItems = withParentRow(
        snapshot.path,
        snapshot.items.filter((item) => item.name !== '..')
      )
      loaded.current = { endpoint: nextEndpoint, path: snapshot.path }
      failed.current = null
      setError(null)
      setItems(nextItems)
      const nextPaths = new Set(nextItems.map((item) => item.path))
      setSelected((current) => (refreshing ? current.filter((path) => nextPaths.has(path)) : []))
      setPath(snapshot.path)
      setDraftPath((current) => (refreshing || current !== draftAtStart ? current : snapshot.path))
    } catch (error) {
      if (id === request.current) {
        loaded.current = null
        failed.current = { endpoint: nextEndpoint, path: nextPath }
        setItems([])
        setSelected([])
        setError(String(error))
      }
    } finally {
      if (id === request.current) setLoading(false)
    }
  }
  useEffect(() => {
    if (connected) void load(path)
    else {
      request.current += 1
      loaded.current = null
      failed.current = null
      setItems([])
      setSelected([])
      setLoading(false)
      setError(t.fileTransferReconnect)
    }
    return () => {
      request.current += 1
    }
  }, [endpoint, connected])
  const chooseEndpoint = (value: string) => {
    if (value === endpoint) return
    request.current += 1
    loaded.current = null
    failed.current = null
    setError(null)
    const nextPath = value === 'local' ? '' : (sessions[value]?.remotePath ?? '/')
    setPath(nextPath)
    setDraftPath(nextPath)
    setItems([])
    setSelected([])
    setEndpoint(value)
  }
  return {
    endpoint,
    path,
    draftPath,
    setDraftPath,
    items,
    selected,
    setSelected,
    loading,
    connected,
    error,
    load,
    refresh: () => load(error ? draftPath : path),
    chooseEndpoint
  }
}
export type TransferPaneState = ReturnType<typeof useTransferPane>
