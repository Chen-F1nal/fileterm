import { drawTerminalGraphicGlyph, isGraphicGlyph } from './terminal-graphic-glyphs'

type Atlas = {
  _config: {
    customGlyphs: boolean
    devicePixelRatio: number
    deviceCellWidth: number
    deviceCellHeight: number
    deviceCharHeight: number
  }
  _tmpCtx: CanvasRenderingContext2D
  _getFromCacheMap(map: GlyphCache, code: number | string, ...args: unknown[]): unknown
  _drawToCache(code: number | string, ...args: unknown[]): unknown
  _findGlyphBoundingBox(...args: unknown[]): unknown
}

type GlyphCache = {
  get(code: number | string, ...args: unknown[]): unknown
  set(code: number | string, ...args: unknown[]): void
}
type CellSize = { width: number; height: number }
const patched = new WeakMap<object, { cell?: CellSize }>()

export function setWebglGraphicCellSize(atlas: object | undefined, cell?: CellSize): void {
  const state = atlas && patched.get(atlas)
  if (state) state.cell = cell
}

/** Use the DOM renderer's cell geometry inside the existing WebGL atlas. */
export function registerWebglGraphicGlyphs(value: unknown): void {
  const atlas = value as Atlas | undefined
  if (!atlas || patched.has(atlas)) return
  // shortcut: addon-webgl 0.19 raster internals; recheck when upgrading the addon.
  if (
    typeof atlas._drawToCache !== 'function' ||
    typeof atlas._findGlyphBoundingBox !== 'function' ||
    typeof atlas._getFromCacheMap !== 'function' ||
    typeof atlas._tmpCtx?.fillText !== 'function' ||
    !atlas._config
  )
    throw new Error('Unsupported xterm WebGL graphic glyphs')

  let graphic: number | undefined
  const state: { cell?: CellSize } = {}
  const get = atlas._getFromCacheMap
  atlas._getFromCacheMap = function (map, code, ...args) {
    if (!state.cell || typeof code !== 'number' || !isGraphicGlyph(code)) return get.call(this, map, code, ...args)
    const key = `${code}:${state.cell.width}:${state.cell.height}`
    return get.call(
      this,
      { get: (_, ...keys) => map.get(key, ...keys), set: (_, ...keys) => map.set(key, ...keys) },
      code,
      ...args
    )
  }
  const draw = atlas._drawToCache
  const bounds = atlas._findGlyphBoundingBox
  const context = atlas._tmpCtx
  const fillText = context.fillText
  atlas._drawToCache = function (code, ...args) {
    if (typeof code !== 'number' || !isGraphicGlyph(code)) return draw.call(this, code, ...args)
    const custom = this._config.customGlyphs
    const width = this._config.deviceCellWidth
    const height = this._config.deviceCellHeight
    graphic = code
    this._config.customGlyphs = false
    if (state.cell) {
      this._config.deviceCellWidth = state.cell.width
      this._config.deviceCellHeight = state.cell.height
    }
    try {
      return draw.call(this, code, ...args)
    } finally {
      graphic = undefined
      this._config.customGlyphs = custom
      this._config.deviceCellWidth = width
      this._config.deviceCellHeight = height
    }
  }
  atlas._findGlyphBoundingBox = function (...args) {
    // Preserve upstream graphic offsets so line-height centering is applied exactly once.
    if (graphic !== undefined) args[4] = true
    return bounds.apply(this, args)
  }
  context.fillText = function (text, x, y, maxWidth) {
    if (graphic === undefined) {
      if (maxWidth === undefined) fillText.call(this, text, x, y)
      else fillText.call(this, text, x, y, maxWidth)
      return
    }
    const config = atlas._config
    this.save()
    try {
      this.translate(0, y - config.deviceCharHeight)
      drawTerminalGraphicGlyph(
        this,
        graphic,
        x,
        config.deviceCellWidth,
        config.deviceCellHeight,
        Math.max(Math.ceil(config.devicePixelRatio), Math.round(config.deviceCellHeight / 16))
      )
    } finally {
      this.restore()
    }
  }
  patched.set(atlas, state)
}
