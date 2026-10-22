import type { IDisposable, Terminal } from '@xterm/xterm'
import { isWebglAtlasCacheFull, resetWebglAtlasCache } from './terminal-webgl-atlas-cache'
import { registerWebglTextureSlots } from './terminal-webgl-textures'
import { registerWebglGraphicGlyphs } from './terminal-webgl-graphic-glyphs'
import { createWebglTextBaseline } from './terminal-webgl-text-baseline'
import { createWebglDisplayGrid } from './terminal-webgl-display-grid'

type WebglGridRenderer = {
  _gl?: WebGL2RenderingContext
  _charAtlas?: object
  _setCanvasDevicePixelDimensions(width: number, height: number): void
  _glyphRenderer: { value: { handleResize(): void } }
  _clearModel(clearGlyphRenderer: boolean): void
  renderRows(start: number, end: number): void
  handleCharSizeChanged(): void
}
type GridTerminal = {
  _core?: {
    _renderService?: { _renderer?: { value?: WebglGridRenderer } }
    _themeService?: { colors: { background: { rgba: number } } }
  }
}

const webglTerminals = new Set<{ terminal: Terminal; renderer: WebglGridRenderer }>()

/** Align display and shared glyph coordinates while retaining integer atlas raster bounds. */
export function registerTerminalWebglGrid(terminal: Terminal): IDisposable {
  const core = (terminal as unknown as GridTerminal)._core
  const renderer = core?._renderService?._renderer?.value
  if (
    !renderer?._gl ||
    typeof renderer.handleCharSizeChanged !== 'function' ||
    typeof renderer._setCanvasDevicePixelDimensions !== 'function' ||
    typeof renderer._glyphRenderer?.value?.handleResize !== 'function' ||
    typeof renderer._clearModel !== 'function' ||
    typeof renderer.renderRows !== 'function'
  ) {
    throw new Error('Unsupported xterm WebGL grid; use DOM')
  }

  let textureGlyph = renderer._glyphRenderer.value
  let textures = registerWebglTextureSlots(renderer._gl, textureGlyph)
  let baseline: ReturnType<typeof createWebglTextBaseline> | undefined
  let displayGrid: ReturnType<typeof createWebglDisplayGrid>
  try {
    baseline = createWebglTextBaseline(terminal)
    displayGrid = createWebglDisplayGrid(terminal, renderer)
  } catch (error) {
    baseline?.dispose()
    textures.dispose()
    throw error
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
    registerWebglGraphicGlyphs(renderer._charAtlas)
    baseline.refresh(renderer)
    displayGrid.refresh()
  } catch (error) {
    renderer._setCanvasDevicePixelDimensions = originalBackingResize
    textures.dispose()
    displayGrid.dispose()
    baseline.dispose()
    throw error
  }

  const registration = { terminal, renderer }
  const originalClearAtlas = terminal.clearTextureAtlas
  const clearAtlas = function (this: Terminal) {
    const atlas = renderer._charAtlas
    resetWebglAtlasCache(atlas)
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
  const originalRender = renderer.renderRows
  const originalTransparency = terminal.options?.allowTransparency
  const render = function (this: WebglGridRenderer, start: number, end: number) {
    const gl = this._gl!
    const background = core?._themeService?.colors.background.rgba
    const transparent = typeof background === 'number' ? (background & 255) !== 255 : undefined
    // Opaque glyph canvases retain Windows subpixel antialiasing; transparent themes still need coverage alpha.
    if (transparent !== undefined && terminal.options.allowTransparency !== transparent) {
      terminal.options.allowTransparency = transparent
      this._clearModel(true)
      start = 0
      end = terminal.rows - 1
    }
    if (textureGlyph !== this._glyphRenderer.value) {
      displayGrid.releaseGlyph()
      textures.dispose()
      textureGlyph = this._glyphRenderer.value
      textures = registerWebglTextureSlots(gl, textureGlyph)
    }
    registerWebglGraphicGlyphs(this._charAtlas)
    baseline.refresh(this)
    displayGrid.refresh()
    // shortcut: addon-webgl 0.19 squares coverage alpha; remove when upstream uses separate alpha factors.
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // Historical RGB variants must not grow forever; keep room for four visible RGBA surfaces.
    let surfacePixels = gl.canvas.width * gl.canvas.height
    for (const peer of webglTerminals) {
      if (peer.renderer._charAtlas === this._charAtlas && peer.renderer._gl)
        surfacePixels = Math.max(surfacePixels, peer.renderer._gl.canvas.width * peer.renderer._gl.canvas.height)
    }
    const budget = Math.max(32 * 1024 * 1024, surfacePixels * 16)
    if (isWebglAtlasCacheFull(this._charAtlas, budget)) {
      terminal.clearTextureAtlas()
      start = 0
      end = terminal.rows - 1
    }
    // Multiple draws can happen before the browser clears a translucent drawing buffer.
    if (transparent) gl.clear(gl.COLOR_BUFFER_BIT)
    originalRender.call(this, start, end)
  }
  renderer.renderRows = render

  return {
    dispose() {
      textures.dispose()
      displayGrid.dispose()
      baseline.dispose()
      webglTerminals.delete(registration)
      if (renderer.renderRows === render) renderer.renderRows = originalRender
      if (terminal.clearTextureAtlas === clearAtlas) terminal.clearTextureAtlas = originalClearAtlas
      if (renderer._setCanvasDevicePixelDimensions === resizeBacking)
        renderer._setCanvasDevicePixelDimensions = originalBackingResize
      if (originalTransparency !== undefined) terminal.options.allowTransparency = originalTransparency
    }
  }
}
