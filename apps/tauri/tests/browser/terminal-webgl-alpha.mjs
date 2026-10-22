/* global window, document, Image, requestAnimationFrame */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const archive = resolve(
  process.env.FILETERM_VALIDATION_ARCHIVE || join(root, '..', 'renderer-validation-archive', 'webgl-alpha')
)
const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_MODULE_PATH || 'esbuild')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const temporary = mkdtempSync(join(tmpdir(), 'fileterm-webgl-alpha-'))
mkdirSync(archive, { recursive: true })

try {
  await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
import { createTerminalLifecycleRuntime } from './apps/tauri/src/renderer/components/terminal-lifecycle-core'
import { setTerminalRendererPreference } from './apps/tauri/src/renderer/app/terminal-renderer-preference'
import './apps/tauri/src/renderer/styles/index.css'
import '@xterm/xterm/css/xterm.css'
window.createRuntime = (host, renderer) => {
  setTerminalRendererPreference(renderer)
  const runtime = createTerminalLifecycleRuntime({
    hostRef: { current: host }, profileIdRef: { current: 'alpha-fixture' }, tabIdRef: { current: 'alpha-fixture' },
    terminalRef: { current: null }, fitAddonRef: { current: null }, searchAddonRef: { current: null },
    terminalLogColorizerRef: { current: null }, pendingWriteRef: { current: '' }, renderedTranscriptRef: { current: '' },
    isActiveRef: { current: true }, setTerminalScrollableElement: () => {}, isMac: false, isWindowsPty: false,
    buildTerminalTheme: () => ({ foreground: '#202020', background: '#ffffff' })
  })
  runtime.terminal.options.fontSize = 24
  runtime.terminal.options.fontFamily = '"JetBrains Mono", monospace'
  runtime.terminal.options.cursorBlink = false
  return runtime
}
`
    },
    bundle: true,
    outfile: join(temporary, 'bundle.js'),
    define: { 'import.meta.env.DEV': 'false' },
    loader: { '.svg': 'dataurl', '.ttf': 'dataurl', '.woff2': 'dataurl', '.png': 'dataurl' },
    logLevel: 'silent'
  })
  const results = []
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      args: ['--enable-gpu', '--force-device-scale-factor=' + dpr, '--window-size=1200,700']
    })
    try {
      const page = await browser.newPage({ viewport: null })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setContent('<main id="host" style="width:800px;height:350px;background:white"></main>')
      await page.evaluate(() => {
        window.fileterm = { platform: 'win32', writeDiagnosticLog: () => Promise.resolve() }
      })
      await page.addStyleTag({ path: join(temporary, 'bundle.css') })
      await page.addScriptTag({ path: join(temporary, 'bundle.js') })
      await page.evaluate(async () => {
        await Promise.all([400, 500, 700].map((weight) => document.fonts.load(weight + ' 24px "JetBrains Mono"')))
        await document.fonts.ready
        window.runtime = window.createRuntime(document.getElementById('host'), 'webgl')
      })
      await page.waitForFunction(() => Boolean(window.runtime.terminal._core._renderService._renderer.value._gl))
      await page.evaluate(() => {
        window.capture = async (background, foreground, weight) => {
          const terminal = window.runtime.terminal
          terminal.options.theme = { background, foreground }
          terminal.options.fontWeight = weight
          await new Promise((resolve) =>
            terminal.write('\x1b[?25l\x1b[2J\x1b[HMMMM HHHH\r\n\x1b[2mMMMM HHHH\x1b[0m', resolve)
          )
          window.runtime.fitAddon.fit()
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          const renderer = terminal._core._renderService._renderer.value
          const gl = renderer._gl
          const pendingErrors = []
          for (let i = 0; i < 8; i++) {
            const error = gl.getError()
            if (!error) break
            pendingErrors.push(error)
          }
          renderer.renderRows(0, terminal.rows - 1)
          const width = Math.floor(renderer.dimensions.device.cell.width * 12)
          const height = Math.floor(renderer.dimensions.device.cell.height * 2)
          const pixels = new Uint8Array(width * height * 4)
          gl.readPixels(0, gl.canvas.height - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          const alphas = []
          const dimRed = []
          let coverageAlphaError = 0
          let subpixelPixels = 0
          for (let i = 0; i < pixels.length; i += 4) {
            alphas.push(pixels[i + 3])
            if (
              Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
              20
            )
              subpixelPixels++
            const row = Math.floor(i / 4 / width)
            if (row < height / 2) dimRed.push(pixels[i])
            else {
              const backgroundIndex = (row * width + width - 1) * 4
              const backgroundRed = pixels[backgroundIndex]
              const sourceRed = Number.parseInt(foreground.slice(1, 3), 16)
              const coverage = Math.max(0, Math.min(1, (pixels[i] - backgroundRed) / (sourceRed - backgroundRed)))
              const expectedAlpha = coverage * 255 + (1 - coverage) * pixels[backgroundIndex + 3]
              coverageAlphaError = Math.max(coverageAlphaError, Math.abs(pixels[i + 3] - expectedAlpha))
            }
          }
          renderer.renderRows(0, terminal.rows - 1)
          const repeatedPixels = new Uint8Array(pixels.length)
          gl.readPixels(0, gl.canvas.height - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, repeatedPixels)
          let repeatError = 0
          for (let i = 0; i < pixels.length; i++)
            repeatError = Math.max(repeatError, Math.abs(pixels[i] - repeatedPixels[i]))
          return {
            background,
            foreground,
            weight,
            minAlpha: Math.min(...alphas),
            maxAlpha: Math.max(...alphas),
            dimRedMin: Math.min(...dimRed),
            dimRedMax: Math.max(...dimRed),
            coverageAlphaError,
            subpixelPixels,
            repeatError,
            atlasTransparency: renderer._charAtlas._config.allowTransparency,
            glyphCanvasAlpha: renderer._charAtlas._tmpCtx.getContextAttributes().alpha,
            blendAlpha: [gl.getParameter(gl.BLEND_SRC_ALPHA), gl.getParameter(gl.BLEND_DST_ALPHA)],
            viewport: [...gl.getParameter(gl.VIEWPORT)],
            backing: [gl.canvas.width, gl.canvas.height],
            pendingErrors,
            glError: gl.getError()
          }
        }
      })
      const samples = []
      for (const weight of [400, 500]) {
        await page.evaluate(
          (width) => {
            document.getElementById('host').style.width = width + 'px'
          },
          weight === 400 ? 800 : 640
        )
        for (const [background, foreground] of [
          ['#ffffff', '#202020'],
          ['#111111', '#dddddd']
        ]) {
          const sample = await page.evaluate((args) => window.capture(...args), [background, foreground, weight])
          samples.push(sample)
          if (sample.minAlpha !== 255) {
            await page.screenshot({ path: join(archive, `alpha-failure-dpr${dpr}.png`) })
          }
          assert.equal(sample.minAlpha, 255, 'opaque backgrounds must remain opaque under antialiased/dim glyphs')
          const expectedDim = background === '#ffffff' ? 144 : 119
          const observedDim = background === '#ffffff' ? sample.dimRedMin : sample.dimRedMax
          assert.ok(Math.abs(observedDim - expectedDim) <= 3, `dim text keeps one 50% opacity: ${observedDim}`)
          assert.deepEqual(sample.viewport, [0, 0, ...sample.backing])
          assert.deepEqual(sample.pendingErrors, [])
          assert.equal(sample.glError, 0)
          assert.equal(sample.atlasTransparency, false, 'opaque themes must use an opaque glyph atlas')
          assert.equal(sample.glyphCanvasAlpha, false)
          assert.ok(sample.repeatError <= 1, 'repeated rendering keeps opaque glyphs stable')
          if (process.platform === 'win32') assert.ok(sample.subpixelPixels > 0, 'retain Windows subpixel glyph edges')
        }
      }
      const transparent = await page.evaluate(() => window.capture('rgba(240,240,240,0.4)', '#202020', 400))
      assert.ok(transparent.coverageAlphaError <= 4, 'transparent themes preserve source-over coverage alpha')
      assert.equal(transparent.glError, 0)
      assert.equal(transparent.atlasTransparency, true, 'translucent themes must retain coverage alpha')
      assert.equal(transparent.glyphCanvasAlpha, true)
      assert.ok(transparent.repeatError <= 1, 'repeated rendering must not accumulate translucent backgrounds')
      const colors = await page.evaluate(async () => {
        const terminal = window.runtime.terminal
        const rgb = [
          [217, 119, 87],
          [255, 0, 0],
          [0, 255, 0],
          [0, 0, 255],
          [255, 255, 0],
          [0, 255, 255],
          [255, 0, 255]
        ]
        terminal.options.theme = { background: '#ffffff', foreground: '#202020' }
        const ansi = Array.from({ length: 16 }, (_, index) => `\x1b[${index < 8 ? 30 + index : 90 + index - 8}m█`)
        const truecolor = rgb.map((channels) => `\x1b[38;2;${channels.join(';')}m█`)
        await new Promise((resolve) =>
          terminal.write(`\x1b[?25l\x1b[2J\x1b[H${ansi.join('')}\r\n${truecolor.join('')}\x1b[0m`, resolve)
        )
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const renderer = terminal._core._renderService._renderer.value
        renderer.renderRows(0, terminal.rows - 1)
        const gl = renderer._gl
        const sample = (column, row) => {
          const pixel = new Uint8Array(4)
          gl.readPixels(
            Math.floor(((column + 0.5) * gl.canvas.width) / terminal.cols),
            gl.canvas.height - 1 - Math.floor(((row + 0.5) * gl.canvas.height) / terminal.rows),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixel
          )
          return [...pixel]
        }
        const palette = terminal._core._themeService.colors.ansi
          .slice(0, 16)
          .map(({ rgba }) => [rgba >>> 24, (rgba >>> 16) & 255, (rgba >>> 8) & 255, 255])
        return {
          ansi: palette.map((expected, column) => ({ expected, actual: sample(column, 0) })),
          rgb: rgb.map((expected, column) => ({ expected: [...expected, 255], actual: sample(column, 1) })),
          error: gl.getError()
        }
      })
      for (const color of [...colors.ansi, ...colors.rgb]) {
        assert.ok(
          color.actual.every((channel, index) => Math.abs(channel - color.expected[index]) <= 1),
          `ANSI/RGB color preserved: ${JSON.stringify(color)}`
        )
      }
      assert.equal(colors.error, 0)
      const graphicProfiles = await page.evaluate(async () => {
        const host = document.createElement('div')
        host.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:350px;background:white'
        document.body.append(host)
        const dom = window.createRuntime(host, 'dom')
        const webgl = window.runtime
        const samples = []
        try {
          for (const font of ['"JetBrains Mono", monospace', 'Consolas, monospace'])
            for (const size of [12, 14, 16, 24]) {
              for (const runtime of [dom, webgl]) {
                runtime.terminal.options.theme = { background: '#ffffff', foreground: '#202020' }
                runtime.terminal.options.fontSize = size
                runtime.terminal.options.fontFamily = font
                runtime.terminal.options.fontWeight = 400
                await new Promise((resolve) =>
                  runtime.terminal.write('\x1b[?25l\x1b[2J\x1b[H────────\r\n━━━━━━━━\r\n' + '█'.repeat(40), resolve)
                )
                runtime.terminal.resize(80, 10)
              }
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
              const renderer = webgl.terminal._core._renderService._renderer.value
              renderer.renderRows(0, webgl.terminal.rows - 1)
              const gl = renderer._gl
              const rows = []
              for (const row of [0, 1]) {
                const canvas = dom.terminal.element.querySelector(`.xterm-block-glyph[data-row-index="${row}"]`)
                if (!canvas) throw new Error('DOM graphic reference is missing')
                const x = Math.floor(canvas.width / dom.terminal.cols / 2)
                const domPixels = canvas.getContext('2d').getImageData(x, 0, 1, canvas.height).data
                const domProfile = []
                for (let y = 0; y < canvas.height; y++) {
                  const i = y * 4
                  domProfile.push(Math.round((domPixels[i] * domPixels[i + 3]) / 255 + 255 - domPixels[i + 3]))
                }
                const height = Math.round(gl.canvas.height / webgl.terminal.rows)
                const pixels = new Uint8Array(height * 4)
                gl.readPixels(
                  Math.floor(gl.canvas.width / webgl.terminal.cols / 2),
                  gl.canvas.height - (row + 1) * height,
                  1,
                  height,
                  gl.RGBA,
                  gl.UNSIGNED_BYTE,
                  pixels
                )
                const webglProfile = []
                for (let y = height - 1; y >= 0; y--) webglProfile.push(pixels[y * 4])
                rows.push({ row, domProfile, webglProfile })
              }
              const grid = [dom, webgl].map(
                ({ terminal }) => terminal._core._renderService._renderer.value.dimensions.css.cell
              )
              const y = Math.round((2.5 * gl.canvas.height) / webgl.terminal.rows)
              const width = Math.round((40 * gl.canvas.width) / webgl.terminal.cols)
              const block = new Uint8Array(width * 4)
              gl.readPixels(0, gl.canvas.height - y - 1, width, 1, gl.RGBA, gl.UNSIGNED_BYTE, block)
              let seams = 0
              for (let x = 0; x < width; x++) if (Math.abs(block[x * 4] - 32) > 1) seams++
              const terminal = webgl.terminal
              terminal.options.theme = {
                background: '#ffffff',
                foreground: '#202020',
                cursor: '#0000ff',
                cursorAccent: '#ffffff',
                selectionBackground: '#ff0000'
              }
              terminal.options.cursorStyle = 'block'
              terminal.focus()
              await new Promise((resolve) => terminal.write('\x1b[4;12H\x1b[?25h', resolve))
              terminal.select(3, 3, 3)
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
              renderer.renderRows(0, terminal.rows - 1)
              const py = Math.round((3.5 * gl.canvas.height) / terminal.rows)
              const line = new Uint8Array(gl.canvas.width * 4)
              gl.readPixels(0, gl.canvas.height - py - 1, gl.canvas.width, 1, gl.RGBA, gl.UNSIGNED_BYTE, line)
              const selected = [],
                cursor = []
              for (let x = 0; x < gl.canvas.width; x++) {
                const i = x * 4
                if (line[i] > 250 && line[i + 1] < 5 && line[i + 2] < 5) selected.push(x)
                if (line[i] < 5 && line[i + 1] < 5 && line[i + 2] > 250) cursor.push(x)
              }
              const dx = gl.canvas.width / terminal.cols
              const expected = (start, end) => [Math.round(start * dx), Math.round(end * dx) - 1]
              terminal.clearSelection()
              samples.push({
                font,
                size,
                rows,
                grid,
                seams,
                selected: [selected[0], selected.at(-1)],
                expectedSelected: expected(3, 6),
                cursor: [cursor[0], cursor.at(-1)],
                expectedCursor: expected(11, 12),
                error: gl.getError()
              })
            }
          return samples
        } finally {
          dom.disposeCore()
          host.remove()
        }
      })
      for (const sample of graphicProfiles) {
        assert.equal(sample.error, 0)
        assert.deepEqual(sample.grid[1], sample.grid[0], 'DOM/WebGL logical grid matches at the same size')
        for (const [actual, expected] of [
          [sample.selected, sample.expectedSelected],
          [sample.cursor, sample.expectedCursor]
        ])
          assert.ok(
            actual.every((value, index) => Number.isFinite(value) && Math.abs(value - expected[index]) <= 1),
            `selection/cursor follows projected cells: ${JSON.stringify({ dpr, font: sample.font, size: sample.size, actual, expected })}`
          )
        assert.equal(
          sample.seams,
          0,
          `full blocks have no seams: ${JSON.stringify({ dpr, font: sample.font, size: sample.size })}`
        )
        for (const row of sample.rows) {
          const domInk = row.domProfile.filter((channel) => channel < 250)
          const webglInk = row.webglProfile.filter((channel) => channel < 250)
          assert.equal(
            webglInk.length,
            domInk.length,
            `DOM/WebGL line thickness: DPR ${dpr}, size ${sample.size}, row ${row.row}`
          )
          assert.ok(
            webglInk.every((channel, index) => Math.abs(channel - domInk[index]) <= 1),
            'line edge colors match DOM'
          )
        }
      }
      await page.evaluate(() => {
        const host = document.createElement('div')
        host.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:350px;background:white'
        document.body.append(host)
        window.baselineReference = { host, runtime: window.createRuntime(host, 'dom') }
      })
      const baselineProfiles = []
      try {
        for (const font of ['"JetBrains Mono", monospace', 'Consolas, monospace']) {
          for (const size of [12, 14, 16, 24]) {
            for (const style of ['', '1', '3', '1;3']) {
              const sample = await page.evaluate(
                async ({ font, size, style }) => {
                  const dom = window.baselineReference.runtime
                  const webgl = window.runtime
                  for (const runtime of [dom, webgl]) {
                    runtime.terminal.options.theme = { background: '#ffffff', foreground: '#202020' }
                    runtime.terminal.options.fontFamily = font
                    runtime.terminal.options.fontSize = size
                    runtime.terminal.options.fontWeight = 400
                    await new Promise((resolve) =>
                      runtime.terminal.write(`\x1b[?25l\x1b[2J\x1b[H\x1b[0m\x1b[${style}mH\x1b[0m`, resolve)
                    )
                    runtime.terminal.resize(80, 10)
                  }
                  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                  const renderer = webgl.terminal._core._renderService._renderer.value
                  renderer.renderRows(0, webgl.terminal.rows - 1)
                  const gl = renderer._gl
                  const width = Math.ceil(gl.canvas.width / webgl.terminal.cols) + 2
                  const height = Math.ceil(gl.canvas.height / webgl.terminal.rows) + 4
                  const pixels = new Uint8Array(width * height * 4)
                  gl.readPixels(0, gl.canvas.height - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
                  const ink = []
                  for (let row = 0; row < height; row++) {
                    for (let x = 0; x < width; x++) {
                      const i = ((height - row - 1) * width + x) * 4
                      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 180) {
                        ink.push(row)
                        break
                      }
                    }
                  }
                  const bounds = dom.terminal.element.querySelector('.xterm-screen').getBoundingClientRect()
                  const cell = dom.terminal._core._renderService._renderer.value.dimensions.css.cell
                  return {
                    font,
                    size,
                    style,
                    webglInk: ink,
                    error: gl.getError(),
                    clip: {
                      x: bounds.x,
                      y: bounds.y,
                      width: Math.ceil(cell.width) + 2,
                      height: Math.ceil(cell.height) + 2
                    }
                  }
                },
                { font, size, style }
              )
              const png = await page.screenshot({ clip: sample.clip })
              const domInk = await page.evaluate(
                async (data) => {
                  const image = new Image()
                  image.src = data
                  await image.decode()
                  const canvas = document.createElement('canvas')
                  canvas.width = image.width
                  canvas.height = image.height
                  const context = canvas.getContext('2d')
                  context.drawImage(image, 0, 0)
                  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
                  const ink = []
                  for (let row = 0; row < canvas.height; row++) {
                    for (let x = 0; x < canvas.width; x++) {
                      const i = (row * canvas.width + x) * 4
                      if (Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 180) {
                        ink.push(row)
                        break
                      }
                    }
                  }
                  return ink
                },
                `data:image/png;base64,${png.toString('base64')}`
              )
              baselineProfiles.push({ ...sample, domInk })
              assert.equal(sample.error, 0)
              assert.ok(domInk.length > 0 && sample.webglInk.length > 0, 'both renderers draw the baseline reference')
              assert.equal(
                sample.webglInk[0],
                domInk[0],
                `glyph top matches DOM: ${JSON.stringify({ dpr, font, size, style, domInk, webglInk: sample.webglInk })}`
              )
              assert.equal(sample.webglInk.at(-1), domInk.at(-1), 'glyph bottom matches DOM')
            }
          }
        }
      } finally {
        await page.evaluate(() => {
          window.baselineReference.runtime.disposeCore()
          window.baselineReference.host.remove()
          delete window.baselineReference
        })
      }
      await page.evaluate(async () => {
        const renderer = window.runtime.terminal._core._renderService._renderer.value
        const extension = renderer._gl.getExtension('WEBGL_lose_context')
        if (!extension) throw new Error('Context restore test requires WEBGL_lose_context')
        const canvas = renderer._gl.canvas
        await new Promise((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('WebGL context loss timed out')), 5000)
          canvas.addEventListener(
            'webglcontextlost',
            () => {
              window.clearTimeout(timeout)
              resolve()
            },
            { once: true }
          )
          extension.loseContext()
        })
        await new Promise((resolve) => window.setTimeout(resolve, 100))
        await new Promise((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error('WebGL context restoration timed out')), 5000)
          canvas.addEventListener(
            'webglcontextrestored',
            () => {
              window.clearTimeout(timeout)
              resolve()
            },
            { once: true }
          )
          extension.restoreContext()
        })
      })
      const restored = await page.evaluate(() => window.capture('#ffffff', '#202020', 400))
      assert.equal(restored.minAlpha, 255, 'restored contexts must keep the alpha fix')
      assert.equal(restored.glError, 0)
      await page.screenshot({ path: join(archive, `alpha-fixed-dpr${dpr}.png`) })
      await page.evaluate(() => window.runtime.disposeCore())
      assert.deepEqual(errors, [])
      const cdp = await browser.newBrowserCDPSession()
      const { gpu } = await cdp.send('SystemInfo.getInfo')
      results.push({
        dpr,
        browser: browser.version(),
        gpu: summarizeGpu(gpu),
        samples,
        transparent,
        colors,
        graphicProfiles,
        baselineProfiles,
        restored
      })
    } finally {
      await browser.close()
    }
  }
  writeFileSync(join(archive, 'terminal-webgl-alpha.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify({ dprs: results.map(({ dpr }) => dpr), status: 'passed', archive }))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
