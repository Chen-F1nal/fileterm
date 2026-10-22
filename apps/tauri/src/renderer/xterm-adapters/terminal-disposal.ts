import type { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal } from '@xterm/xterm'

export type WebglAddonRuntime = WebglAddon & {
  _renderer?: {
    _cursorBlinkStateManager?: { dispose(): void }
    _contextRestorationTimeout?: number
    _gl?: WebGL2RenderingContext
  }
}

export function releaseWebglAddon(addon: WebglAddonRuntime) {
  const renderer = addon._renderer
  const gl = renderer?._gl
  if (renderer?._contextRestorationTimeout !== undefined) {
    clearTimeout(renderer._contextRestorationTimeout)
    renderer._contextRestorationTimeout = undefined
  }
  try {
    // shortcut: addon-webgl 0.19 omits this timer from its dispose store; remove after the upstream fix ships.
    renderer?._cursorBlinkStateManager?.dispose()
  } finally {
    try {
      addon.dispose()
    } finally {
      // shortcut: addon-webgl 0.19.0 retains context after dispose; remove when upstream releases it explicitly.
      try {
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // The context may already be lost by the time the fallback runs.
      }
    }
  }
}

export function disposeTerminal(terminal: Terminal) {
  // shortcut: xterm 6.0 does not dispose its hidden-resize idle queue; remove after the upstream fix ships.
  const queue = (
    terminal as Terminal & {
      _core?: { _renderService?: { _pausedResizeTask?: { _queue?: { clear(): void } } } }
    }
  )._core?._renderService?._pausedResizeTask?._queue
  try {
    terminal.dispose()
  } finally {
    // Never flush a deferred resize against an already disposed renderer.
    if (typeof queue?.clear === 'function') queue.clear()
  }
}
