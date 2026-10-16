import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/renderer/xterm-adapters/terminal-log-colorizer.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }
  ).outputText,
  { exports, Uint32Array, Uint8Array }
)

test('unchanged palettes avoid history scans while real changes recolor and dispose restores ANSI', () => {
  const cell = {}
  let reads = 0
  const line = {
    length: 4,
    _data: new Uint32Array([105, 0, 0, 110, 0, 0, 102, 0, 0, 111, 0, 0]),
    getCell(column, target) {
      assert.equal(target, cell, 'reuse a cell instead of allocating one per column')
      target.getChars = () => String.fromCharCode(this._data[column * 3])
      return target
    }
  }
  const buffer = {
    type: 'normal',
    baseY: 0,
    cursorY: 0,
    viewportY: 0,
    length: 1,
    getNullCell: () => cell,
    getLine: () => {
      reads++
      return line
    }
  }
  const terminal = {
    buffer: { normal: buffer, active: buffer },
    rows: 1,
    write: (_, callback) => callback?.(),
    reset() {},
    clear() {},
    resize() {},
    refresh() {},
    registerMarker: () => ({ line: 0, isDisposed: false, dispose() {} })
  }
  const keys = [
    'timestamp',
    'service',
    'error',
    'warning',
    'success',
    'info',
    'debug',
    'address',
    'number',
    'permission',
    'flag'
  ]
  const palette = Object.fromEntries(keys.map((key) => [key, '#abc']))
  const colorizer = new exports.TerminalLogColorizer(terminal, palette)
  terminal.write('info')
  assert.equal(line._data[1], 0x03aabbcc)
  reads = 0
  for (let index = 0; index < 100; index++) colorizer.setPalette({ ...palette, info: '#aabbcc' })
  assert.equal(reads, 0)
  colorizer.setPalette({ ...palette, info: '#123456' })
  assert.ok(reads > 0)
  assert.equal(line._data[1], 0x03123456)
  colorizer.dispose()
  assert.equal(line._data[1], 0)
})
