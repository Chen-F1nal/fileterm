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
  const connected =
    endpoint === 'local' || Boolean(sessions[endpoint]?.connected && sessions[endpoint]?.fileAccessMode !== 'root')
  const load = async (nextPath: string, nextEndpoint = endpoint) => {
    const id = ++request.current
    setLoading(true)
    setError(null)
    setSelected([])
    setItems([])
    try {
      if (!api) throw new Error(t.fileTransferDesktopRequired)
      const snapshot =
        nextEndpoint === 'local'
          ? await api.listLocalDirectory(nextPath || undefined)
          : { path: nextPath || '/', items: await api.browseTransferDirectory(nextEndpoint, nextPath || '/') }
      if (id !== request.current) return
      setItems(
        withParentRow(
          snapshot.path,
          snapshot.items.filter((item) => item.name !== '..')
        )
      )
      setPath(snapshot.path)
      setDraftPath(snapshot.path)
    } catch (error) {
      if (id === request.current) {
        setItems([])
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
    setPath(value === 'local' ? '' : (sessions[value]?.remotePath ?? '/'))
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
    chooseEndpoint
  }
}
export type TransferPaneState = ReturnType<typeof useTransferPane>
