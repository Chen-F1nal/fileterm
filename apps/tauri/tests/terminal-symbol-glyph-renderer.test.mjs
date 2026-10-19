import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function fixture(text) {
  let layoutReads = 0
  class Element {
    textContent = text
  }
  const rows = {
    children: [new Element()],
    ownerDocument: {
      defaultView: {
        HTMLElement: Element,
        MutationObserver: class {
          observe() {}
          takeRecords() {}
          disconnect() {}
        }
      },
      createElement: () => ({ getContext: () => ({}) })
    },
    getBoundingClientRect: () => {
      layoutReads++
      return { width: 800 }
    }
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL('../src/renderer/xterm-adapters/terminal-symbol-glyph-renderer.ts', import.meta.url),
        'utf8'
      ),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }
    ).outputText,
    {
      exports,
      require: () => ({ isBoxDrawingGlyph: (code) => code >= 0x2500 && code <= 0x257f })
    }
  )
  const registration = exports.registerTerminalSymbolGlyphRenderer({
    cols: 80,
    element: { querySelector: () => rows },
    buffer: { active: { getNullCell: () => ({}), getLine: () => undefined } },
    onRender: () => ({ dispose() {} })
  })
  registration.dispose()
  return layoutReads
}

test('graphical-only rows do not force layout in the font-symbol adapter', () => {
  for (const text of ['─'.repeat(200), '┼│━═▁█', '┃ result: ok ┃', '┃中文┃', 'plain ASCII!']) {
    assert.equal(fixture(text), 0, text)
  }
})

test('fallback symbols and CJK punctuation still enter the fitting path', () => {
  for (const text of ['✻', '┃中文:┃', '┃✓┃', '中文，。']) assert.equal(fixture(text), 1, text)
})
