type ScriptTiming = {
  duration: number
  forcedStyleAndLayoutDuration?: number
  sourceURL?: string
  sourceFunctionName?: string
  sourceCharPosition?: number
}
type FrameTiming = PerformanceEntry & {
  blockingDuration?: number
  renderStart?: number
  styleAndLayoutStart?: number
  scripts?: ScriptTiming[]
}

const milliseconds = (value = 0) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)

/** LoAF attribution is optional and is not a sampled CPU stack or a heap/GC trace. */
export function observeRendererFrames(onSlowFrame: () => void = () => {}) {
  const supported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')
  let count = 0
  let totalMs = 0
  let maxMs = 0
  const slowest: Array<{
    startedAtMs: number
    durationMs: number
    blockingMs: number
    renderToFrameEndMs: number | null
    layoutToFrameEndMs: number | null
    scriptCount: number
    attributionTruncated: boolean
    scripts: Array<{
      durationMs: number
      forcedStyleAndLayoutMs: number
      bundle?: string
      functionName?: string
      sourceCharPosition?: number
    }>
  }> = []
  const observer = supported
    ? new PerformanceObserver((list) => {
        if (document.hidden) return
        let hasSlowFrame = false
        for (const entry of list.getEntries() as FrameTiming[]) {
          const duration = milliseconds(entry.duration)
          count++
          totalMs += duration
          maxMs = Math.max(maxMs, duration)
          hasSlowFrame ||= duration >= 1000
          const scripts = (entry.scripts ?? []).slice(0, 64).map((script) => {
            let source: { bundle?: string; functionName?: string; sourceCharPosition?: number } = {}
            try {
              const base = new URL(window.location.href)
              const url = new URL(script.sourceURL ?? '', base)
              const bundle = /^\/assets\/([\w-]{1,100}\.js)$/.exec(url.pathname)?.[1]
              if (
                /^(https?:|tauri:)$/.test(url.protocol) &&
                url.protocol === base.protocol &&
                url.host === base.host &&
                url.origin === base.origin &&
                bundle
              ) {
                source = {
                  bundle,
                  functionName: /^[\w.$<> -]{1,80}$/.test(script.sourceFunctionName ?? '')
                    ? script.sourceFunctionName
                    : undefined,
                  sourceCharPosition:
                    Number.isSafeInteger(script.sourceCharPosition) && script.sourceCharPosition! >= 0
                      ? script.sourceCharPosition
                      : undefined
                }
              }
            } catch {
              // Invalid, external, dev-source and non-asset URLs are never copied into logs.
            }
            return {
              durationMs: milliseconds(script.duration),
              forcedStyleAndLayoutMs: milliseconds(script.forcedStyleAndLayoutDuration),
              ...source
            }
          })
          scripts.sort((left, right) => right.durationMs - left.durationMs)
          slowest.push({
            startedAtMs: milliseconds(entry.startTime),
            durationMs: duration,
            blockingMs: milliseconds(entry.blockingDuration),
            renderToFrameEndMs: entry.renderStart
              ? milliseconds(entry.startTime + entry.duration - entry.renderStart)
              : null,
            layoutToFrameEndMs: entry.styleAndLayoutStart
              ? milliseconds(entry.startTime + entry.duration - entry.styleAndLayoutStart)
              : null,
            scriptCount: entry.scripts?.length ?? 0,
            attributionTruncated: (entry.scripts?.length ?? 0) > 3,
            scripts: scripts.slice(0, 3)
          })
          slowest.sort((left, right) => right.durationMs - left.durationMs)
          if (slowest.length > 4) slowest.pop()
        }
        if (hasSlowFrame) onSlowFrame()
      })
    : null
  // Advertising an entry type does not guarantee that this WebView can observe it.
  let available = supported
  try {
    observer?.observe({ type: 'long-animation-frame' })
  } catch {
    available = false
    observer?.disconnect()
  }
  return {
    snapshot: () => ({ supported: available, count, totalMs, maxMs, slowest: [...slowest] }),
    reset: () => {
      count = totalMs = maxMs = 0
      slowest.length = 0
    },
    dispose: () => observer?.disconnect()
  }
}
