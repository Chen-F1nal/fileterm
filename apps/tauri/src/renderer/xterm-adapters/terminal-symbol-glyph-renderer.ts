import { trackRendererWork } from '../lib/renderer-work-log'
import type { IBufferCell, IBufferLine, Terminal } from '@xterm/xterm'
import { isBoxDrawingGlyph } from './box-drawing'

const SOURCE_CLASS = 'xterm-fitted-symbol-source'
const SLOT_CLASS = 'xterm-fitted-symbol-slot'
const SLOT_RAISED_CLASS = 'xterm-fitted-symbol-slot-raised'
const SLOT_STYLE_ID = 'fileterm-fitted-symbol-styles'
// xterm injects `.xterm-dom-renderer-owner-N span:not(.xterm-bold){font-weight:normal}`,
// so these must outrank it: class + element inside `.xterm .xterm-rows`.
const SLOT_STYLE_TEXT = `.xterm .xterm-rows span.${SLOT_CLASS}{font-weight:inherit}.xterm .xterm-rows .${SLOT_RAISED_CLASS}{position:relative;z-index:2}`

/**
 * Slot decoration never changes per cell: the wrapper must keep the source's font
 * weight, and wide or scaled cells must paint above xterm's selection layer. One
 * injected sheet replaces three inline style writes per element.
 */
function ensureSlotStyles(document: Document) {
  if (document.getElementById(SLOT_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SLOT_STYLE_ID
  style.textContent = SLOT_STYLE_TEXT
  document.head.append(style)
}
type SourceStyle = { width: string; spacing: string; text: string }
type GlyphCell = { text: string; width: number }
type TerminalDimensions = {
  _core?: { _renderService?: { dimensions?: { css?: { cell?: { width?: number } } } } }
}

function mayHaveNonAsciiCodepoint(
  line: IBufferLine | undefined,
  columnCount: number,
  reusableCell: IBufferCell
): boolean {
  // An unavailable line cannot prove the row is ASCII; fall back to the DOM check.
  if (!line) return true
  for (let column = 0; column < Math.min(columnCount, line.length); column++) {
    if ((line.getCell(column, reusableCell)?.getCode() ?? 0) > 0x7f) return true
  }
  return false
}

/** DOM xterm fits a fallback glyph's advance with negative letter-spacing,
 * which does not shrink its ink. The next ANSI/selection span can then paint
 * over the right half. Fit overflowing symbols into their buffer cells before
 * any background is painted; keep the original text and cell columns intact.
 */
export function registerTerminalSymbolGlyphRenderer(terminal: Terminal) {
  const rows = terminal.element?.querySelector<HTMLElement>('.xterm-rows')
  const view = rows?.ownerDocument.defaultView
  const context = rows?.ownerDocument.createElement('canvas').getContext('2d')
  if (!rows || !view || !context) return { dispose() {} }
  ensureSlotStyles(rows.ownerDocument)
  const sources = new Map<HTMLElement, SourceStyle>()
  const metrics = new Map<string, { left: number; width: number }>()
  const fonts = new Map<string, string>()
  let fontOptions = ''
  const reusableCell = terminal.buffer.active.getNullCell()

  const collectRow = (row: HTMLElement, rowIndex: number, cellWidth: number, updates: Array<() => void>) => {
    const line = terminal.buffer.active.getLine(terminal.buffer.active.viewportY + rowIndex)
    if (!line || cellWidth <= 0) return
    let column = 0
    const children = Array.from(row.children)
    for (const source of children) {
      if (!(source instanceof view.HTMLElement)) continue
      const text = source.textContent ?? ''
      const cells: GlyphCell[] = []
      let offset = 0
      // Map DOM text back to buffer widths, including wide and combined cells.
      // Fail closed for a joiner/decorator that supplies different text.
      while (offset < text.length && column < line.length) {
        const cell = line.getCell(column++, reusableCell)!
        if (cell.getWidth() === 0) continue
        const chars = cell.isInvisible() ? ' ' : cell.getChars() || ' '
        if (text.slice(offset, offset + chars.length).replace(/\u00a0/g, ' ') !== chars.replace(/\u00a0/g, ' ')) return
        cells.push({ text: text.slice(offset, offset + chars.length), width: cell.getWidth() })
        offset += chars.length
      }
      if (offset !== text.length) return
      if (source.classList.contains(SOURCE_CLASS) || !/[\p{Symbol}\p{Punctuation}]/u.test(text)) continue
      // Block elements have their own cell-geometry renderer.
      if (/[\u2580-\u259f]/u.test(text)) continue
      const columns = cells.reduce((total, cell) => total + cell.width, 0)
      if (columns === 0) continue
      const fontKey = `${source.classList.contains('xterm-bold')};${source.classList.contains('xterm-italic')};${source.style.fontStyle};${source.style.fontWeight};${source.style.fontSize};${source.style.fontFamily}`
      let font = fonts.get(fontKey)
      if (!font) {
        const style = view.getComputedStyle(source)
        font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        fonts.set(fontKey, font)
      }
      context.font = font
      const fits = cells.map((cell) => {
        if (!/[\p{Symbol}\p{Punctuation}]/u.test(cell.text)) return undefined
        // Box drawing belongs to the cell-geometry renderer. Fitting only some
        // arms to font ink breaks the shared grid at corners and intersections.
        if (cell.text.length === 1 && isBoxDrawingGlyph(cell.text.codePointAt(0)!)) return undefined
        const key = `${font}\n${cell.text}`
        let ink = metrics.get(key)
        if (!ink) {
          const measured = context.measureText(cell.text)
          const left = -measured.actualBoundingBoxLeft
          ink = { left, width: measured.actualBoundingBoxRight - left }
          metrics.set(key, ink)
          if (metrics.size > 2048) metrics.clear()
        }
        // Even a subpixel overhang can contain an entire device-pixel edge on
        // Retina displays. Only tolerate floating-point measurement noise.
        return ink.left < -0.01 || ink.left + ink.width > cellWidth * cell.width + 0.01 ? ink : undefined
      })
      const hasSymbol = cells.some(
        (cell) =>
          /[\u0080-\u{10ffff}]/u.test(cell.text) &&
          /[\p{Symbol}\p{Punctuation}]/u.test(cell.text) &&
          !(cell.text.length === 1 && isBoxDrawingGlyph(cell.text.codePointAt(0)!))
      )
      // Fallback font advances can differ from xterm's repeated-glyph measurement even when ink fits.
      if (!fits.some(Boolean) && !hasSymbol) continue
      updates.push(() => {
        sources.set(source, { width: source.style.width, spacing: source.style.letterSpacing, text })
        source.classList.add(SOURCE_CLASS)
        source.style.width = `${cellWidth * columns}px`
        source.style.letterSpacing = '0px'
        const fragment = row.ownerDocument.createDocumentFragment()
        // Even ASCII advances can differ from the calibrated grid; keep every
        // cell in a fixed-width slot regardless of the configured letter spacing.
        cells.forEach((cell, index) => {
          const ink = fits[index]
          const slot = row.ownerDocument.createElement('span')
          const available = cellWidth * cell.width
          slot.className = ink || cell.width > 1 ? `${SLOT_CLASS} ${SLOT_RAISED_CLASS}` : SLOT_CLASS
          slot.textContent = cell.text
          slot.style.width = `${available}px`
          if (ink) {
            // Fit ink, not font side bearings; preserve circles/emoji proportions.
            // The slot is inline-block, so scaling it shrinks the glyph without a
            // second wrapper element per cell.
            const scale = Math.min(1, available / ink.width)
            const shift = Math.max(-ink.left * scale, Math.min(0, available - (ink.left + ink.width) * scale))
            slot.style.transformOrigin = 'left center'
            slot.style.transform = `translateX(${shift}px) scale(${scale})`
          }
          fragment.append(slot)
        })
        source.replaceChildren(fragment)
      })
    }
  }
  const renderRows = trackRendererWork('symbol-layout', (indexes: number[]) => {
    const options = `${terminal.options.fontFamily};${terminal.options.fontSize};${terminal.options.fontWeight};${terminal.options.fontWeightBold}`
    if (options !== fontOptions) {
      fontOptions = options
      fonts.clear()
    }
    for (const source of sources.keys()) if (!rows.contains(source)) sources.delete(source)
    const activeBuffer = terminal.buffer.active
    const affected = indexes.filter((index) => {
      const row = rows.children[index]
      // ASCII-only rows cannot hold a fallback symbol; skip the DOM text walk on
      // the common case before paying for textContent and its regexes.
      if (!mayHaveNonAsciiCodepoint(activeBuffer.getLine(activeBuffer.viewportY + index), terminal.cols, reusableCell))
        return false
      // Graphical cells are handled by the block adapter, not fallback-font fitting.
      const text = (row?.textContent ?? '').replace(/[\u2500-\u259f]/gu, '')
      return (
        row instanceof view.HTMLElement &&
        /[\u0080-\u{10ffff}]/u.test(text) &&
        /[\p{Symbol}\p{Punctuation}]/u.test(text) &&
        Array.from(row.children).some(
          (source) =>
            !source.classList.contains(SOURCE_CLASS) &&
            /[\p{Symbol}\p{Punctuation}]/u.test((source.textContent ?? '').replace(/[\u2500-\u259f]/gu, ''))
        )
      )
    })
    if (!affected.length) return
    // Reuse xterm's calibrated CSS grid; retain geometry fallback for unknown internals.
    const measuredWidth = (terminal as unknown as TerminalDimensions)._core?._renderService?.dimensions?.css?.cell
      ?.width
    const cellWidth =
      typeof measuredWidth === 'number' && Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : rows.getBoundingClientRect().width / terminal.cols
    const updates: Array<() => void> = []
    // Measure all affected rows before changing DOM, avoiding a layout flush per symbol.
    for (const index of affected) {
      const row = rows.children[index]
      if (row instanceof view.HTMLElement) collectRow(row, index, cellWidth, updates)
    }
    for (const update of updates) update()
    // Our wrappers are already fitted; observing them again only repeats the row scan.
    observer.takeRecords()
  })
  const render = (start = 0, end = rows.children.length - 1) =>
    renderRows(Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index))
  const subscription = terminal.onRender(({ start, end }) => render(start, end))
  const observer = new view.MutationObserver((records) => {
    const changed = new Set<HTMLElement>()
    for (const record of records) {
      // xterm replaces a row's direct children; nested mutations are our own
      // symbol/block wrappers and must not trigger a second full row scan.
      if (record.target instanceof view.HTMLElement && record.target.parentElement === rows) changed.add(record.target)
    }
    const children = Array.from(rows.children)
    const indexes = [...changed].map((row) => children.indexOf(row)).filter((index) => index >= 0)
    if (indexes.length) renderRows(indexes)
  })
  observer.observe(rows, { childList: true, subtree: true })
  render()
  return {
    dispose() {
      subscription.dispose()
      observer.disconnect()
      for (const [source, original] of sources) {
        source.textContent = original.text
        source.style.width = original.width
        source.style.letterSpacing = original.spacing
        source.classList.remove(SOURCE_CLASS)
      }
      sources.clear()
      metrics.clear()
      fonts.clear()
    }
  }
}
