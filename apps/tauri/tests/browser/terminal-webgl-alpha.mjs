/* global window, document, requestAnimationFrame */
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
import './apps/tauri/src/renderer/styles/text-fonts.css'
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
  for (const dpr of [1, 1.25, 2]) {
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
          for (let i = 0; i < pixels.length; i += 4) {
            alphas.push(pixels[i + 3])
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
          return {
            background,
            foreground,
            weight,
            minAlpha: Math.min(...alphas),
            maxAlpha: Math.max(...alphas),
            dimRedMin: Math.min(...dimRed),
            dimRedMax: Math.max(...dimRed),
            coverageAlphaError,
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
        }
      }
      const transparent = await page.evaluate(() => window.capture('rgba(240,240,240,0.4)', '#202020', 400))
      assert.ok(transparent.coverageAlphaError <= 4, 'transparent themes preserve source-over coverage alpha')
      assert.equal(transparent.glError, 0)
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
      results.push({ dpr, browser: browser.version(), gpu: summarizeGpu(gpu), samples, transparent, restored })
    } finally {
      await browser.close()
    }
  }
  writeFileSync(join(archive, 'terminal-webgl-alpha.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(JSON.stringify({ dprs: results.map(({ dpr }) => dpr), status: 'passed', archive }))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
