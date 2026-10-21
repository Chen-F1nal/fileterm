import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const atlasCache = {}
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/renderer/xterm-adapters/terminal-webgl-atlas-cache.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports: atlasCache }
)
const exports = {}
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/renderer/xterm-adapters/terminal-webgl-grid.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  {
    exports,
    require: (name) =>
      name === './terminal-webgl-atlas-cache' ? atlasCache : { registerWebglTextureSlots: () => ({ dispose() {} }) }
  }
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
    renderRows() {},
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
    renderRows() {},
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

test('clearing a shared atlas invalidates peers once and disposed or unrelated terminals are left alone', () => {
  const shared = {}
  const makeTerminal = (atlas) => {
    let clears = 0
    let redraws = 0
    const originalClear = () => {
      clears++
    }
    const renderer = {
      _gl: {},
      _charAtlas: atlas,
      _setCanvasDevicePixelDimensions() {},
      _glyphRenderer: { value: { handleResize() {} } },
      _clearModel() {
        clears++
      },
      renderRows() {},
      handleCharSizeChanged() {}
    }
    const terminal = {
      rows: 24,
      clearTextureAtlas: originalClear,
      refresh(start, end) {
        assert.equal(start, 0)
        assert.equal(end, 23)
        redraws++
      },
      _core: { _renderService: { _renderer: { value: renderer } } }
    }
    return {
      terminal,
      originalClear,
      renderer,
      adapter: registerTerminalWebglGrid(terminal),
      counts: () => ({ clears, redraws })
    }
  }
  const first = makeTerminal(shared)
  const second = makeTerminal(shared)
  const third = makeTerminal({})
  first.terminal.clearTextureAtlas()
  assert.deepEqual(first.counts(), { clears: 1, redraws: 0 })
  assert.deepEqual(second.counts(), { clears: 1, redraws: 1 })
  assert.deepEqual(third.counts(), { clears: 0, redraws: 0 })
  second.adapter.dispose()
  assert.equal(second.terminal.clearTextureAtlas, second.originalClear)
  first.terminal.clearTextureAtlas()
  assert.deepEqual(second.counts(), { clears: 1, redraws: 1 })
  third.renderer._charAtlas = shared
  first.terminal.clearTextureAtlas()
  assert.deepEqual(third.counts(), { clears: 1, redraws: 1 }, 'font changes can switch which atlas is shared')
  first.adapter.dispose()
  third.adapter.dispose()
  assert.equal(first.terminal.clearTextureAtlas, first.originalClear)
})

test('atlas reset releases old glyphs, reuses merged pages, and allows a reused cache to fill before resetting again', () => {
  const page = (size) => ({
    canvas: { width: size, height: size },
    _glyphs: [{}],
    _usedPixels: size * size,
    clear() {
      this.clears = (this.clears || 0) + 1
    }
  })
  const small = page(512),
    merged = page(4096),
    overflow = page(512)
  const atlas = {
    pages: [merged, small, overflow],
    _activePages: [small],
    _overflowSizePage: overflow,
    _cacheMap: new Map([['old', {}]]),
    _cacheMapCombined: new Map([['old', {}]]),
    _didWarmUp: true,
    _requestClearModel: false
  }
  const budget = 32 * 1024 * 1024
  assert.equal(atlasCache.isWebglAtlasCacheFull(atlas, budget), true)
  merged._usedPixels = 100
  merged.currentRow = { y: 3000, height: 20 }
  assert.equal(
    atlasCache.isWebglAtlasCacheFull(atlas, budget),
    true,
    'packing rows consume space even when glyph bounding boxes are sparse'
  )
  delete merged.currentRow
  for (let i = 0; i < 100; i++) {
    assert.equal(atlasCache.resetWebglAtlasCache(atlas), true)
    assert.equal(merged._glyphs.length, 0)
    merged._glyphs.push({})
    merged._usedPixels = 100
  }
  assert.equal(merged._glyphs.length, 1)
  assert.equal(atlas._cacheMap.size, 0)
  assert.equal(atlas._cacheMapCombined.size, 0)
  assert.equal(atlas._activePages.length, 2)
  assert.equal(atlas._activePages[0], merged)
  assert.equal(atlas._activePages[1], small)
  assert.equal(atlas._didWarmUp, false)
  assert.equal(atlas._requestClearModel, false)
  assert.equal(
    atlasCache.isWebglAtlasCacheFull(atlas, budget),
    false,
    'retained backing pages must not trigger clearing on every frame'
  )
  assert.equal(atlasCache.isWebglAtlasCacheFull(undefined, budget), false)
  const unknown = { pages: [{}] }
  assert.equal(atlasCache.resetWebglAtlasCache(unknown), false)
})

test('rendering recycles an oversized RGB cache before drawing without repeatedly clearing retained backing pages', () => {
  const page = { canvas: { width: 4096, height: 4096 }, _glyphs: [{}], _usedPixels: 4096 * 4096, clear() {} }
  const atlas = {
    pages: [page],
    _activePages: [page],
    _cacheMap: new Map(),
    _cacheMapCombined: new Map(),
    _didWarmUp: true,
    _requestClearModel: false
  }
  let clears = 0,
    renders = 0
  const ranges = []
  const original = (start, end) => {
    ranges.push([start, end])
    renders++
    page._glyphs.push({})
    page._usedPixels += 100
  }
  const renderer = {
    _gl: { canvas: { width: 900, height: 600 } },
    _charAtlas: atlas,
    _setCanvasDevicePixelDimensions() {},
    _glyphRenderer: { value: { handleResize() {} } },
    _clearModel() {},
    handleCharSizeChanged() {},
    renderRows: original
  }
  const terminal = {
    rows: 24,
    clearTextureAtlas() {
      clears++
    },
    refresh() {},
    _core: { _renderService: { _renderer: { value: renderer } } }
  }
  const adapter = registerTerminalWebglGrid(terminal)
  renderer.renderRows(8, 8)
  assert.deepEqual(ranges[0], [0, 23])
  assert.equal(clears, 1)
  assert.equal(page._glyphs.length, 1)
  renderer.renderRows(0, 23)
  assert.equal(clears, 1)
  assert.equal(renders, 2)
  const largeRenderer = { ...renderer, _gl: { canvas: { width: 5000, height: 3000 } } }
  const largeTerminal = { ...terminal, _core: { _renderService: { _renderer: { value: largeRenderer } } } }
  const largeAdapter = registerTerminalWebglGrid(largeTerminal)
  page._usedPixels = 4096 * 4096
  renderer.renderRows(0, 23)
  assert.equal(clears, 1, 'a small terminal must respect the shared atlas working set of its larger peer')
  largeAdapter.dispose()
  adapter.dispose()
  assert.equal(renderer.renderRows, original)
})
