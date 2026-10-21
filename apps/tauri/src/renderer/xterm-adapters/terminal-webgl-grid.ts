import type { IDisposable, Terminal } from '@xterm/xterm'

type WebglGridRenderer = {
  _gl?: WebGL2RenderingContext
  _charAtlas?: object
  _setCanvasDevicePixelDimensions(width: number, height: number): void
  _glyphRenderer: { value: { handleResize(): void } }
  _clearModel(clearGlyphRenderer: boolean): void
  handleCharSizeChanged(): void
}
type GridTerminal = {
  _core?: {
    _renderService?: { _renderer?: { value?: WebglGridRenderer } }
  }
}

const webglTerminals = new Set<{ terminal: Terminal; renderer: WebglGridRenderer }>()

/** Keep backing resizes and shared glyph coordinates coherent without changing the raster grid. */
export function registerTerminalWebglGrid(terminal: Terminal): IDisposable {
  const core = (terminal as unknown as GridTerminal)._core
  const renderer = core?._renderService?._renderer?.value
  if (
    !renderer?._gl ||
    typeof renderer.handleCharSizeChanged !== 'function' ||
    typeof renderer._setCanvasDevicePixelDimensions !== 'function' ||
    typeof renderer._glyphRenderer?.value?.handleResize !== 'function' ||
    typeof renderer._clearModel !== 'function'
  ) {
    throw new Error('Unsupported xterm WebGL grid; use DOM')
  }

  // Keep upstream integer cell widths: fractional atlas bounds read invalid pixel indices.
  // shortcut: xterm 6 / addon-webgl 0.19 internals; recheck on either upgrade.
  const originalBackingResize = renderer._setCanvasDevicePixelDimensions
  const resizeBacking = function (this: WebglGridRenderer, width: number, height: number) {
    const gl = this._gl!
    const previousWidth = gl.drawingBufferWidth
    const previousHeight = gl.drawingBufferHeight
    originalBackingResize.call(this, width, height)
    if (gl.drawingBufferWidth !== previousWidth || gl.drawingBufferHeight !== previousHeight) {
      // ResizeObserver can change backing pixels after handleResize; update the viewport and glyph uniforms too.
      this._glyphRenderer.value.handleResize()
      this._clearModel(false)
    }
  }
  renderer._setCanvasDevicePixelDimensions = resizeBacking
  try {
    renderer.handleCharSizeChanged()
  } catch (error) {
    renderer._setCanvasDevicePixelDimensions = originalBackingResize
    throw error
  }

  const registration = { terminal, renderer }
  const originalClearAtlas = terminal.clearTextureAtlas
  const clearAtlas = function (this: Terminal) {
    const atlas = renderer._charAtlas
    originalClearAtlas.call(this)
    if (!atlas) return
    // xterm shares atlases but only invalidates the caller's cached glyph coordinates.
    for (const peer of webglTerminals) {
      if (peer !== registration && peer.renderer._charAtlas === atlas) {
        peer.renderer._clearModel(true)
        peer.terminal.refresh(0, Math.max(0, peer.terminal.rows - 1))
      }
    }
  }
  terminal.clearTextureAtlas = clearAtlas
  webglTerminals.add(registration)

  return {
    dispose() {
      webglTerminals.delete(registration)
      if (terminal.clearTextureAtlas === clearAtlas) terminal.clearTextureAtlas = originalClearAtlas
      if (renderer._setCanvasDevicePixelDimensions === resizeBacking)
        renderer._setCanvasDevicePixelDimensions = originalBackingResize
    }
  }
}
