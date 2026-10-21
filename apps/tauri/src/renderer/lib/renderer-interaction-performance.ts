/** Event Timing measures dispatch delay and time to the next paint, without input contents. */
const INTERACTION_EVENTS = new Set([
  'keydown',
  'click',
  'pointerdown',
  'pointerup',
  'beforeinput',
  'input',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'paste'
])

export function observeInteractionPerformance() {
  let samples = 0
  let maxInputDelayMs = 0
  let maxDurationMs = 0
  let maxInputDelayEventName: string | undefined
  let maxInputDelayStartedAtUnixMs: number | undefined
  let maxDurationEventName: string | undefined
  let maxDurationStartedAtUnixMs: number | undefined
  const supported =
    typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('event')
  const observer = supported
    ? new PerformanceObserver((list) => {
        if (document.hidden) return
        for (const entry of list.getEntries()) {
          if (!INTERACTION_EVENTS.has(entry.name)) continue
          const timing = entry as PerformanceEventTiming
          samples++
          const startedAtUnixMs = Number.isFinite(performance.timeOrigin)
            ? Math.round(performance.timeOrigin + timing.startTime)
            : undefined
          const inputDelayMs = timing.processingStart - timing.startTime
          if (inputDelayMs > maxInputDelayMs) {
            maxInputDelayMs = inputDelayMs
            maxInputDelayEventName = timing.name
            maxInputDelayStartedAtUnixMs = startedAtUnixMs
          }
          if (timing.duration > maxDurationMs) {
            maxDurationMs = timing.duration
            maxDurationEventName = timing.name
            maxDurationStartedAtUnixMs = startedAtUnixMs
          }
        }
      })
    : null
  observer?.observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)
  return {
    snapshot: () => ({
      supported,
      samples,
      maxInputDelayMs: supported ? Math.round(maxInputDelayMs) : undefined,
      maxInputDelayEventName: supported ? maxInputDelayEventName : undefined,
      maxInputDelayStartedAtUnixMs: supported ? maxInputDelayStartedAtUnixMs : undefined,
      maxDurationMs: supported ? Math.round(maxDurationMs) : undefined,
      maxDurationEventName: supported ? maxDurationEventName : undefined,
      maxDurationStartedAtUnixMs: supported ? maxDurationStartedAtUnixMs : undefined
    }),
    reset: () => {
      samples = maxInputDelayMs = maxDurationMs = 0
      maxInputDelayEventName = maxInputDelayStartedAtUnixMs = undefined
      maxDurationEventName = maxDurationStartedAtUnixMs = undefined
    },
    dispose: () => observer?.disconnect()
  }
}
