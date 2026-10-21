/* global window, document, requestAnimationFrame, FontFace, NodeFilter */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadTypeScript } from './helpers/load-typescript.mjs'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'
import { registerComparisonGridCalibration, readComparisonGridMetrics } from './helpers/terminal-grid-calibration.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const archiveRoot = resolve(
  process.env.FILETERM_VALIDATION_ARCHIVE || join(root, '..', 'renderer-validation-archive', 'windows-2026-10-20')
)
const gridMode = process.env.FILETERM_GRID_MODE || 'comparison'
assert.ok(['comparison', 'production'].includes(gridMode), 'FILETERM_GRID_MODE must be comparison or production')
const webglBundle = resolve(root + 'node_modules/@xterm/addon-webgl/lib/addon-webgl.js')
const addonVersion = JSON.parse(readFileSync(resolve(dirname(webglBundle), '../package.json'))).version
assert.equal(addonVersion, '0.19.0')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  args: ['--enable-gpu']
})
const output = resolve(
  process.env.FILETERM_GRID_OUTPUT || join(archiveRoot, 'results', 'terminal-renderer-font-grid.json')
)
const screenshotDirectory = resolve(process.env.FILETERM_RENDERER_SCREENSHOT_DIR || join(archiveRoot, 'screenshots'))
const screenshot = resolve(
  process.env.FILETERM_GRID_SCREENSHOT || join(screenshotDirectory, 'terminal-renderer-font-grid.png')
)
mkdirSync(dirname(output), { recursive: true })
mkdirSync(dirname(screenshot), { recursive: true })
try {
  const browserCdp = await browser.newBrowserCDPSession()
  const { gpu: rawGpu } = await browserCdp.send('SystemInfo.getInfo')
  const gpu = summarizeGpu(rawGpu)
  const browserVersion = browser.version()
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 })
  const cdp = await page.context().newCDPSession(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setContent('<main id="panes" style="display:flex;gap:20px"></main>')
  await page.addStyleTag({ path: root + 'node_modules/@xterm/xterm/css/xterm.css' })
  await page.addStyleTag({ path: root + 'apps/tauri/src/renderer/xterm-adapters/xterm-compat.css' })
  const fonts = {}
  for (const [family, file] of [
    ['Grid Mono', 'jetbrains-mono/JetBrainsMono-400.ttf'],
    ['Grid Imported', 'outfit/Outfit-400.ttf'],
    ['Grid CJK', 'noto-sans-sc/NotoSansSC-Variable.ttf']
  ]) {
    fonts[family] = readFileSync(root + 'apps/tauri/src/renderer/assets/fonts/text/' + file).toString('base64')
    await page.addStyleTag({
      content: `@font-face {font-family:'${family}';src:url(data:font/ttf;base64,${fonts[family]})}`
    })
  }
  await page.evaluate(async () => {
    await Promise.all(
      ['Grid Mono', 'Grid Imported', 'Grid CJK'].map((family) => document.fonts.load(`14px "${family}"`))
    )
  })
  for (const path of [
    'node_modules/@xterm/xterm/lib/xterm.js',
    'node_modules/@xterm/addon-unicode11/lib/addon-unicode11.js',
    'node_modules/@xterm/addon-fit/lib/addon-fit.js',
    'node_modules/@xterm/addon-search/lib/addon-search.js'
  ])
    await page.addScriptTag({ path: root + path })
  await page.addScriptTag({ path: webglBundle })
  for (const [file, symbol] of [
    ['xterm-adapters/terminal-options', 'getTerminalCompatibilityOptions'],
    ['xterm-adapters/terminal-emoji-widths', 'registerTerminalEmojiWidths'],
    ['xterm-adapters/terminal-symbol-glyph-renderer', 'registerTerminalSymbolGlyphRenderer'],
    ['xterm-adapters/terminal-block-glyph-renderer', 'registerTerminalBlockGlyphRenderer'],
    ['xterm-adapters/terminal-selection-renderer', 'registerTerminalSelectionRenderer'],
    ['xterm-adapters/terminal-webgl-grid', 'registerTerminalWebglGrid'],
    ['xterm-adapters/terminal-render-recovery', 'observeTerminalFontMetrics']
  ])
    await loadTypeScript(page, root + 'apps/tauri/src/renderer/' + file + '.ts', symbol)
  await page.addScriptTag({
    content: `window.registerComparisonGridCalibration=${registerComparisonGridCalibration};window.readComparisonGridMetrics=${readComparisonGridMetrics};`
  })
  await page.evaluate((mode) => (window.gridMode = mode), gridMode)
  const control = await page.evaluate(async () => {
    window.settle = async () => {
      for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame)
    }
    window.createRuntime = (backend, fontFamily = '"Grid Mono", "Grid CJK", monospace') => {
      const host = document.createElement('div')
      host.className = 'terminal-host'
      host.style.cssText = 'width:777px;height:333px;flex:none'
      document.getElementById('panes').append(host)
      const terminal = new window.Terminal({
        ...window.getTerminalCompatibilityOptions(false),
        cols: 90,
        rows: 10,
        fontFamily,
        fontSize: 14,
        lineHeight: 1.05,
        allowProposedApi: true,
        cursorBlink: false,
        theme: { background: '#111111', foreground: '#dddddd' }
      })
      terminal.loadAddon(new window.Unicode11Addon.Unicode11Addon())
      terminal.unicode.activeVersion = '11'
      const fit = new window.FitAddon.FitAddon()
      const search = new window.SearchAddon.SearchAddon({ highlightLimit: 2000 })
      terminal.loadAddon(fit)
      terminal.loadAddon(search)
      const disposables = [window.registerTerminalEmojiWidths(terminal)]
      terminal.open(host)
      if (backend === 'webgl') terminal.loadAddon(new window.WebglAddon.WebglAddon())
      const uncalibrated = window.readComparisonGridMetrics(terminal)
      if (window.gridMode === 'comparison')
        disposables.push(window.registerComparisonGridCalibration(terminal, backend))
      else if (backend === 'webgl') disposables.push(window.registerTerminalWebglGrid(terminal))
      if (backend === 'dom')
        for (const name of [
          'registerTerminalSelectionRenderer',
          'registerTerminalSymbolGlyphRenderer',
          'registerTerminalBlockGlyphRenderer'
        ])
          disposables.push(window[name](terminal))
      return {
        backend,
        host,
        terminal,
        fit,
        search,
        uncalibrated,
        dispose() {
          disposables.reverse().forEach((item) => item.dispose())
          terminal.dispose()
          host.remove()
        }
      }
    }
    window.runtimes = ['dom', 'webgl'].map((backend) => window.createRuntime(backend))
    return window.runtimes.map((runtime) => runtime.uncalibrated)
  })
  assert.ok(
    Math.abs(control[0].cellWidth - control[1].cellWidth) > 0.2,
    'control must reproduce fractional grid mismatch'
  )
  const check = async (label) => {
    const result = await page.evaluate(async (label) => {
      const lines = ['|123456789|', '|中文，。|', '|e\u0301🧪✻|', '|▢────────────|', '|FileTerm search marker|']
      for (const { terminal, fit } of window.runtimes) {
        fit.fit()
        terminal.reset()
        await new Promise((resolve) => terminal.write(lines.join('\r\n'), resolve))
      }
      await window.settle()
      return {
        label,
        runtimes: window.runtimes.map(({ backend, host, terminal, fit }) => {
          const grid = window.readComparisonGridMetrics(terminal)
          const renderer = terminal._core._renderService._renderer.value
          const gl = renderer._gl
          const gpuSurface = gl
            ? {
                width: gl.drawingBufferWidth,
                height: gl.drawingBufferHeight,
                viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
                nonIntegerGlyphs: renderer._charAtlas.pages
                  .flatMap((page) => page.glyphs)
                  .filter(
                    (glyph) =>
                      !Number.isInteger(glyph.size.x) ||
                      !Number.isInteger(glyph.size.y) ||
                      !Number.isInteger(glyph.texturePosition.x) ||
                      !Number.isInteger(glyph.texturePosition.y)
                  ).length
              }
            : null
          terminal.select(1, 1, 4)
          const selection = terminal.getSelection()
          terminal.clearSelection()
          const rect = host.querySelector('.xterm-screen').getBoundingClientRect()
          const hits = [0, 7, terminal.cols - 1].map((col) =>
            terminal._core._mouseService.getCoords(
              {
                clientX: rect.left + ((col + 0.25) * rect.width) / terminal.cols,
                clientY: rect.top + (0.25 * rect.height) / terminal.rows
              },
              host.querySelector('.xterm-screen'),
              terminal.cols,
              terminal.rows,
              false
            )
          )
          const widths = lines.map((_, row) => {
            const line = terminal.buffer.active.getLine(row)
            return Array.from({ length: line.length }, (_, col) => {
              const cell = line.getCell(col)
              return [cell.getChars(), cell.getWidth()]
            })
          })
          let barErrors = []
          if (backend === 'dom')
            barErrors = Array.from(host.querySelector('.xterm-rows').children)
              .slice(0, lines.length)
              .map((row, index) => {
                const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
                const bars = []
                while (walker.nextNode())
                  for (let i = 0; i < walker.currentNode.length; i++)
                    if (walker.currentNode.textContent[i] === '|') {
                      const range = document.createRange()
                      range.setStart(walker.currentNode, i)
                      range.setEnd(walker.currentNode, i + 1)
                      bars.push(range.getBoundingClientRect().left)
                    }
                const line = terminal.buffer.active.getLine(index)
                let last = 0
                for (let col = 0; col < line.length; col++) if (line.getCell(col).getChars() === '|') last = col
                return bars.at(-1) - bars[0] - last * grid.cellWidth
              })
          return {
            backend,
            grid,
            gpuSurface,
            screenWidth: rect.width,
            screenHeight: rect.height,
            fit: fit.proposeDimensions(),
            selection,
            hits,
            widths,
            barErrors
          }
        })
      }
    }, label)
    const [dom, gl] = result.runtimes
    for (const key of gridMode === 'production'
      ? ['measuredWidth']
      : [
          'cols',
          'rows',
          'cellWidth',
          'cellHeight',
          'canvasWidth',
          'canvasHeight',
          'deviceCellWidth',
          'deviceCellHeight',
          'measuredWidth'
        ])
      assert.ok(
        Math.abs(dom.grid[key] - gl.grid[key]) < 1e-7,
        `${label} ${key}: ${JSON.stringify({ dom: dom.grid, gl: gl.grid })}`
      )
    if (gridMode === 'comparison') assert.deepEqual(dom.fit, gl.fit)
    if (gridMode === 'production') {
      assert.equal(gl.gpuSurface.nonIntegerGlyphs, 0, `${label}: glyph atlas pixels must be integer`)
      assert.ok(Number.isInteger(gl.grid.deviceCellWidth), `${label}: atlas cell width must be integer`)
      assert.ok(Number.isInteger(gl.grid.deviceCellHeight), `${label}: atlas cell height must be integer`)
    }
    const contentWidths = (rows) =>
      rows.map((row) => {
        let end = row.length
        while (end > 0 && row[end - 1][0] === '') end--
        return row.slice(0, end)
      })
    assert.deepEqual(contentWidths(dom.widths), contentWidths(gl.widths))
    for (const runtime of result.runtimes) {
      if (gridMode === 'production' && runtime.gpuSurface)
        assert.deepEqual(
          runtime.gpuSurface.viewport,
          [0, 0, runtime.gpuSurface.width, runtime.gpuSurface.height],
          `${label}: WebGL viewport must cover the backing buffer`
        )
      assert.equal(runtime.selection, '中文', label)
      assert.deepEqual(
        runtime.hits.map((hit) => hit[0]),
        [1, 8, runtime.grid.cols],
        label
      )
      assert.ok(Math.abs(runtime.screenWidth - runtime.grid.canvasWidth) < 0.05, label)
      assert.ok(Math.abs(runtime.screenHeight - runtime.grid.canvasHeight) < 0.05, label)
    }
    assert.ok(
      dom.barErrors.every((error) => Math.abs(error) < 1),
      `${label} text drift ${dom.barErrors}`
    )
    return {
      ...result,
      runtimes: result.runtimes.map((runtime) => {
        const copy = { ...runtime }
        delete copy.widths
        return copy
      })
    }
  }
  const results = []
  for (const dpr of [1, 1.1, 1.25, 1.5, 2]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1800,
      height: 1000,
      deviceScaleFactor: dpr,
      mobile: false
    })
    await page.evaluate(async () => {
      window.dispatchEvent(new Event('resize'))
      await window.settle()
    })
    assert.ok(Math.abs((await page.evaluate(() => window.devicePixelRatio)) - dpr) < 1e-6)
    for (const family of ['"Grid Mono", "Grid CJK", monospace', '"Grid Imported", "Grid CJK", monospace'])
      for (const size of [12, 13.65, 14, 16, 24]) {
        await page.evaluate(
          ({ family, size }) => {
            for (const { terminal } of window.runtimes) {
              terminal.options.fontFamily = family
              terminal.options.fontSize = size
            }
          },
          { family, size }
        )
        results.push(await check(`DPR ${dpr} ${family} ${size}px`))
        if (gridMode === 'production' && dpr === 1.25 && family.includes('Grid Mono') && size === 14)
          await page.screenshot({ path: screenshot.replace(/\.png$/i, '-125pct.png') })
      }
  }
  const late = await page.evaluate(async (font) => {
    document.documentElement.style.setProperty('--font-mono', '"Late, Grid"')
    const disposers = window.runtimes.map(({ terminal, fit }) =>
      window.observeTerminalFontMetrics(terminal, () => fit.fit())
    )
    await window.settle()
    const before = window.runtimes.map(({ terminal }) => terminal.cols)
    const face = new FontFace('Late, Grid', `url(data:font/ttf;base64,${font})`)
    document.fonts.add(face)
    window.dispatchEvent(new Event('fileterm:imported-fonts-changed'))
    await document.fonts.load('24px "Late, Grid"')
    await document.fonts.ready
    await window.settle()
    const after = window.runtimes.map(({ terminal }) => terminal.cols)
    const references = window.runtimes.map(({ backend, terminal }) => {
      const reference = window.createRuntime(backend, terminal.options.fontFamily)
      reference.terminal.options.fontSize = terminal.options.fontSize
      reference.fit.fit()
      const cols = reference.terminal.cols
      reference.dispose()
      return cols
    })
    disposers.forEach((dispose) => dispose())
    return { before, after, references }
  }, fonts['Grid Imported'])
  assert.notDeepEqual(late.before, late.after, 'late font must change the fallback grid')
  assert.deepEqual(late.after, late.references, 'late font must match freshly created calibrated terminals')
  results.push(await check('late imported font'))
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1800,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  })
  await page.evaluate(async () => {
    window.dispatchEvent(new Event('resize'))
    for (const { terminal } of window.runtimes) {
      terminal.options.fontFamily = '"Grid Mono", "Grid CJK", monospace'
      terminal.options.fontSize = 14
    }
    await window.settle()
  })
  results.push(await check('restored default font and DPI'))
  const resizeResults = []
  for (const width of [620, 777, 940]) {
    await page.evaluate(async (width) => {
      for (const { host, fit } of window.runtimes) {
        host.style.width = `${width}px`
        fit.fit()
      }
      await window.settle()
    }, width)
    resizeResults.push(await check(`window resize ${width}px`))
  }
  const searchResults = await page.evaluate(() =>
    window.runtimes.map(({ backend, search }) => ({ backend, found: search.findNext('search marker') }))
  )
  assert.deepEqual(
    searchResults.map(({ found }) => found),
    [true, true]
  )
  const replay = 'FileTerm replay 中文 🧪'
  const replayResults = await page.evaluate(async (replay) => {
    const write = (terminal, value) => new Promise((resolve) => terminal.write(value, resolve))
    for (const { terminal } of window.runtimes) {
      terminal.reset()
      await write(terminal, replay)
    }
    await window.settle()
    return window.runtimes.map(({ backend, terminal }) => ({
      backend,
      text: terminal.buffer.active.getLine(0).translateToString(true)
    }))
  }, replay)
  assert.deepEqual(
    replayResults.map(({ text }) => text),
    [replay, replay]
  )
  await page.screenshot({ path: screenshot })
  await page.evaluate(() => window.runtimes.forEach((runtime) => runtime.dispose()))
  assert.deepEqual(errors, [])
  writeFileSync(
    output,
    JSON.stringify(
      {
        environment: {
          engine: 'Playwright Chromium headless',
          browserVersion,
          gpu,
          gridCalibration:
            gridMode === 'production'
              ? 'native renderer grids; WebGL integer atlas; DOM metrics unchanged'
              : 'existing test-only normalization; production DOM unchanged',
          imeInput: { status: 'not-supported-by-headless' }
        },
        control,
        late,
        results,
        resizeResults,
        searchResults,
        replayResults,
        screenshot: relative(dirname(output), screenshot).replaceAll('\\', '/')
      },
      null,
      2
    ) + '\n'
  )
  console.log(
    JSON.stringify({
      cases: results.length,
      control: control.map((grid) => grid.cellWidth),
      late,
      screenshot: relative(dirname(output), screenshot).replaceAll('\\', '/')
    })
  )
} finally {
  await browser.close()
}
