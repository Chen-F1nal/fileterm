import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/renderer/xterm-adapters/terminal-webgl-grid.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports }
)
const { registerTerminalWebglGrid } = exports

test('fractional font measurements never replace the upstream integer atlas grid', () => {
  const gl = { drawingBufferWidth: 800, drawingBufferHeight: 600 }
  let resizes = 0
  let clears = 0
  const dimensions = { device: { char: { width: 8 }, cell: { width: 8 } } }
  const resize = (width, height) => {
    gl.drawingBufferWidth = width
    gl.drawingBufferHeight = height
  }
  const renderer = {
    _gl: gl,
    dimensions,
    _setCanvasDevicePixelDimensions: resize,
    _glyphRenderer: {
      value: {
        handleResize() {
          resizes++
        }
      }
    },
    _clearModel() {
      clears++
    },
    handleCharSizeChanged() {}
  }
  const adapter = registerTerminalWebglGrid({
    options: { letterSpacing: 0 },
    cols: 90,
    _core: {
      _charSizeService: { width: 6.59765625 },
      _coreBrowserService: { dpr: 1.25 },
      _renderService: { _renderer: { value: renderer } }
    }
  })
  assert.equal(dimensions.device.char.width, 8)
  assert.equal(dimensions.device.cell.width, 8)
  renderer._setCanvasDevicePixelDimensions(800, 600)
  assert.equal(resizes, 0)
  renderer._setCanvasDevicePixelDimensions(801, 600)
  assert.equal(resizes, 1)
  assert.equal(clears, 1)
  adapter.dispose()
  assert.equal(renderer._setCanvasDevicePixelDimensions, resize)
})

test('a failed initial WebGL resize restores the upstream method for DOM fallback', () => {
  const original = () => {}
  const failure = new Error('renderer resize failed')
  const renderer = {
    _gl: {},
    _updateDimensions: original,
    _setCanvasDevicePixelDimensions: original,
    _glyphRenderer: { value: { handleResize() {} } },
    _clearModel() {},
    handleCharSizeChanged() {
      throw failure
    },
    dimensions: { device: { char: {}, cell: {}, canvas: {} }, css: { cell: {}, canvas: {} } }
  }
  const measure = { width: 8.4 }
  const terminal = {
    _core: {
      _charSizeService: measure,
      _coreBrowserService: { dpr: 1.25 },
      _renderService: { _renderer: { value: renderer } }
    }
  }
  assert.throws(
    () => registerTerminalWebglGrid(terminal),
    (error) => error === failure
  )
  assert.equal(renderer._updateDimensions, original)
  assert.equal(renderer._setCanvasDevicePixelDimensions, original)
  assert.equal(measure.width, 8.4)
})

test('an unsupported renderer fails before installing a grid hook', () => {
  const renderer = { _updateDimensions() {} }
  const original = renderer._updateDimensions
  assert.throws(
    () => registerTerminalWebglGrid({ _core: { _renderService: { _renderer: { value: renderer } } } }),
    /Unsupported xterm WebGL grid/
  )
  assert.equal(renderer._updateDimensions, original)
})
