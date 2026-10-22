import type { Terminal } from '@xterm/xterm'

type UpdateCell = (x: number, y: number, code: number | undefined, bg: number, fg: number, ...rest: unknown[]) => void
type GlyphRenderer = {
  _vertices: { attributes: Float32Array }
  updateCell: UpdateCell
}
type Renderer = {
  _glyphRenderer: { value: GlyphRenderer }
  dimensions: { css: { cell: { height: number } }; device: { char: { height: number; top: number } } }
}

/** Match the DOM line box without changing atlas dimensions or allocating glyph phase variants. */
export function createWebglTextBaseline(terminal: Terminal) {
  const document = terminal.element!.ownerDocument
  let current: GlyphRenderer | undefined
  let original: UpdateCell | undefined
  let wrapper: UpdateCell | undefined
  let offsets = [0, 0, 0, 0]
  let key = ''
  const invalidate = () => {
    key = ''
  }
  document.fonts.addEventListener('loadingdone', invalidate)

  const restore = () => {
    if (current && current.updateCell === wrapper) current.updateCell = original!
  }
  return {
    refresh(value: unknown) {
      const renderer = value as Renderer
      const glyph = renderer._glyphRenderer.value
      // shortcut: xterm 6 / addon-webgl 0.19 vertex layout and style flags; recheck on upgrade.
      if (typeof glyph.updateCell !== 'function' || !ArrayBuffer.isView(glyph._vertices?.attributes))
        throw new Error('Unsupported xterm WebGL text baseline')
      if (current !== glyph) {
        restore()
        current = glyph
        original = glyph.updateCell
        const update = original
        wrapper = function (this: GlyphRenderer, x, y, code, bg, fg, ...rest) {
          update.call(this, x, y, code, bg, fg, ...rest)
          // shortcut: calibrate ASCII; retain fallback-font placement until mixed-script pixel comparisons pass.
          if (!code || code > 0x7f) return
          const style = (fg & 0x08000000 ? 1 : 0) | (bg & 0x04000000 ? 2 : 0)
          this._vertices.attributes[(y * terminal.cols + x) * 11 + 1] += offsets[style]
        }
        glyph.updateCell = wrapper
      }
      const dpr = document.defaultView!.devicePixelRatio
      const options = terminal.options
      const height = renderer.dimensions.css.cell.height
      const char = renderer.dimensions.device.char
      const nextKey = JSON.stringify([
        options.fontFamily,
        options.fontSize,
        options.fontWeight,
        options.fontWeightBold,
        dpr,
        height,
        char.height,
        char.top
      ])
      if (key === nextKey) return
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')
      if (!context) return
      const host = document.createElement('div')
      host.setAttribute('aria-hidden', 'true')
      host.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none'
      const markers = [0, 1, 2, 3].map((style) => {
        const row = document.createElement('div')
        row.style.cssText = 'position:absolute;left:0;top:0;white-space:pre'
        row.style.fontFamily = options.fontFamily!
        row.style.fontSize = `${options.fontSize}px`
        row.style.fontWeight = String(style & 1 ? options.fontWeightBold : options.fontWeight)
        row.style.fontStyle = style & 2 ? 'italic' : 'normal'
        row.style.height = row.style.lineHeight = `${height}px`
        const span = document.createElement('span')
        span.style.cssText = 'display:inline-block;height:100%;vertical-align:top'
        const marker = document.createElement('span')
        marker.style.cssText = 'display:inline-block;width:0;height:0'
        span.append(document.createTextNode('W'), marker)
        row.append(span)
        host.append(row)
        return marker
      })
      document.body.append(host)
      try {
        offsets = markers.map((marker, style) => {
          context.font = `${style & 2 ? 'italic' : 'normal'} ${style & 1 ? options.fontWeightBold : options.fontWeight} ${options.fontSize! * dpr}px ${options.fontFamily}`
          context.textBaseline = 'ideographic'
          const descent = context.measureText('W').alphabeticBaseline
          if (!Number.isFinite(descent)) return 0
          return Math.round(marker.getBoundingClientRect().top * dpr + descent - char.height - char.top)
        })
        key = nextKey
      } finally {
        host.remove()
      }
    },
    dispose() {
      restore()
      document.fonts.removeEventListener('loadingdone', invalidate)
    }
  }
}
