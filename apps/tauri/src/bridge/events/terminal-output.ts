import type { TerminalDataPayload } from '@fileterm/core'

export type TerminalOutputDelivery = TerminalDataPayload & { deliveryId?: number; skippedBytesBefore?: number }
export type TerminalOutputListener = (payload: TerminalDataPayload) => void | Promise<void>

/** Release native credit only after every matching terminal finishes parsing. */
export function createTerminalOutputDelivery(
  listeners: Set<TerminalOutputListener>,
  acknowledge: (deliveryId: number) => Promise<void>,
  diagnostic: (message: string) => void
) {
  let pendingCharacters = 0
  let pendingBatches = 0
  let lastReport = -Infinity
  return (payload: TerminalOutputDelivery) => {
    if (payload.skippedBytesBefore) {
      payload = {
        ...payload,
        chunk: `\x18\x1b[0m\r\n[FileTerm: window display skipped ${payload.skippedBytesBefore} bytes while busy; press Ctrl+L to redraw]\r\n${payload.chunk}`
      }
    }
    const started = performance.now()
    pendingCharacters += payload.chunk.length
    pendingBatches++
    void Promise.allSettled([...listeners].map((listener) => Promise.resolve().then(() => listener(payload))))
      .then((results) => {
        const elapsedMs = performance.now() - started
        const failed = results.some((result) => result.status === 'rejected')
        const now = performance.now()
        if ((failed || payload.skippedBytesBefore || elapsedMs >= 1000) && now - lastReport >= 30000) {
          lastReport = now
          diagnostic(
            JSON.stringify({
              event: 'terminal-output-parse',
              elapsedMs: Math.round(elapsedMs),
              pendingCharacters,
              pendingBatches,
              listenerCount: listeners.size,
              failed,
              skippedBytesBefore: payload.skippedBytesBefore
            })
          )
        }
      })
      .finally(() => {
        pendingCharacters -= payload.chunk.length
        pendingBatches--
        return payload.deliveryId === undefined ? undefined : acknowledge(payload.deliveryId)
      })
      .catch(() => undefined)
  }
}
