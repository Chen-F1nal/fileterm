export type FilePaneMode = 'local' | 'remote-tree'

const STORAGE_KEY = 'file-panel.left-pane-mode'
let snapshot: { mode: FilePaneMode; error: string | null } = { mode: 'local', error: null }
let revision = 0
let loaded = false
let writes = Promise.resolve()
const listeners = new Set<() => void>()

function publish(mode: FilePaneMode, error: string | null) {
  snapshot = { mode, error }
  listeners.forEach((listener) => listener())
}

export const getFilePaneMode = () => snapshot

export function subscribeFilePaneMode(listener: () => void) {
  listeners.add(listener)
  if (!loaded) {
    loaded = true
    const initialRevision = revision
    void window.fileterm?.getUiStateItem(STORAGE_KEY).then(
      (value) => {
        if (revision === initialRevision && (value === 'local' || value === 'remote-tree')) publish(value, null)
      },
      (error: unknown) => {
        if (revision === initialRevision) publish(snapshot.mode, String(error))
      }
    )
  }
  return () => {
    listeners.delete(listener)
  }
}

export function setFilePaneMode(mode: FilePaneMode) {
  revision += 1
  const savedRevision = revision
  publish(mode, null)
  // Serialize writes so rapid toggles persist the last selected mode.
  writes = writes.then(async () => {
    try {
      await window.fileterm?.setUiStateItem(STORAGE_KEY, mode)
    } catch (error) {
      if (revision === savedRevision) publish(snapshot.mode, String(error))
    }
  })
}
