/* global window, document, HTMLCanvasElement */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_MODULE_PATH || 'esbuild')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const output = process.env.FILETERM_WEBGL_LIFECYCLE_OUTPUT || join(tmpdir(), 'fileterm-webgl-lifecycle.json')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'fileterm-webgl-lifecycle-'))
const bundlePath = join(temporaryDirectory, 'bundle.js')
const loadFailureBundlePath = join(temporaryDirectory, 'load-failure-bundle.js')
const stylesPath = join(temporaryDirectory, 'bundle.css')
const entryPoint = `
import { createTerminalLifecycleRuntime } from './apps/tauri/src/renderer/components/terminal-lifecycle-core'
import { setTerminalRendererPreference } from './apps/tauri/src/renderer/app/terminal-renderer-preference'
import './apps/tauri/src/renderer/styles/index.css'
import '@xterm/xterm/css/xterm.css'
window.createRuntime = host => createTerminalLifecycleRuntime({
  hostRef: { current: host }, profileIdRef: { current: 'renderer-test' }, tabIdRef: { current: 'renderer-test' },
  terminalRef: { current: null }, fitAddonRef: { current: null }, searchAddonRef: { current: null },
  terminalLogColorizerRef: { current: null }, pendingWriteRef: { current: '' }, renderedTranscriptRef: { current: '' },
  isActiveRef: { current: true }, setTerminalScrollableElement: () => {}, isMac: false, isWindowsPty: false,
  buildTerminalTheme: () => ({ foreground: '#dddddd', background: '#111111', selectionBackground: '#444444' })
})
window.setTerminalRendererPreference = setTerminalRendererPreference
`
const buildOptions = {
  stdin: { resolveDir: root, loader: 'ts', contents: entryPoint },
  bundle: true,
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.VITE_FILETERM_TERMINAL_RENDERER': 'undefined'
  },
  loader: { '.svg': 'dataurl', '.ttf': 'dataurl', '.woff2': 'dataurl', '.png': 'dataurl' },
  logLevel: 'silent'
}

try {
  await build({ ...buildOptions, outfile: bundlePath })
  await build({
    ...buildOptions,
    outfile: loadFailureBundlePath,
    plugins: [
      {
        name: 'fail-webgl-module-load',
        setup(build) {
          build.onResolve({ filter: /^@xterm\/addon-webgl$/ }, () => ({ path: 'failed-webgl', namespace: 'test' }))
          build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
            contents: 'throw new Error("mock-webgl-load-failure"); export class WebglAddon {}',
            loader: 'js'
          }))
        }
      }
    ]
  })

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ['--enable-gpu']
  })
  try {
    const browserCdp = await browser.newBrowserCDPSession()
    const { gpu: rawGpu } = await browserCdp.send('SystemInfo.getInfo')
    const gpu = summarizeGpu(rawGpu)
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setContent('<main id="host" style="width:900px;height:600px"></main>')
    await page.evaluate(() => {
      window.rendererLogs = []
      window.fileterm = {
        platform: 'win32',
        writeDiagnosticLog: (_level, _scope, message) => {
          window.rendererLogs.push(JSON.parse(message))
          return Promise.resolve()
        },
        writeTerminal: () => Promise.resolve()
      }
    })
    await page.addStyleTag({ path: stylesPath })
    await page.addScriptTag({ path: bundlePath })
    await page.evaluate(async () => document.fonts.ready)
    await page.evaluate(() => {
      window.setTerminalRendererPreference('webgl')
      const runtime = window.createRuntime(document.getElementById('host'))
      window.runtime = runtime
      runtime.terminal.write('WebGL lifecycle 中文 🧪 ✻ ▢\r\n')
    })
    await page.waitForFunction(
      () => window.rendererLogs.some((entry) => entry.event === 'terminal-renderer' && entry.renderer === 'webgl'),
      undefined,
      { timeout: 15000 }
    )
    const active = await page.evaluate(async () => {
      const terminal = window.runtime.terminal
      await new Promise((resolve) => terminal.write('\r\nselection marker', resolve))
      terminal.select(0, 0, 4)
      const renderer = terminal._core._renderService._renderer.value
      const canvas = [...terminal.element.querySelectorAll('canvas')].find((item) => item.getContext('webgl2'))
      const gl = canvas?.getContext('webgl2')
      const debug = gl?.getExtension('WEBGL_debug_renderer_info')
      return {
        renderer: renderer.constructor.name,
        webglActive: window.rendererLogs.some(
          (entry) => entry.event === 'terminal-renderer' && entry.renderer === 'webgl' && entry.reason === 'active'
        ),
        text: terminal.buffer.active.getLine(0).translateToString(true),
        selection: terminal.getSelection(),
        glRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        hardwareAcceleration: window.rendererLogs.find((entry) => entry.renderer === 'webgl')?.hardwareAcceleration,
        contextLossSupported: Boolean(gl?.getExtension('WEBGL_lose_context')),
        canvas: Boolean(canvas)
      }
    })
    assert.equal(active.webglActive, true)
    assert.match(active.text, /WebGL lifecycle 中文/)
    assert.equal(active.selection, 'WebG')
    assert.equal(active.canvas, true)
    assert.equal(active.contextLossSupported, true)

    await page.evaluate(async () => {
      const host = document.createElement('main')
      host.style.cssText = 'width:900px;height:600px'
      document.body.append(host)
      window.blockGlyphHost = host
      window.blockGlyphRuntime = window.createRuntime(host)
      await new Promise((resolve) =>
        window.blockGlyphRuntime.terminal.write('OpenCode logo: ▗▀▖ ▌█▐ ▝▄▘ ░▒▓█\r\n', resolve)
      )
    })
    await page.waitForFunction(
      () =>
        window.rendererLogs.some(
          (entry) =>
            entry.event === 'terminal-renderer' &&
            entry.renderer === 'dom' &&
            entry.reason === 'block-glyph-compatibility'
        ),
      undefined,
      { timeout: 10000 }
    )
    const blockGlyphFallback = await page.evaluate(() => {
      const terminal = window.blockGlyphRuntime.terminal
      return {
        renderer: terminal._core._renderService._renderer.value.constructor.name,
        domRows: Boolean(terminal.element.querySelector('.xterm-rows')),
        overlay: Boolean(terminal.element.querySelector('.xterm-block-glyph-row')),
        text: terminal.buffer.active.getLine(0).translateToString(true)
      }
    })
    assert.equal(blockGlyphFallback.domRows, true)
    assert.equal(blockGlyphFallback.overlay, true)
    assert.match(blockGlyphFallback.text, /OpenCode logo: ▗▀▖/)
    await page.evaluate(() => {
      window.blockGlyphRuntime.disposeCore()
      window.blockGlyphHost.remove()
    })

    await page.evaluate(() => {
      const terminal = window.runtime.terminal
      const canvas = [...terminal.element.querySelectorAll('canvas')].find((item) => item.getContext('webgl2'))
      canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()
    })
    await page.waitForFunction(
      () =>
        window.rendererLogs.some(
          (entry) => entry.event === 'terminal-renderer' && entry.renderer === 'dom' && entry.reason === 'context-loss'
        ),
      undefined,
      { timeout: 10000 }
    )
    const fallback = await page.evaluate(() => {
      const terminal = window.runtime.terminal
      return {
        renderer: terminal._core._renderService._renderer.value.constructor.name,
        domRows: Boolean(terminal.element.querySelector('.xterm-rows')),
        canvasCount: terminal.element.querySelectorAll('.xterm-screen canvas').length
      }
    })
    assert.equal(fallback.domRows, true)
    await page.evaluate(() => window.runtime.disposeCore())

    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === 'webgl2') return null
        return original.call(this, type, ...args)
      }
      window.restoreCanvasContext = () => (HTMLCanvasElement.prototype.getContext = original)
      const host = document.createElement('main')
      host.style.cssText = 'width:900px;height:600px'
      document.body.append(host)
      window.failedHost = host
      window.failedRuntime = window.createRuntime(host)
    })
    await page.waitForFunction(
      () =>
        window.rendererLogs.some(
          (entry) =>
            entry.event === 'terminal-renderer' && entry.renderer === 'dom' && entry.reason === 'activation-failed'
        ),
      undefined,
      { timeout: 10000 }
    )
    const failedActivation = await page.evaluate(() => ({
      renderer: window.failedRuntime.terminal._core._renderService._renderer.value.constructor.name,
      domRows: Boolean(window.failedRuntime.terminal.element.querySelector('.xterm-rows'))
    }))
    assert.equal(failedActivation.domRows, true)
    await page.evaluate(() => {
      window.restoreCanvasContext()
      window.failedRuntime.disposeCore()
      window.failedHost.remove()
    })
    await page.evaluate(() => {
      const host = document.createElement('main')
      host.style.cssText = 'width:900px;height:600px'
      document.body.append(host)
      window.disposeHost = host
      window.disposeRuntime = window.createRuntime(host)
    })
    await page.waitForFunction(
      () =>
        window.rendererLogs.filter(
          (entry) => entry.event === 'terminal-renderer' && entry.renderer === 'webgl' && entry.reason === 'active'
        ).length >= 2,
      undefined,
      { timeout: 10000 }
    )
    await page.evaluate(() => {
      const canvas = [...window.disposeRuntime.terminal.element.querySelectorAll('canvas')].find((item) =>
        item.getContext('webgl2')
      )
      window.disposedGl = canvas?.getContext('webgl2')
      window.disposeRuntime.disposeCore()
    })
    await page.waitForFunction(() => window.disposedGl?.isContextLost(), undefined, { timeout: 5000 })
    const normalDispose = await page.evaluate(() => ({
      contextLost: window.disposedGl.isContextLost(),
      remainingHostChildren: window.disposeHost.childElementCount
    }))
    assert.equal(normalDispose.contextLost, true)
    assert.equal(normalDispose.remainingHostChildren, 0)
    await page.evaluate(() => window.disposeHost.remove())
    await page.evaluate(() => {
      const host = document.createElement('main')
      host.style.cssText = 'display:none;width:900px;height:600px'
      document.body.append(host)
      window.hiddenHost = host
      window.hiddenRuntime = window.createRuntime(host)
    })
    await page.waitForFunction(() => Boolean(window.hiddenRuntime.terminal._core._renderService._renderer.value._gl))
    const hiddenGrid = await page.evaluate(() => ({
      cols: window.hiddenRuntime.terminal.cols,
      rows: window.hiddenRuntime.terminal.rows
    }))
    assert.deepEqual(hiddenGrid, { cols: 80, rows: 24 }, 'hidden activation must not shrink the PTY grid')
    await page.evaluate(() => {
      window.hiddenRuntime.disposeCore()
      window.hiddenHost.remove()
    })
    assert.deepEqual(errors, [])

    const domPage = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
    await domPage.setContent('<main id="host" style="width:900px;height:600px"></main>')
    await domPage.evaluate(() => {
      window.fileterm = {
        platform: 'win32',
        writeDiagnosticLog: () => Promise.resolve(),
        writeTerminal: () => Promise.resolve()
      }
    })
    await domPage.addStyleTag({ path: stylesPath })
    await domPage.addScriptTag({ path: bundlePath })
    await domPage.evaluate(async () => document.fonts.ready)
    await domPage.evaluate(() => {
      window.domRuntime = window.createRuntime(document.getElementById('host'))
    })
    const defaultDom = await domPage.evaluate(() => ({
      rows: Boolean(window.domRuntime.terminal.element.querySelector('.xterm-rows')),
      webgl: Boolean(window.domRuntime.terminal._core._renderService._renderer.value._gl)
    }))
    assert.equal(defaultDom.rows, true)
    assert.equal(defaultDom.webgl, false)
    await domPage.evaluate(() => window.domRuntime.disposeCore())
    await domPage.close()

    const loadFailurePage = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
    const loadFailureErrors = []
    loadFailurePage.on('pageerror', (error) => loadFailureErrors.push(error.message))
    loadFailurePage.on('console', (message) => {
      if (message.type() === 'error') loadFailureErrors.push(message.text())
    })
    await loadFailurePage.setContent('<main id="host" style="width:900px;height:600px"></main>')
    await loadFailurePage.evaluate(() => {
      window.rendererLogs = []
      window.fileterm = {
        platform: 'win32',
        writeDiagnosticLog: (_level, _scope, message) => {
          window.rendererLogs.push(JSON.parse(message))
          return Promise.resolve()
        },
        writeTerminal: () => Promise.resolve()
      }
    })
    await loadFailurePage.addStyleTag({ path: stylesPath })
    await loadFailurePage.addScriptTag({ path: loadFailureBundlePath })
    await loadFailurePage.evaluate(async () => document.fonts.ready)
    await loadFailurePage.evaluate(() => {
      window.setTerminalRendererPreference('webgl')
      window.failedLoadHost = document.getElementById('host')
      window.failedLoadRuntime = window.createRuntime(window.failedLoadHost)
      window.failedLoadRuntime.terminal.write('WebGL load failure fallback 中文 ✻ ▢\r\n')
    })
    await loadFailurePage.waitForFunction(
      () =>
        window.rendererLogs.some(
          (entry) => entry.event === 'terminal-renderer' && entry.renderer === 'dom' && entry.reason === 'load-failed'
        ),
      undefined,
      { timeout: 10000 }
    )
    const loadFailureFallback = await loadFailurePage.evaluate(() => ({
      renderer: window.failedLoadRuntime.terminal._core._renderService._renderer.value.constructor.name,
      domRows: Boolean(window.failedLoadRuntime.terminal.element.querySelector('.xterm-rows')),
      text: window.failedLoadRuntime.terminal.buffer.active.getLine(0).translateToString(true)
    }))
    assert.equal(loadFailureFallback.domRows, true)
    assert.match(loadFailureFallback.text, /WebGL load failure fallback 中文/)
    assert.deepEqual(loadFailureErrors, [])
    await loadFailurePage.evaluate(() => window.failedLoadRuntime.disposeCore())

    writeFileSync(
      output,
      JSON.stringify(
        {
          environment: {
            engine: 'Playwright Chromium headless; not Tauri WebView2',
            browserVersion: browser.version(),
            gpu,
            gpuSource: 'Chromium CDP SystemInfo.getInfo'
          },
          active,
          blockGlyphFallback,
          contextLossFallback: fallback,
          failedActivationFallback: failedActivation,
          failedLoadFallback: loadFailureFallback,
          normalDispose,
          hiddenGrid,
          logs: await page.evaluate(() => window.rendererLogs),
          loadFailureLogs: await loadFailurePage.evaluate(() => window.rendererLogs)
        },
        null,
        2
      ) + '\n'
    )
    console.log(
      JSON.stringify({
        active,
        blockGlyphFallback,
        contextLossFallback: fallback,
        failedActivationFallback: failedActivation,
        failedLoadFallback: loadFailureFallback
      })
    )
  } finally {
    await browser.close()
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
