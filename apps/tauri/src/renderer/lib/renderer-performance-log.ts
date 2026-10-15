import { DIAGNOSTIC_SCOPES, writeDiagnosticLog } from './diagnostic-log'

/** Detect recovered stalls without relying on an exception or animation frames. */
export function installRendererPerformanceLogging(): () => void {
  let previous = performance.now()
  const started = previous
  let lastReport = -Infinity
  let lastHealthReport = previous
  let maxEventLoopGapMs = 0
  let longTaskCount = 0
  let longTaskTotalMs = 0
  let maxLongTaskMs = 0
  const longTasks =
    typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver((list) => {
          if (document.hidden) return
          for (const entry of list.getEntries()) {
            longTaskCount++
            longTaskTotalMs += entry.duration
            maxLongTaskMs = Math.max(maxLongTaskMs, entry.duration)
          }
        })
      : null
  longTasks?.observe({ type: 'longtask' })
  const reset = () => {
    previous = performance.now()
    lastHealthReport = previous
    maxEventLoopGapMs = longTaskCount = longTaskTotalMs = maxLongTaskMs = 0
  }
  const timer = window.setInterval(() => {
    const now = performance.now()
    const elapsed = now - previous
    previous = now
    if (!document.hidden) maxEventLoopGapMs = Math.max(maxEventLoopGapMs, elapsed)
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
          terminalCount: document.querySelectorAll('.xterm').length,
          domNodeCount: document.getElementsByTagName('*').length,
          maxEventLoopGapMs: Math.round(maxEventLoopGapMs),
          longTaskCount: longTasks ? longTaskCount : undefined,
          longTaskTotalMs: longTasks ? Math.round(longTaskTotalMs) : undefined,
          maxLongTaskMs: longTasks ? Math.round(maxLongTaskMs) : undefined,
          version: window.fileterm?.appVersion,
          platform: window.fileterm?.platform
        })
      )
      maxEventLoopGapMs = longTaskCount = longTaskTotalMs = maxLongTaskMs = 0
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
    longTasks?.disconnect()
    document.removeEventListener('visibilitychange', reset)
  }
}
