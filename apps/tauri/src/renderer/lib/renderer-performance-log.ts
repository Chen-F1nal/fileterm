import { DIAGNOSTIC_SCOPES, writeDiagnosticLog } from './diagnostic-log'

/** Detect recovered stalls without relying on an exception or animation frames. */
export function installRendererPerformanceLogging(): () => void {
  let previous = performance.now()
  const started = previous
  let lastReport = -Infinity
  let lastHealthReport = previous
  const reset = () => {
    previous = performance.now()
    lastHealthReport = previous
  }
  const timer = window.setInterval(() => {
    const now = performance.now()
    const elapsed = now - previous
    previous = now
    if (!document.hidden && now - lastHealthReport >= 60000) {
      lastHealthReport = now
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } })
        .memory
      const callbacks = (window as unknown as { __TAURI_INTERNALS__?: { callbacks?: Map<number, unknown> } })
        .__TAURI_INTERNALS__?.callbacks
      writeDiagnosticLog(
        'DEBUG',
        DIAGNOSTIC_SCOPES.performance,
        JSON.stringify({
          event: 'renderer-health',
          uptimeMs: Math.round(now - started),
          usedJSHeapBytes: memory?.usedJSHeapSize,
          totalJSHeapBytes: memory?.totalJSHeapSize,
          ipcCallbackCount: callbacks?.size,
          version: window.fileterm?.appVersion,
          platform: window.fileterm?.platform
        })
      )
    }
    if (document.hidden || elapsed < 4000 || now - lastReport < 30000) return
    lastReport = now
    writeDiagnosticLog(
      'WARN',
      DIAGNOSTIC_SCOPES.performance,
      JSON.stringify({
        event: 'event-loop-gap',
        elapsedMs: Math.round(elapsed),
        focused: document.hasFocus(),
        version: window.fileterm?.appVersion,
        platform: window.fileterm?.platform
      })
    )
  }, 1000)
  // Background timer throttling must not be reported as a foreground stall.
  document.addEventListener('visibilitychange', reset)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', reset)
  }
}
