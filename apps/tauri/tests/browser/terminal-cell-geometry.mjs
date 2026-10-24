/* global window, document, Node, NodeFilter, requestAnimationFrame */
/* Selection-geometry regression: every rendered character must sit on the cell grid.
 * Ranges are what browsers use for selection, so this covers the fitted slot/text
 * structure introduced for the symbol adapter.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './helpers/load-typescript.mjs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const source = new URL('../../src/renderer/xterm-adapters/', import.meta.url)

const LINE = 'abc ⚠▢ test 中文 ok ▫ xyz'
const TOLERANCE = 1

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
try {
  for (const [scale, fontSize] of [
    [1, 14],
    [1.25, 16],
    [2, 24]
  ]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: scale })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setContent('<main id="host"></main>')
    await page.addStyleTag({ path: root + 'node_modules/@xterm/xterm/css/xterm.css' })
    const font = readFileSync(
      root + 'apps/tauri/src/renderer/assets/fonts/text/jetbrains-mono/JetBrainsMono-400.ttf'
    ).toString('base64')
    await page.addStyleTag({ content: `@font-face{font-family:CellMono;src:url(data:font/ttf;base64,${font})}` })
    await page.evaluate(() => document.fonts.load('16px CellMono'))
    await page.addScriptTag({ path: root + 'node_modules/@xterm/xterm/lib/xterm.js' })
    for (const [file, symbol] of [
      ['terminal-symbol-glyph-renderer.ts', 'registerTerminalSymbolGlyphRenderer'],
      ['terminal-block-glyph-renderer.ts', 'registerTerminalBlockGlyphRenderer']
    ]) {
      await loadTypeScript(page, fileURLToPath(new URL(file, source)), symbol)
    }

    const report = await page.evaluate(
      async ({ line, fontSize }) => {
        const terminal = new window.Terminal({
          cols: 40,
          rows: 4,
          fontFamily: 'CellMono',
          fontSize,
          letterSpacing: 0,
          allowProposedApi: true,
          theme: { background: '#111', foreground: '#ddd' }
        })
        terminal.open(document.getElementById('host'))
        window.registerTerminalSymbolGlyphRenderer(terminal)
        window.registerTerminalBlockGlyphRenderer(terminal)
        await new Promise((resolve) => terminal.write('\x1b[?25l' + line, resolve))
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        const rowEl = terminal.element.querySelector('.xterm-rows').firstElementChild
        const cellWidth =
          terminal._core._renderService.dimensions.css.cell.width ||
          terminal.element.querySelector('.xterm-screen').getBoundingClientRect().width / terminal.cols
        const rowLeft = rowEl.getBoundingClientRect().left

        const bufferLine = terminal.buffer.active.getLine(0)
        const cells = []
        for (let column = 0; column < bufferLine.length; column++) {
          const cell = bufferLine.getCell(column)
          if (!cell || cell.getWidth() === 0) continue
          const text = cell.getChars() || ' '
          cells.push({ text, width: cell.getWidth() })
          if (cells.reduce((total, entry) => total + entry.text.length, 0) >= line.length) break
        }

        // DOM text in order, with the node and offset of every character.
        const positions = []
        const walker = document.createTreeWalker(rowEl, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          for (let offset = 0; offset < node.data.length; offset++) positions.push({ node, offset })
          node = walker.nextNode()
        }

        const rowText = positions
          .map((entry) => entry.node.data[entry.offset])
          .join('')
          .replaceAll('\u00a0', ' ')
        const deviations = []
        let consumed = 0
        let column = 0
        for (const cell of cells) {
          const start = consumed
          consumed += cell.text.length
          if (rowText.slice(start, start + cell.text.length) !== cell.text) {
            throw new Error(`DOM text does not match buffer cell ${JSON.stringify(cell.text)} at column ${column}`)
          }
          const first = positions[start]
          const last = positions[start + cell.text.length - 1]
          const range = document.createRange()
          range.setStart(first.node, first.offset)
          range.setEnd(last.node, last.offset + 1)
          const left = range.getBoundingClientRect().left
          deviations.push({
            text: cell.text,
            column,
            actual: left,
            expected: rowLeft + column * cellWidth
          })
          column += cell.width
        }

        return {
          cellWidth,
          bufferText: cells.map((cell) => cell.text).join(''),
          rowText: rowText.trimEnd(),
          deviations,
          spanCount: rowEl.querySelectorAll('span').length,
          textNodeCount: positions.length > 0 ? new Set(positions.map((entry) => entry.node)).size : 0,
          directTextNodes: [...rowEl.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE).length
        }
      },
      { line: LINE, fontSize }
    )

    assert.deepEqual(errors, [])
    assert.equal(report.bufferText, LINE, 'buffer cells must cover the complete fixture text')
    assert.equal(report.rowText, LINE, 'DOM text must match the complete fixture text')
    assert.equal(report.deviations.length, Array.from(LINE).length, 'the fixture must measure every cell')
    for (const entry of report.deviations) {
      assert.ok(
        Math.abs(entry.actual - entry.expected) <= TOLERANCE,
        `cell ${JSON.stringify(entry.text)} at column ${entry.column} is off the grid by ` +
          `${(entry.actual - entry.expected).toFixed(2)}px (scale ${scale}, ${fontSize}px)`
      )
    }
    console.log(
      JSON.stringify({
        scale,
        fontSize,
        cells: report.deviations.length,
        maxDeviation: Math.max(...report.deviations.map((entry) => Math.abs(entry.actual - entry.expected))).toFixed(2),
        spanCount: report.spanCount,
        textNodeCount: report.textNodeCount,
        directTextNodes: report.directTextNodes
      })
    )
    await page.close()
  }
} finally {
  await browser.close()
}
