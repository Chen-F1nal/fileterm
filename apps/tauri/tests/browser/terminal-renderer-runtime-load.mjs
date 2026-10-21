/* global window, document, requestAnimationFrame */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const require = createRequire(import.meta.url)
const { build } = require(process.env.ESBUILD_MODULE_PATH || 'esbuild')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const batches = Number(process.env.FILETERM_RUNTIME_BATCHES || 3000)
const soakMs = Number(process.env.FILETERM_RUNTIME_SOAK_MS || 0)
const truecolor = process.env.FILETERM_RUNTIME_TRUECOLOR === '1'
const clearCycles = Number(process.env.FILETERM_RUNTIME_CLEAR_CYCLES || 0)
assert.ok(Number.isInteger(clearCycles) && clearCycles >= 0 && clearCycles <= 1000)
assert.ok(Number.isInteger(batches) && batches >= 100 && batches <= 20000)
assert.ok(Number.isInteger(soakMs) && soakMs >= 0 && soakMs <= 600000)
const output = resolve(process.env.FILETERM_RUNTIME_OUTPUT || join(tmpdir(), 'fileterm-renderer-runtime-load.json'))
const directory = mkdtempSync(join(tmpdir(), 'fileterm-renderer-runtime-load-'))
const bundle = join(directory, 'bundle.js')
const entry = `
import { createTerminalLifecycleRuntime } from './apps/tauri/src/renderer/components/terminal-lifecycle-core'
import { setTerminalRendererPreference } from './apps/tauri/src/renderer/app/terminal-renderer-preference'
import { getTerminalResourceSnapshot } from './apps/tauri/src/renderer/xterm-adapters/terminal-diagnostics'
import { getRendererWorkSnapshot, resetRendererWork } from './apps/tauri/src/renderer/lib/renderer-work-log'
import './apps/tauri/src/renderer/styles/index.css'
import '@xterm/xterm/css/xterm.css'
window.mountTerminal = renderer => {
  setTerminalRendererPreference(renderer)
  window.runtime = createTerminalLifecycleRuntime({
    hostRef: { current: document.getElementById('host') }, profileIdRef: { current: 'load-fixture' }, tabIdRef: { current: 'load-fixture' },
    terminalRef: { current: null }, fitAddonRef: { current: null }, searchAddonRef: { current: null },
    terminalLogColorizerRef: { current: null }, pendingWriteRef: { current: '' }, renderedTranscriptRef: { current: '' },
    isActiveRef: { current: true }, setTerminalScrollableElement: () => {}, isMac: false, isWindowsPty: false,
    buildTerminalTheme: () => ({ foreground: '#dddddd', background: '#111111' })
  })
}
window.resources = getTerminalResourceSnapshot
window.work = getRendererWorkSnapshot
window.resetWork = resetRendererWork
`
const results = []
let server
try {
  await build({
    stdin: { resolveDir: root, loader: 'ts', contents: entry },
    bundle: true,
    outfile: bundle,
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_FILETERM_TERMINAL_RENDERER': 'undefined' },
    loader: { '.svg': 'file', '.ttf': 'file', '.woff2': 'file', '.png': 'file' },
    logLevel: 'silent'
  })
  writeFileSync(
    join(directory, 'index.html'),
    '<link rel="stylesheet" href="/bundle.css"><main id="host" style="width:1000px;height:650px"></main><script src="/bundle.js"></script>'
  )
  server = createServer((request, response) => {
    const name = (request.url || '/').split('?')[0].slice(1) || 'index.html'
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      response.writeHead(404).end()
      return
    }
    try {
      const contentType = name.endsWith('.js')
        ? 'text/javascript'
        : name.endsWith('.css')
          ? 'text/css'
          : name.endsWith('.html')
            ? 'text/html'
            : 'application/octet-stream'
      const body = readFileSync(join(directory, name))
      response.writeHead(200, { 'Content-Type': contentType }).end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = 'http://127.0.0.1:' + server.address().port
  for (const backend of ['dom', 'webgl']) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      args: ['--enable-gpu', '--force-device-scale-factor=1.25', '--window-size=1200,900']
    })
    try {
      const browserCdp = await browser.newBrowserCDPSession()
      const { gpu } = await browserCdp.send('SystemInfo.getInfo')
      const page = await browser.newPage({ viewport: null })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Performance.enable')
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.addInitScript(() => {
        window.logs = []
        window.fileterm = {
          platform: 'win32',
          writeTerminal: () => Promise.resolve(),
          writeDiagnosticLog: (level, scope, message) => {
            window.logs.push({ level, scope, ...JSON.parse(message) })
            return Promise.resolve()
          }
        }
      })
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.evaluate(async (backend) => {
        await document.fonts.ready
        window.mountTerminal(backend)
      }, backend)
      await page.waitForFunction((backend) => window.resources().byRenderer[backend] === 1, backend)
      const measure = async () => {
        const metrics = Object.fromEntries(
          (await cdp.send('Performance.getMetrics')).metrics.map((item) => [item.name, item.value])
        )
        const processes = (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo
        let processGroupRssBytes = null
        if (process.platform !== 'win32') {
          try {
            processGroupRssBytes = execFileSync(
              'ps',
              ['-o', 'rss=', '-p', processes.map((item) => item.id).join(',')],
              { encoding: 'utf8' }
            )
              .trim()
              .split(/\s+/)
              .reduce((sum, value) => sum + Number(value) * 1024, 0)
          } catch {
            /* A process can exit between CDP and ps. */
          }
        }
        return {
          at: Date.now(),
          heapUsedBytes: metrics.JSHeapUsedSize,
          nodes: metrics.Nodes,
          taskSeconds: metrics.TaskDuration,
          processGroupRssBytes,
          processes: processes.map(({ id, type, cpuTime }) => ({ id, type, cpuTime })),
          ...(await page.evaluate(() => ({
            resources: window.resources(),
            mountedElements: document.getElementsByTagName('*').length
          })))
        }
      }
      await cdp.send('HeapProfiler.collectGarbage')
      const before = await measure()
      await page.evaluate(() => window.resetWork())
      const load = await page.evaluate(
        async ({ batches, truecolor }) => {
          const terminal = window.runtime.terminal
          const write = (data) => new Promise((resolve) => terminal.write(data, resolve))
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
          window.writeFixtureBatch = async (index) => {
            const cjk = Array.from({ length: 16 }, (_, column) =>
              String.fromCodePoint(0x4e00 + ((index * 13 + column) % 2048))
            ).join('')
            const color = truecolor
              ? '38;2;' + [80 + (index % 176), 80 + (Math.floor(index / 176) % 176), 160].join(';')
              : String(31 + (index % 7))
            const line = '\x1b[' + color + 'm✻ Working ' + index + ' ' + cjk + ' █▀▄▌▐ ─│ 🧪\x1b[0m\r\n'
            const data = line.repeat(4)
            await write(data)
            return data.length
          }
          const started = performance.now()
          let characters = 0
          const atlasSamples = []
          for (let index = 0; index < batches; index++) {
            characters += await window.writeFixtureBatch(index)
            if (index % 10 === 0) await frame()
            if (index % 250 === 0)
              atlasSamples.push({ batch: index, bytes: window.resources().uniqueWebglAtlasBytesEstimate })
          }
          await frame()
          return { elapsedMs: performance.now() - started, batches, characters, atlasSamples, work: window.work() }
        },
        { batches, truecolor }
      )
      const atlasClearProbe =
        backend === 'webgl' && clearCycles
          ? await page.evaluate(async (cycles) => {
              const terminal = window.runtime.terminal
              terminal.options.fontSize += 1
              window.runtime.fitAddon.fit()
              terminal.reset()
              await new Promise((resolve) =>
                terminal.write('Working Cache probe ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\r\n', resolve)
              )
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
              const glyphs = () =>
                terminal._core._renderService._renderer.value._charAtlas.pages.reduce(
                  (sum, page) => sum + page.glyphs.length,
                  0
                )
              const before = glyphs()
              const samples = []
              for (let cycle = 0; cycle < cycles; cycle++) {
                terminal.clearTextureAtlas()
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                if (cycle % 10 === 0 || cycle === cycles - 1) samples.push({ cycle, glyphs: glyphs() })
              }
              return { before, samples, after: glyphs() }
            }, clearCycles)
          : null
      if (atlasClearProbe)
        assert.ok(
          atlasClearProbe.after <= atlasClearProbe.before * 2,
          'repeated atlas clears must release obsolete glyph objects'
        )
      const afterLoad = await measure()
      const samples = [before, afterLoad]
      if (backend === 'webgl' && soakMs) {
        const pendingSoak = page.evaluate(
          async ({ soakMs, batches }) => {
            const until = performance.now() + soakMs
            let index = batches
            while (performance.now() < until) {
              await window.writeFixtureBatch(index++)
              if (index % 100 === 0) {
                const host = document.getElementById('host')
                host.style.width = index % 200 === 0 ? '1000px' : '920px'
                window.runtime.fitAddon.fit()
              }
              await new Promise((resolve) => setTimeout(resolve, 20))
            }
            return { batches: index - batches, work: window.work() }
          },
          { soakMs, batches }
        )
        const until = Date.now() + soakMs
        while (Date.now() < until) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(5000, until - Date.now())))
          const sample = await measure()
          samples.push(sample)
          assert.equal(
            sample.resources.byRenderer.webgl,
            1,
            'selected WebGL must remain active during mixed block/CJK output'
          )
          console.log(
            JSON.stringify({
              backend,
              elapsedMs: sample.at - afterLoad.at,
              heapMiB: sample.heapUsedBytes / 1048576,
              groupRssMiB: sample.processGroupRssBytes / 1048576,
              atlasMiB: sample.resources.uniqueWebglAtlasBytesEstimate / 1048576
            })
          )
        }
        load.soak = await pendingSoak
      }
      await cdp.send('HeapProfiler.collectGarbage')
      const afterGc = await measure()
      const resources = await page.evaluate(() => {
        const terminal = window.runtime.terminal
        return {
          ...window.resources(),
          lastLine: terminal.buffer.active
            .getLine(terminal.buffer.active.baseY + terminal.buffer.active.cursorY - 1)
            ?.translateToString(true)
        }
      })
      assert.equal(resources.byRenderer[backend], 1)
      if (truecolor && backend === 'webgl')
        assert.ok(
          Math.max(
            resources.uniqueWebglAtlasBytesEstimate,
            ...load.atlasSamples.map((sample) => sample.bytes),
            ...samples.map((sample) => sample.resources.uniqueWebglAtlasBytesEstimate)
          ) <=
            96 * 1024 * 1024,
          'fixed-size RGB fixture must recycle historical glyph variants instead of growing without a bound'
        )
      if (truecolor && soakMs >= 60000) {
        const late = samples
          .slice(1 + Math.floor((samples.length - 1) / 2))
          .map((sample) => sample.resources.uniqueWebglAtlasBytesEstimate)
        assert.ok(
          Math.max(...late) - Math.min(...late) <= 4 * 1024 * 1024,
          'RGB atlas backing must plateau in the second half of sustained output'
        )
      }
      assert.ok(resources.normalBufferRows <= 6000 + 80)
      assert.equal(resources.pendingXtermCharacters, 0)
      assert.match(resources.lastLine, /Working/)
      await page.evaluate(() => {
        window.runtime.disposeCore()
        window.runtime = null
        window.writeFixtureBatch = null
        document.getElementById('host').remove()
      })
      const disposedResources = await page.evaluate(() => window.resources())
      assert.equal(disposedResources.terminals, 0)
      await cdp.send('HeapProfiler.collectGarbage')
      const disposed = await measure()
      assert.deepEqual(errors, [])
      const result = {
        backend,
        truecolor,
        atlasClearProbe,
        browser: browser.version(),
        gpu: summarizeGpu(gpu),
        load,
        samples,
        afterGc,
        resources,
        disposed
      }
      results.push(result)
      writeFileSync(output, JSON.stringify({ results }, null, 2))
      console.log(JSON.stringify({ backend, elapsedMs: load.elapsedMs, resources, output }))
    } finally {
      await browser.close()
    }
  }
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  rmSync(directory, { recursive: true, force: true })
}
