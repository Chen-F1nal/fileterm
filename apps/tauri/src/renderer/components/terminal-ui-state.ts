import { trackRendererWork } from '../lib/renderer-work-log'
import type { TerminalLifecycleOptions } from './terminal-lifecycle-types'

type Setters = Pick<
  TerminalLifecycleOptions,
  'setHasSelection' | 'setFindMatchCount' | 'setActiveFindIndex' | 'setFindMiss' | 'findOpenRef'
>

/** xterm can emit during React commit; publish UI state outside that synchronous event chain. */
export function createTerminalUiState(setters: Setters) {
  let frame: number | undefined
  let disposed = false
  let selection: boolean | undefined
  let results: { resultIndex: number; resultCount: number } | undefined
  const publish = trackRendererWork('terminal-ui-publish', () => {
    frame = undefined
    if (disposed) return
    const nextSelection = selection
    const nextResults = results
    selection = undefined
    results = undefined
    if (nextSelection !== undefined) setters.setHasSelection(nextSelection)
    if (nextResults && setters.findOpenRef.current) {
      setters.setFindMatchCount(nextResults.resultCount)
      setters.setActiveFindIndex(nextResults.resultIndex)
      setters.setFindMiss(nextResults.resultCount === 0)
    }
  })
  const schedule = () => {
    if (!disposed && frame === undefined) frame = window.requestAnimationFrame(publish)
  }
  return {
    selection(value: boolean) {
      selection = value
      schedule()
    },
    search(value: { resultIndex: number; resultCount: number }) {
      results = { resultIndex: value.resultIndex, resultCount: value.resultCount }
      schedule()
    },
    dispose() {
      disposed = true
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      frame = undefined
      results = undefined
      selection = undefined
    }
  }
}
