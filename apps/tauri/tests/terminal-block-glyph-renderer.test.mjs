import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const ROWS = 4
const COLS = 80

/**
 * Drive the real adapter with xterm-like rows. DOM reads per row are counted so
 * the O(rows) text scan and per-row layout forced by the old filter regress.
 */
function render(codesByRow, dimensions) {
  const reads = { textContent: 0, querySelector: 0, rowBounds: 0, containerBounds: 0, screenBounds: 0 }

  const doc = {
    createTreeWalker: () => ({ nextNode: () => null }),
    createElement: () => ({ getContext: () => null }),
    defaultView: {
      getComputedStyle: () => ({
        backgroundColor: 'transparent',
        color: '#fff',
        getPropertyValue: () => '',
        getPropertyPriority: () => ''
      })
    }
  }

  class Element {
    constructor(text) {
      this._text = text
    }
    get textContent() {
      reads.textContent++
      return this._text
    }
    querySelector() {
      reads.querySelector++
      return null
    }
    querySelectorAll() {
      return []
    }
    getBoundingClientRect() {
      reads.rowBounds++
      return { top: 0, bottom: 17, width: 800, height: 17 }
    }
    get ownerDocument() {
      return doc
    }
  }

  const rows = codesByRow.map((_, index) => new Element(`row ${index}`))
  const screen = {
    querySelectorAll: () => [],
    getBoundingClientRect: () => {
      reads.screenBounds++
      return { top: 0, left: 0, width: 800, height: 17 * ROWS }
    }
  }
  const rowsElement = {
    children: rows,
    getBoundingClientRect: () => {
      reads.containerBounds++
      return { top: 0, bottom: 17 * ROWS, width: 800, height: 17 * ROWS }
    }
  }
  const terminal = {
    cols: COLS,
    rows: ROWS,
    element: {
      querySelector: (selector) =>
        selector === '.xterm-screen' ? screen : selector === '.xterm-rows' ? rowsElement : null,
      querySelectorAll: () => []
    },
    options: { drawBoldTextInBrightColors: true },
    buffer: {
      active: {
        viewportY: 0,
        getNullCell: () => ({}),
        getLine: (row) => {
          const codes = codesByRow[row]
          if (!codes) return undefined
          return {
            length: codes.length,
            getCell: (column) => {
              const code = codes[column] ?? 0x20
              return {
                getCode: () => code,
                isInverse: () => false,
                isFgRGB: () => false,
                isBgRGB: () => false,
                isFgPalette: () => true,
                isBgPalette: () => true,
                getFgColor: () => 7,
                getBgColor: () => 0,
                isBold: () => false,
                isDim: () => false
              }
            }
          }
        }
      }
    },
    _core: {
      _themeService: {
        colors: {
          foreground: { css: '#fff', rgba: 0xffffffff },
          background: { css: '#000', rgba: 0xff },
          ansi: Array.from({ length: 16 }, () => ({ css: '#fff', rgba: 0xffffffff }))
        }
      },
      ...(dimensions ? { _renderService: { dimensions: { css: dimensions } } } : {})
    },
    onRender: () => ({ dispose() {} })
  }

  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/renderer/xterm-adapters/terminal-block-glyph-renderer.ts', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
    ).outputText,
    {
      exports,
      window: { devicePixelRatio: 1 },
      NodeFilter: { SHOW_TEXT: 4 },
      HTMLElement: Element,
      require: (id) => {
        if (id === '../lib/renderer-work-log') return { trackRendererWork: (_phase, work) => work }
        if (id === './terminal-graphic-glyphs')
          return {
            drawTerminalGraphicGlyph() {},
            isGraphicGlyph: (code) => (code >= 0x2580 && code <= 0x259f) || (code >= 0x2500 && code <= 0x257f)
          }
        throw new Error(`unexpected require: ${id}`)
      }
    }
  )
  exports.registerTerminalBlockGlyphRenderer(terminal).dispose()
  return reads
}

const asciiRow = Array.from({ length: COLS }, () => 0x41)

test('plain ASCII rows are skipped without reading DOM text or per-row geometry', () => {
  const reads = render([asciiRow, asciiRow, asciiRow, asciiRow])
  assert.equal(reads.textContent, 0)
  assert.equal(reads.querySelector, 0)
  assert.equal(reads.rowBounds, 0)
  assert.equal(reads.containerBounds, 0)
})

test('graphic rows come from the buffer and share one container measurement', () => {
  const graphicRow = [...asciiRow]
  graphicRow[0] = 0x2500
  const reads = render([asciiRow, graphicRow, asciiRow, asciiRow])
  assert.equal(reads.textContent, 0, 'row filtering no longer reads DOM text')
  assert.equal(reads.querySelector, 0, 'row filtering no longer runs a per-row selector')
  assert.equal(reads.rowBounds, 0, 'row geometry is arithmetic, not a per-row layout read')
  assert.equal(reads.containerBounds, 1)
})

test('calibrated xterm metrics avoid every geometry read', () => {
  const graphicRow = [...asciiRow]
  graphicRow[0] = 0x2500
  const reads = render([asciiRow, graphicRow, asciiRow, asciiRow], {
    cell: { width: 10, height: 17 },
    canvas: { width: 800, height: 68 }
  })
  assert.equal(reads.screenBounds, 0, 'screen geometry comes from xterm, not layout')
  assert.equal(reads.containerBounds, 0, 'rows geometry comes from xterm, not layout')
  assert.equal(reads.rowBounds, 0)
})

test('invalid calibrated metrics fall back to one container measurement', () => {
  const graphicRow = [...asciiRow]
  graphicRow[0] = 0x2500
  const reads = render([asciiRow, graphicRow, asciiRow, asciiRow], {
    cell: { width: 0, height: 17 },
    canvas: { width: 800, height: 68 }
  })
  assert.equal(reads.containerBounds, 1)
  assert.equal(reads.rowBounds, 0)
})
