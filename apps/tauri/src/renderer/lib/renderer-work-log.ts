export type RendererWorkPhase =
  | 'xterm-parse'
  | 'xterm-render'
  | 'output-prepare'
  | 'log-coloring'
  | 'foreground-adapt'
  | 'symbol-layout'
  | 'block-layout'
  | 'selection-layout'

type WorkSummary = { calls: number; totalElapsedMs: number; maxElapsedMs: number }
const phases = new Map<RendererWorkPhase, WorkSummary>()
const recentSlowWork: Array<{ phase: RendererWorkPhase; startedAtMs: number; elapsedMs: number }> = []

/** Synchronous elapsed time, inclusive of nested callbacks; never terminal contents or CPU samples. */
export function trackRendererWork<Args extends unknown[], Result>(
  phase: RendererWorkPhase,
  work: (...args: Args) => Result
): (...args: Args) => Result {
  return function (this: unknown, ...args: Args): Result {
    const started = performance.now()
    try {
      return work.apply(this, args)
    } finally {
      const elapsed = performance.now() - started
      const summary = phases.get(phase) ?? { calls: 0, totalElapsedMs: 0, maxElapsedMs: 0 }
      summary.calls++
      summary.totalElapsedMs += elapsed
      summary.maxElapsedMs = Math.max(summary.maxElapsedMs, elapsed)
      phases.set(phase, summary)
      if (elapsed >= 16) {
        recentSlowWork.push({ phase, startedAtMs: Math.round(started), elapsedMs: Math.round(elapsed) })
        if (recentSlowWork.length > 6) recentSlowWork.shift()
      }
    }
  }
}

export function getRendererWorkSnapshot() {
  return {
    sampledAtMs: Math.round(performance.now()),
    timeOriginUnixMs: Number.isFinite(performance.timeOrigin) ? Math.round(performance.timeOrigin) : undefined,
    phases: Object.fromEntries(
      [...phases].map(([phase, summary]) => [
        phase,
        {
          calls: summary.calls,
          totalElapsedMs: Math.round(summary.totalElapsedMs),
          maxElapsedMs: Math.round(summary.maxElapsedMs)
        }
      ])
    ),
    recentSlowWork: [...recentSlowWork]
  }
}

export function resetRendererWork() {
  phases.clear()
  recentSlowWork.length = 0
}
