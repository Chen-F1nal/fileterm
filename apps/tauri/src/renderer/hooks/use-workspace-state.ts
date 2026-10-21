import { useState, useSyncExternalStore, type SetStateAction } from 'react'
import type { WorkspaceSnapshot } from '@fileterm/core'

/** Reduce ordered IPC events once, even when React retries an interrupted render. */
export function useWorkspaceState(initial: WorkspaceSnapshot) {
  const [store] = useState(() => {
    let current = initial
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => current,
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      set(update: SetStateAction<WorkspaceSnapshot>) {
        const next = typeof update === 'function' ? update(current) : update
        if (Object.is(next, current)) return
        current = next
        for (const listener of listeners) listener()
      }
    }
  })
  return [useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot), store.set] as const
}
