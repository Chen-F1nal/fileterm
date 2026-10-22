export type TerminalInputWriteFailureHandler = (error: unknown) => void

const MAX_PENDING_BYTES = 1024 * 1024
const MAX_PENDING_MESSAGES = 4096
const CONTROL_RESERVE_BYTES = 1024
const encoder = new TextEncoder()
let pendingBytes = 0
let pendingMessages = 0

type PendingInput = {
  tabId: string
  data: string
  bytes: number
  onFailure?: TerminalInputWriteFailureHandler
  resolve(): void
}

function finishInput(input: PendingInput) {
  pendingBytes -= input.bytes
  pendingMessages--
  input.data = ''
  input.onFailure = undefined
  input.resolve()
}

/** Preserve key order across asynchronous Tauri invoke calls for one terminal. */
export function createTerminalInputWriteQueue(options: {
  getTabId(): string
  write(tabId: string, data: string): Promise<void> | undefined
  shouldStop?(): boolean
}) {
  let source: typeof options | null = options
  const pending: PendingInput[] = []
  let active: PendingInput | undefined
  let draining = false

  const drain = async () => {
    try {
      while (source && pending.length) {
        const input = pending.shift()!
        active = input
        try {
          if (!source.shouldStop?.()) await source.write(input.tabId, input.data)
        } catch (error) {
          try {
            if (source) input.onFailure?.(error)
          } catch {
            // A reporting callback must not stop subsequent inputs.
          }
        } finally {
          active = undefined
          finishInput(input)
        }
      }
    } finally {
      draining = false
    }
  }

  const write = (data: string, onFailure?: TerminalInputWriteFailureHandler) => {
    if (!source || !data) {
      return Promise.resolve()
    }

    const control = data.length <= 16 && Array.from(data).every((character) => character.charCodeAt(0) < 0x20)
    const limit = MAX_PENDING_BYTES + (control ? CONTROL_RESERVE_BYTES : 0)
    const bytes = data.length > limit ? data.length : encoder.encode(data).length
    if (pendingBytes + bytes > limit || pendingMessages >= MAX_PENDING_MESSAGES + (control ? 16 : 0)) {
      try {
        onFailure?.(new Error('Terminal input backlog full; input was not sent'))
      } catch {
        // A reporting callback must not reject the queue.
      }
      return Promise.resolve()
    }
    // Capture the destination along with the input event so a later render
    // cannot redirect queued characters to a different tab.
    const tabId = source.getTabId()
    pendingBytes += bytes
    pendingMessages++
    const completion = new Promise<void>((resolve) => {
      pending.push({ tabId, data, bytes, onFailure, resolve })
    })
    if (!draining) {
      draining = true
      void Promise.resolve().then(drain)
    }
    return completion
  }

  return {
    write,
    dispose() {
      source = null
      // Queued inputs have not reached IPC; a stalled active write must not retain them or their credit.
      pending.splice(0).forEach(finishInput)
      if (active) {
        active.data = ''
        active.onFailure = undefined
      }
    }
  }
}
