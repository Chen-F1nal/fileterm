import type { Terminal } from '@xterm/xterm'
import { isGraphicGlyph } from './terminal-graphic-glyphs'
import { setWebglGraphicCellSize } from './terminal-webgl-graphic-glyphs'

type Dimensions = {
  device: {
    char: { width: number; height: number; left: number; top: number }
    cell: { width: number; height: number }
    canvas: { width: number; height: number }
  }
  css: { cell: { width: number; height: number }; canvas: { width: number; height: number } }
}
type Glyph = {
  _atlas?: object
  _vertices: { attributes: Float32Array }
  updateCell(x: number, y: number, code: number | undefined, ...args: unknown[]): void
  _bindAtlasPageTexture(gl: WebGL2RenderingContext, ...args: unknown[]): void
}
type Layer = { resize(terminal: Terminal, dimensions: Dimensions): void }
type Rectangle = { _dimensions: Dimensions; setDimensions(dimensions: Dimensions): void; handleResize(): void }
type Renderer = {
  _gl: WebGL2RenderingContext
  _updateDimensions(): void
  dimensions: Dimensions
  _glyphRenderer: { value: Glyph }
  _rectangleRenderer: { value: Rectangle }
  _renderLayers: Layer[]
}

/** Project the DOM display grid while keeping all CPU atlas bounds integral. */
export function createWebglDisplayGrid(terminal: Terminal, value: unknown) {
  const renderer = value as Renderer
  const measure = (terminal as unknown as { _core: { _charSizeService: { width: number } } })._core._charSizeService
  if (typeof renderer._updateDimensions !== 'function' || !Array.isArray(renderer._renderLayers))
    throw new Error('Unsupported xterm WebGL display grid')
  const originalDimensions = renderer._updateDimensions
  const updateDimensions = function (this: Renderer) {
    originalDimensions.call(this)
    if (!measure.width || !terminal.cols || !terminal.rows) return
    const dpr = terminal.element!.ownerDocument.defaultView!.devicePixelRatio
    const d = this.dimensions
    d.css.canvas.width = Math.round(
      (measure.width + Math.round(terminal.options.letterSpacing ?? 0) / dpr) * terminal.cols
    )
    d.css.cell.width = d.css.canvas.width / terminal.cols
    d.css.cell.height = d.css.canvas.height / terminal.rows
    // Canvas projection may be fractional per cell; atlas scans still use the untouched integer cell/char bounds.
    d.device.canvas.width = Math.round(d.css.canvas.width * dpr)
    d.device.canvas.height = Math.round(d.css.canvas.height * dpr)
  }
  renderer._updateDimensions = updateDimensions
  const displayDimensions = (d: Dimensions): Dimensions => ({
    ...d,
    device: {
      ...d.device,
      canvas: { ...d.device.canvas },
      cell: { width: d.device.canvas.width / terminal.cols, height: d.device.canvas.height / terminal.rows }
    }
  })
  const layers = renderer._renderLayers.map((layer) => {
    const original = layer.resize
    const resize = function (this: Layer, terminal: Terminal, dimensions: Dimensions) {
      original.call(this, terminal, displayDimensions(dimensions))
    }
    layer.resize = resize
    return { layer, original, resize }
  })
  let glyph: Glyph | undefined
  let update: Glyph['updateCell'] | undefined
  let bind: Glyph['_bindAtlasPageTexture'] | undefined
  let wrappedUpdate: Glyph['updateCell'] | undefined
  let wrappedBind: Glyph['_bindAtlasPageTexture'] | undefined
  let rectangles: Dimensions | undefined
  const cell = { width: 0, height: 0 }
  const restoreGlyph = () => {
    if (glyph && glyph.updateCell === wrappedUpdate) glyph!.updateCell = update!
    if (glyph && glyph._bindAtlasPageTexture === wrappedBind) glyph!._bindAtlasPageTexture = bind!
  }
  return {
    releaseGlyph() {
      restoreGlyph()
      glyph = undefined
    },
    refresh() {
      const gl = renderer._gl
      const d = renderer.dimensions
      if (!gl.canvas.width || !gl.canvas.height) return
      d.device.canvas.width = gl.canvas.width
      d.device.canvas.height = gl.canvas.height
      const rectangle = renderer._rectangleRenderer.value
      if (
        !rectangles ||
        rectangle._dimensions !== rectangles ||
        rectangles.device.canvas.width !== gl.canvas.width ||
        rectangles.device.canvas.height !== gl.canvas.height ||
        rectangles.device.cell.width !== gl.canvas.width / terminal.cols ||
        rectangles.device.cell.height !== gl.canvas.height / terminal.rows
      ) {
        rectangles = displayDimensions(d)
        rectangle.setDimensions(rectangles)
        rectangle.handleResize()
      }
      const next = renderer._glyphRenderer.value
      if (glyph === next) return
      restoreGlyph()
      glyph = next
      update = next.updateCell
      bind = next._bindAtlasPageTexture
      const originalUpdate = update
      const originalBind = bind
      if (typeof update !== 'function' || typeof bind !== 'function')
        throw new Error('Unsupported xterm WebGL glyph projection')
      wrappedUpdate = function (this: Glyph, x, y, code, ...args) {
        if (!code || !isGraphicGlyph(code)) return originalUpdate.call(this, x, y, code, ...args)
        const dx = gl.canvas.width / terminal.cols
        const dy = gl.canvas.height / terminal.rows
        cell.width = Math.round((x + 1) * dx) - Math.round(x * dx)
        cell.height = Math.round((y + 1) * dy) - Math.round(y * dy)
        setWebglGraphicCellSize(this._atlas, cell)
        try {
          originalUpdate.call(this, x, y, code, ...args)
        } finally {
          setWebglGraphicCellSize(this._atlas)
        }
        const index = (y * terminal.cols + x) * 11
        const char = renderer.dimensions.device.char
        this._vertices.attributes[index] +=
          Math.round(x * dx) - x * dx + Math.floor((cell.width - char.width) / 2) - char.left
        this._vertices.attributes[index + 1] +=
          Math.round(y * dy) -
          y * dy +
          (terminal.options.lineHeight === 1 ? 0 : Math.round((cell.height - char.height) / 2)) -
          char.top
      }
      wrappedBind = function (this: Glyph, gl, ...args) {
        originalBind.call(this, gl, ...args)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      }
      next.updateCell = wrappedUpdate
      next._bindAtlasPageTexture = wrappedBind
    },
    dispose() {
      restoreGlyph()
      if (renderer._updateDimensions === updateDimensions) renderer._updateDimensions = originalDimensions
      for (const { layer, original, resize } of layers) if (layer.resize === resize) layer.resize = original
      renderer._rectangleRenderer.value.setDimensions(renderer.dimensions)
    }
  }
}
