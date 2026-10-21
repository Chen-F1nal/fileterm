import type { IDisposable, Terminal } from '@xterm/xterm'

type WebglGridRenderer = {
  _gl?: WebGL2RenderingContext
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

/** Keep WebGL backing resizes in sync without changing its integer raster grid. */
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

  return {
    dispose() {
      if (renderer._setCanvasDevicePixelDimensions === resizeBacking)
        renderer._setCanvasDevicePixelDimensions = originalBackingResize
    }
  }
}
