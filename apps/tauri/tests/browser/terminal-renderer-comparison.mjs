/* global window, document, requestAnimationFrame */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { cpus, release, tmpdir, totalmem, version } from 'node:os'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { loadTypeScript } from './helpers/load-typescript.mjs'
import { summarizeGpu } from './helpers/terminal-renderer-environment.mjs'
import { registerComparisonGridCalibration, readComparisonGridMetrics } from './helpers/terminal-grid-calibration.mjs'

// The application only bundles this dev dependency when the Windows renderer test flag is set.
const root = fileURLToPath(new URL('../../../../', import.meta.url))
const gridMode = process.env.FILETERM_GRID_MODE || 'comparison'
assert.ok(['comparison', 'production'].includes(gridMode), 'FILETERM_GRID_MODE must be comparison or production')
const webglBundle = resolve(root + 'node_modules/@xterm/addon-webgl/lib/addon-webgl.js')
const addonVersion = JSON.parse(readFileSync(resolve(dirname(webglBundle), '../package.json'))).version
assert.equal(addonVersion, '0.19.0')
const output = resolve(process.env.FILETERM_COMPARISON_OUTPUT || join(tmpdir(), 'fileterm-renderer-comparison.json'))
const screenshotDirectory = join(tmpdir(), 'fileterm-renderer-validation')
mkdirSync(screenshotDirectory, { recursive: true })
mkdirSync(dirname(output), { recursive: true })
const normalBatchCount = Number(process.env.FILETERM_BATCH_COUNT || 4000)
// shortcut: keep the 6x Windows probe under its 180s browser timeout; raise it with the timeout if it completes faster.
const throttledBatchCount = Number(process.env.FILETERM_THROTTLED_BATCH_COUNT || 200)
const repeats = Number(process.env.FILETERM_COMPARISON_REPEATS || 3)
const slowdowns = (process.env.FILETERM_COMPARISON_SLOWDOWNS || '1,6').split(',').map(Number)
assert.ok(Number.isInteger(normalBatchCount) && normalBatchCount >= 200)
assert.ok(Number.isInteger(throttledBatchCount) && throttledBatchCount >= 200)
assert.ok(Number.isInteger(repeats) && repeats > 0)
assert.ok(slowdowns.every((rate) => Number.isFinite(rate) && rate >= 1))
assert.equal(process.platform, 'win32', 'Windows process-tree sampling is required for this comparison')
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright')
const results = []
const percentile = (values, fraction) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * fraction) - 1]
}

function createHostProcessSampler() {
  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public sealed class FileTermProcessEntry {
  public int ProcessId;
  public int ParentProcessId;
  public string Name;
}

public static class FileTermProcessSnapshot {
  private const uint SnapshotProcesses = 0x00000002;
  private static readonly IntPtr InvalidHandle = new IntPtr(-1);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct ProcessEntry32 {
    public uint Size;
    public uint Usage;
    public uint ProcessId;
    public UIntPtr DefaultHeapId;
    public uint ModuleId;
    public uint Threads;
    public uint ParentProcessId;
    public int BasePriority;
    public uint Flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string Name;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", EntryPoint = "Process32FirstW", ExactSpelling = true, CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool Process32First(IntPtr snapshot, ref ProcessEntry32 entry);
  [DllImport("kernel32.dll", EntryPoint = "Process32NextW", ExactSpelling = true, CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry32 entry);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool CloseHandle(IntPtr handle);

  public static List<FileTermProcessEntry> GetEntries() {
    IntPtr snapshot = CreateToolhelp32Snapshot(SnapshotProcesses, 0);
    if (snapshot == InvalidHandle) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      var entries = new List<FileTermProcessEntry>();
      var entry = new ProcessEntry32 { Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32)) };
      if (!Process32First(snapshot, ref entry)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      do {
        entries.Add(new FileTermProcessEntry {
          ProcessId = (int)entry.ProcessId,
          ParentProcessId = (int)entry.ParentProcessId,
          Name = entry.Name
        });
        entry.Size = (uint)Marshal.SizeOf(typeof(ProcessEntry32));
      } while (Process32Next(snapshot, ref entry));
      return entries;
    } finally {
      CloseHandle(snapshot);
    }
  }
}
'@
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line -eq 'quit') { break }
  try {
    $request = $line | ConvertFrom-Json
    $rootPid = [int]$request.rootPid
    $cdpTypes = @{}
    foreach ($item in $request.cdpProcesses) { $cdpTypes[[int]$item.id] = [string]$item.type }
    $all = [FileTermProcessSnapshot]::GetEntries()
    $children = @{}
    foreach ($item in $all) {
      $parent = [int]$item.ParentProcessId
      if (-not $children.ContainsKey($parent)) { $children[$parent] = [System.Collections.Generic.List[int]]::new() }
      $children[$parent].Add([int]$item.ProcessId)
    }
    $queue = [System.Collections.Generic.Queue[int]]::new()
    $ids = [System.Collections.Generic.List[int]]::new()
    $queue.Enqueue($rootPid)
    while ($queue.Count -gt 0) {
      $id = $queue.Dequeue()
      $ids.Add($id)
      foreach ($child in $children[$id]) { $queue.Enqueue($child) }
    }
    $byPid = @{}
    foreach ($item in $all) { $byPid[[int]$item.ProcessId] = $item }
    $rows = @(
      foreach ($id in $ids) {
        $item = $byPid[$id]
        if (-not $item) { continue }
        $type = [string]$cdpTypes[$id]
        if ($id -eq $rootPid) { $type = 'browser' }
        elseif (-not $type) { $type = 'other' }
        try {
          $proc = Get-Process -Id $id -ErrorAction Stop
          [pscustomobject]@{
            pid = $id
            type = $type
            parentPid = [int]$item.ParentProcessId
            processName = [string]$item.Name
            creationTime = $proc.StartTime.ToUniversalTime().Ticks
            workingSetBytes = [double]$proc.WorkingSet64
            privateBytes = [double]$proc.PrivateMemorySize64
            cpuSeconds = if ($null -ne $proc.CPU) { [double]$proc.CPU } else { $null }
          }
        } catch {
          [pscustomobject]@{
            pid = $id
            type = $type
            parentPid = [int]$item.ParentProcessId
            processName = [string]$item.Name
            creationTime = $null
            workingSetBytes = $null
            privateBytes = $null
            cpuSeconds = $null
          }
        }
      }
    )
    $payload = @{ status = 'available'; rootPid = $rootPid; processes = $rows }
  } catch {
    $payload = @{ status = 'unavailable'; reason = 'process-query-failed'; processes = @() }
  }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}
`
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: ['pipe', 'pipe', 'ignore'],
    windowsHide: true
  })
  const output = createInterface({ input: child.stdout })
  let closed = false
  let pending
  const unavailable = (reason = 'sampler-error') => ({ status: 'unavailable', reason, processes: [] })
  const settle = (value) => {
    if (!pending) return
    clearTimeout(pending.timer)
    pending.resolve(value)
    pending = undefined
  }

  output.on('line', (line) => {
    try {
      settle(JSON.parse(line))
    } catch {
      settle(unavailable('invalid-sampler-output'))
    }
  })
  child.on('error', () => {
    closed = true
    settle(unavailable())
  })
  child.on('close', () => {
    closed = true
    settle(unavailable())
  })

  return {
    sample(rootPid, cdpProcesses) {
      if (!Number.isInteger(rootPid)) return Promise.resolve(unavailable('browser-root-pid-missing'))
      if (closed) return Promise.resolve(unavailable())
      const startedAt = performance.now()
      return new Promise((resolve) => {
        pending = {
          resolve: (value) => resolve({ ...value, sampleDurationMs: performance.now() - startedAt }),
          timer: setTimeout(() => settle(unavailable('sampler-timeout')), 10000)
        }
        child.stdin.write(`${JSON.stringify({ rootPid, cdpProcesses })}\n`, (error) => {
          if (error) settle(unavailable())
        })
      })
    },
    async dispose() {
      if (closed) return
      child.stdin.end('quit\n')
      await new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill()
          resolve()
        }, 1000)
        child.once('close', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}

const maximum = (values) => {
  const measured = values.filter(Number.isFinite)
  return measured.length ? Math.max(...measured) : null
}

async function run(mode, slowdown, repetition) {
  const batchCount = slowdown > 1 ? throttledBatchCount : normalBatchCount
  const browserServer = await chromium.launchServer({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    args: ['--enable-gpu']
  })
  const browserProcessId = browserServer.process()?.pid ?? null
  let browser
  const processSampler = createHostProcessSampler()
  try {
    browser = await chromium.connect(browserServer.wsEndpoint())
    const browserCdp = await browser.newBrowserCDPSession()
    const { gpu: rawGpu } = await browserCdp.send('SystemInfo.getInfo')
    const gpu = summarizeGpu(rawGpu)
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.setContent('<main id="panes" style="display:grid;grid-template-columns:repeat(2,1fr)"></main>')
    await page.addStyleTag({ path: root + 'node_modules/@xterm/xterm/css/xterm.css' })
    await page.addStyleTag({ path: root + 'apps/tauri/src/renderer/xterm-adapters/xterm-compat.css' })
    const font = readFileSync(
      root + 'apps/tauri/src/renderer/assets/fonts/text/jetbrains-mono/JetBrainsMono-400.ttf'
    ).toString('base64')
    await page.addStyleTag({
      content: `@font-face {font-family: 'Benchmark Mono';src:url(data:font/ttf;base64,${font})}`
    })
    await page.evaluate(() => document.fonts.load('14px "Benchmark Mono"'))
    for (const path of [
      'node_modules/@xterm/xterm/lib/xterm.js',
      'node_modules/@xterm/addon-unicode11/lib/addon-unicode11.js'
    ])
      await page.addScriptTag({ path: root + path })
    // Load the same JS in both arms so bundle parsing does not bias setup memory.
    await page.addScriptTag({ path: webglBundle })
    for (const [file, symbol] of [
      ['bridge/events/terminal-output', ['createTerminalOutputDelivery', 'getTerminalOutputProgress']],
      ['renderer/xterm-adapters/terminal-symbol-glyph-renderer', 'registerTerminalSymbolGlyphRenderer'],
      ['renderer/xterm-adapters/terminal-block-glyph-renderer', 'registerTerminalBlockGlyphRenderer'],
      ['renderer/xterm-adapters/terminal-selection-renderer', 'registerTerminalSelectionRenderer'],
      ['renderer/xterm-adapters/terminal-foreground-adapter', 'registerTerminalForegroundAdapter'],
      ['renderer/xterm-adapters/terminal-render-cache', 'registerTerminalRenderCacheLimits'],
      ['renderer/xterm-adapters/terminal-log-colorizer', 'TerminalLogColorizer'],
      ['renderer/xterm-adapters/terminal-emoji-widths', 'registerTerminalEmojiWidths'],
      ['renderer/xterm-adapters/terminal-options', 'getTerminalCompatibilityOptions'],
      ['renderer/xterm-adapters/terminal-webgl-grid', 'registerTerminalWebglGrid']
    ])
      await loadTypeScript(page, root + 'apps/tauri/src/' + file + '.ts', symbol)
    const actions = ts.transpileModule(
      readFileSync(root + 'apps/tauri/src/renderer/components/terminal-view-actions.ts', 'utf8').replaceAll(
        'import.meta.env.DEV',
        'false'
      ),
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }
    ).outputText
    await page.addScriptTag({
      content: `(() => {const exports = {}; const require = name => name === 'react' ? {useCallback: callback => callback} : name === './terminal-view-utils' ? {TERMINAL_WRITE_CHUNK_SIZE:16384,splitPaneShortcutsForPlatform:()=>({})} : {}; ${actions}; window.createOutputActions=exports.useTerminalViewActions;})()`
    })
    await page.addScriptTag({
      content: `window.registerComparisonGridCalibration=${registerComparisonGridCalibration};window.readComparisonGridMetrics=${readComparisonGridMetrics};`
    })
    await page.evaluate((gridMode) => (window.gridMode = gridMode), gridMode)
    await page.evaluate(async (mode) => {
      const ref = (current) => ({ current })
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
      const terminals = []
      const adapters = []
      const addons = []
      const listeners = new Set()
      window.contextLosses = 0
      window.inputSamples = []
      for (let index = 0; index < 10; index++) {
        const host = document.createElement('div')
        host.className = 'terminal-host'
        host.style.height = '220px'
        document.getElementById('panes').append(host)
        const terminal = new window.Terminal({
          ...window.getTerminalCompatibilityOptions(false),
          cols: 90,
          rows: 10,
          scrollback: 6000,
          fontFamily: 'Benchmark Mono',
          fontSize: 14,
          lineHeight: 1.05,
          cursorBlink: false,
          allowProposedApi: true,
          allowTransparency: true,
          theme: { foreground: '#dddddd', background: '#111111' }
        })
        terminal.loadAddon(new window.Unicode11Addon.Unicode11Addon())
        terminal.unicode.activeVersion = '11'
        adapters.push(window.registerTerminalEmojiWidths(terminal))
        terminal.open(host)
        const style = window.getComputedStyle(terminal.element)
        if (
          style.getPropertyValue('text-spacing-trim') !== 'space-all' ||
          style.getPropertyValue('text-autospace') !== 'no-autospace'
        )
          throw new Error('Production terminal typography CSS is not active')
        if (mode === 'webgl') {
          const addon = new window.WebglAddon.WebglAddon()
          addon.onContextLoss(() => window.contextLosses++)
          terminal.loadAddon(addon)
          addons.push(addon)
          if (terminal._core._renderService._renderer.value !== addon._renderer || !addon._renderer._gl) {
            throw new Error('WebGL addon did not replace the renderer')
          }
        }
        if (window.gridMode === 'comparison') adapters.push(window.registerComparisonGridCalibration(terminal, mode))
        else if (mode === 'webgl') adapters.push(window.registerTerminalWebglGrid(terminal))
        if (mode === 'dom') {
          if (!terminal.element.querySelector('.xterm-rows')) throw new Error('DOM renderer missing')
          adapters.push(window.registerTerminalSelectionRenderer(terminal))
          adapters.push(window.registerTerminalSymbolGlyphRenderer(terminal))
          adapters.push(window.registerTerminalBlockGlyphRenderer(terminal))
        }
        adapters.push(window.registerTerminalRenderCacheLimits(terminal))
        adapters.push(window.registerTerminalForegroundAdapter(terminal))
        adapters.push(
          new window.TerminalLogColorizer(
            terminal,
            Object.fromEntries(
              [
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
              ].map((key) => [key, '#aabbcc'])
            )
          )
        )
        const state = {
          terminalRef: ref(terminal),
          pendingWriteRef: ref(''),
          pendingWriteCompletionsRef: ref([]),
          isWritingRef: ref(false),
          transcriptReplayGenerationRef: ref(0)
        }
        const { scheduleTerminalWrite } = window.createOutputActions(state)
        listeners.add((payload) => (payload.tabId === String(index) ? scheduleTerminalWrite(payload.chunk) : undefined))
        terminals.push(state)
      }
      window.snapshot = () => {
        const pages = addons.flatMap((addon) => addon._renderer?._charAtlas?.pages.map((page) => page.canvas) ?? [])
        const gl = addons[0]?._renderer?._gl
        const debug = gl?.getExtension('WEBGL_debug_renderer_info')
        return {
          grid: terminals[0] ? window.readComparisonGridMetrics(terminals[0].terminalRef.current) : null,
          webglContext: gl
            ? {
                vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
                renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
                version: gl.getParameter(gl.VERSION),
                contextLost: gl.isContextLost(),
                viewport: Array.from(gl.getParameter(gl.VIEWPORT)),
                bufferWidth: gl.drawingBufferWidth,
                bufferHeight: gl.drawingBufferHeight
              }
            : null,
          sent: window.sent,
          acknowledged: window.acknowledged,
          outputProgress: window.getTerminalOutputProgress(),
          pendingCharacters: terminals.reduce((sum, state) => sum + state.pendingWriteRef.current.length, 0),
          pendingCompletions: terminals.reduce(
            (sum, state) => sum + state.pendingWriteCompletionsRef.current.length,
            0
          ),
          pendingXterm: terminals.reduce(
            (sum, state) => sum + state.terminalRef.current._core._writeBuffer._pendingData,
            0
          ),
          domNodes: document.getElementsByTagName('*').length,
          contextLosses: window.contextLosses,
          coloringFailures: adapters.filter((adapter) => adapter.failed === true).length,
          // Per-context RGBA atlas estimate excludes buffers, drivers, and other GPU allocations.
          atlasTextureBytes: pages.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0),
          sharedAtlasCanvasBytes: [...new Set(pages)].reduce(
            (sum, canvas) => sum + canvas.width * canvas.height * 4,
            0
          ),
          inputCount: window.inputSamples.length,
          historyLines: terminals.map((state) => state.terminalRef.current.buffer.normal.length)
        }
      }
      function registerInputProbe(target) {
        let keyStarted = null
        target.element.addEventListener(
          'keydown',
          (event) => {
            keyStarted = { eventAt: event.timeStamp, handlerAt: performance.now() }
          },
          true
        )
        target.onData((data) => {
          if (!keyStarted) return
          const sample = keyStarted
          keyStarted = null
          target.write(data, () => {
            sample.parsedAt = performance.now()
            requestAnimationFrame(() => {
              window.inputSamples.push({
                dispatchMs: sample.handlerAt - sample.eventAt,
                parseMs: sample.parsedAt - sample.eventAt,
                nextFrameMs: performance.now() - sample.eventAt
              })
            })
          })
        })
        target.focus()
      }
      registerInputProbe(terminals[0].terminalRef.current)
      const deliver = window.createTerminalOutputDelivery(
        listeners,
        async () => window.acknowledged++,
        () => {}
      )
      window.startLoad = (total) => {
        window.sent = 0
        window.acknowledged = 0
        window.bytes = 0
        window.done = false
        const pump = () => {
          while (window.sent < total && window.sent - window.acknowledged < 4) {
            const index = window.sent++
            const chunk =
              '\x1b[H\x1b[2J' +
              Array.from(
                { length: 9 },
                (_, row) => `\x1b[${row + 1};1H\x1b[37m▢ 中文 tool ${index} ✻ ${'─'.repeat(55)}\x1b[0m`
              ).join('')
            window.bytes += new TextEncoder().encode(chunk).length
            deliver({ tabId: String(index % 10), deliveryId: index, chunk })
          }
          if (window.acknowledged < total) setTimeout(pump, 0)
          else requestAnimationFrame(() => requestAnimationFrame(() => (window.done = true)))
        }
        pump()
      }
      const history = Array.from(
        { length: 6500 },
        (_, index) => `history ${index} info service: completed 中文\r\n`
      ).join('')
      await Promise.all(
        terminals.map((state) => new Promise((resolve) => state.terminalRef.current.write(history, resolve)))
      )
      await frame()
      await frame()
      window.disposeTerminals = async () => {
        adapters.reverse().forEach((adapter) => adapter.dispose())
        terminals.forEach((state) => state.terminalRef.current.dispose())
        adapters.length = 0
        terminals.length = 0
        addons.length = 0
        listeners.clear()
        document.getElementById('panes').replaceChildren()
        await frame()
        await frame()
      }
    }, mode)
    await page.evaluate(() => window.startLoad(200))
    await page.waitForFunction(() => window.done, undefined, { timeout: 120000 })
    await cdp.send('HeapProfiler.collectGarbage')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown })
    const sample = async () => {
      const { processInfo: cdpProcesses } = await browserCdp.send('SystemInfo.getProcessInfo')
      const processTree = await processSampler.sample(browserProcessId, cdpProcesses)
      if (
        processTree.status === 'available' &&
        !processTree.processes.some((entry) => entry.pid === browserProcessId && entry.type === 'browser')
      ) {
        processTree.status = 'invalid-root'
        processTree.reason = 'browser-server-process-not-in-sampled-tree'
      }
      const { metrics } = await cdp.send('Performance.getMetrics')
      const heap = await cdp.send('Runtime.getHeapUsage')
      return {
        at: performance.now(),
        heap,
        cdpProcesses,
        processTree,
        metrics: Object.fromEntries(metrics.map(({ name, value }) => [name, value])),
        page: await page.evaluate(() => window.snapshot())
      }
    }
    const baseline = await sample()
    const samples = [baseline]
    await page.evaluate((total) => window.startLoad(total), batchCount)
    let finished = false
    const completion = page
      .waitForFunction(() => window.done, undefined, { timeout: 180000 })
      .then(() => (finished = true))
    const sampler = (async () => {
      while (!finished) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (!finished) {
          samples.push(await sample())
          if (samples.length % 10 === 0)
            console.log(
              JSON.stringify({
                event: 'progress',
                mode,
                slowdown,
                repetition,
                acknowledged: samples.at(-1).page.acknowledged
              })
            )
        }
      }
    })()
    const inputWallMs = []
    while (!finished) {
      const started = performance.now()
      await page.keyboard.press('x')
      inputWallMs.push(performance.now() - started)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    await completion
    const end = await sample()
    samples.push(end)
    await sampler
    const inputs = await page.evaluate(() => window.inputSamples)
    assert.ok(inputs.length >= 10, 'load must include enough real terminal key events')
    assert.ok(
      inputs.every(
        (value) => value.dispatchMs >= 0 && value.parseMs >= value.dispatchMs && value.nextFrameMs >= value.parseMs
      )
    )
    assert.equal(end.page.sent, batchCount)
    assert.equal(end.page.acknowledged, batchCount)
    assert.equal(end.page.pendingCharacters, 0)
    assert.equal(end.page.pendingCompletions, 0)
    assert.equal(end.page.pendingXterm, 0)
    if (gridMode === 'production' && end.page.webglContext) {
      const context = end.page.webglContext
      assert.deepEqual(context.viewport, [0, 0, context.bufferWidth, context.bufferHeight])
    }
    assert.equal(end.page.outputProgress.parsedBatches - baseline.page.outputProgress.parsedBatches, batchCount)
    assert.equal(
      end.page.outputProgress.acknowledgedBatches - baseline.page.outputProgress.acknowledgedBatches,
      batchCount
    )
    assert.equal(end.page.outputProgress.pendingAcknowledgements, 0)
    assert.equal(end.page.outputProgress.parseFailures, 0)
    assert.equal(end.page.outputProgress.ackFailures, 0)
    assert.equal(end.page.contextLosses, 0)
    assert.equal(end.page.coloringFailures, 0)
    assert.deepEqual(errors, [])
    assert.ok(baseline.page.historyLines.every((length) => length === 6010))
    const cpu = {}
    const memoryTotalMiB = (value, key, type) => {
      const processes = value.processTree.processes.filter(
        (process) => !type || process.type.toLowerCase() === type.toLowerCase()
      )
      const measured = processes.filter((process) => Number.isFinite(process[key]))
      return measured.length ? measured.reduce((sum, process) => sum + process[key], 0) / 1048576 : null
    }
    const memoryMissingCount = (value, key) =>
      value.processTree.processes.filter((process) => !Number.isFinite(process[key])).length
    const elapsedMs = end.at - baseline.at
    const baselineTree = new Map(baseline.processTree.processes.map((process) => [process.pid, process]))
    const processTreeCpuSeconds =
      end.processTree.status === 'available' && baseline.processTree.status === 'available'
        ? end.processTree.processes.reduce((sum, process) => {
            const previous = baselineTree.get(process.pid)
            if (
              process.cpuSeconds === null ||
              previous?.cpuSeconds === null ||
              previous?.cpuSeconds === undefined ||
              previous.creationTime !== process.creationTime
            )
              return sum
            const delta = Math.max(0, process.cpuSeconds - previous.cpuSeconds)
            cpu[process.type] = (cpu[process.type] ?? 0) + delta
            return sum + delta
          }, 0)
        : null
    const processTreeCpuUnmeasuredCount =
      end.processTree.status === 'available' && baseline.processTree.status === 'available'
        ? end.processTree.processes.filter((process) => {
            const previous = baselineTree.get(process.pid)
            return (
              process.cpuSeconds === null ||
              previous?.cpuSeconds === null ||
              previous?.cpuSeconds === undefined ||
              previous.creationTime !== process.creationTime
            )
          }).length
        : null
    await cdp.send('HeapProfiler.collectGarbage')
    const retained = await sample()
    // Keep visual verification outside the measured phase.
    const screenshot = join(
      screenshotDirectory,
      `${basename(output).replace(/\.json$/i, '')}-${mode}-${slowdown}-${repetition}.png`
    )
    await page.screenshot({ path: screenshot })
    await page.evaluate(() => window.disposeTerminals())
    await page.waitForTimeout(1000)
    await cdp.send('HeapProfiler.collectGarbage')
    const disposed = await sample()
    assert.ok(disposed.page.domNodes < 100)
    return {
      mode,
      gridCalibration:
        gridMode === 'production' ? 'native-renderer-grids-integer-webgl-atlas' : 'webgl-device-pixel-grid',
      screenshot,
      slowdown,
      repetition,
      browserVersion: browser.version(),
      browserProcessId,
      gpu,
      rendererContext: end.page.webglContext,
      batchCount,
      outputBytes: await page.evaluate(() => window.bytes),
      elapsedMs,
      cpuSeconds: cpu,
      totalCpuSeconds: Object.values(cpu).reduce((sum, value) => sum + value, 0),
      processTreeCpuSeconds,
      processTreeCpuUnmeasuredCount,
      processTreeCpuPercentOneCore:
        processTreeCpuSeconds === null ? null : (processTreeCpuSeconds / (elapsedMs / 1000)) * 100,
      taskSeconds: end.metrics.TaskDuration - baseline.metrics.TaskDuration,
      layoutSeconds: end.metrics.LayoutDuration - baseline.metrics.LayoutDuration,
      styleRecalculationSeconds: Number.isFinite(end.metrics.RecalcStyleDuration)
        ? end.metrics.RecalcStyleDuration - baseline.metrics.RecalcStyleDuration
        : null,
      paintSeconds: Number.isFinite(end.metrics.PaintDuration)
        ? end.metrics.PaintDuration - baseline.metrics.PaintDuration
        : null,
      peakPendingAcknowledgements: maximum(samples.map((value) => value.page.outputProgress.pendingAcknowledgements)),
      peakPendingParseBatches: maximum(samples.map((value) => value.page.outputProgress.pendingBatches)),
      maxAcknowledgementWaitMs: maximum(samples.map((value) => value.page.outputProgress.maxAckElapsedMs)),
      maxSinceLastParseMs: maximum(samples.map((value) => value.page.outputProgress.sinceLastParsedMs)),
      processTreeStatus: end.processTree.status,
      baselineWorkingSetMiB: memoryTotalMiB(baseline, 'workingSetBytes'),
      baselineWorkingSetUnmeasuredProcesses: memoryMissingCount(baseline, 'workingSetBytes'),
      peakWorkingSetMiB: maximum(samples.map((value) => memoryTotalMiB(value, 'workingSetBytes'))),
      endWorkingSetMiB: memoryTotalMiB(end, 'workingSetBytes'),
      endWorkingSetUnmeasuredProcesses: memoryMissingCount(end, 'workingSetBytes'),
      retainedWorkingSetMiB: memoryTotalMiB(retained, 'workingSetBytes'),
      disposedWorkingSetMiB: memoryTotalMiB(disposed, 'workingSetBytes'),
      peakPrivateBytesMiB: maximum(samples.map((value) => memoryTotalMiB(value, 'privateBytes'))),
      peakRendererWorkingSetMiB: maximum(samples.map((value) => memoryTotalMiB(value, 'workingSetBytes', 'renderer'))),
      peakBrowserWorkingSetMiB: maximum(samples.map((value) => memoryTotalMiB(value, 'workingSetBytes', 'browser'))),
      peakGpuWorkingSetMiB: maximum(samples.map((value) => memoryTotalMiB(value, 'workingSetBytes', 'gpu'))),
      maxProcessSamplerMs: maximum(samples.map((value) => value.processTree.sampleDurationMs)),
      baselineHeapMiB: baseline.metrics.JSHeapUsedSize / 1048576,
      peakHeapMiB: Math.max(...samples.map((value) => value.metrics.JSHeapUsedSize / 1048576)),
      retainedHeapMiB: retained.metrics.JSHeapUsedSize / 1048576,
      disposedHeapMiB: disposed.metrics.JSHeapUsedSize / 1048576,
      baselineBackingMiB: baseline.heap.backingStorageSize / 1048576,
      peakBackingMiB: Math.max(...samples.map((value) => value.heap.backingStorageSize / 1048576)),
      disposedBackingMiB: disposed.heap.backingStorageSize / 1048576,
      peakAtlasTextureMiB: Math.max(...samples.map((value) => value.page.atlasTextureBytes / 1048576)),
      peakSharedAtlasCanvasMiB: Math.max(...samples.map((value) => value.page.sharedAtlasCanvasBytes / 1048576)),
      inputCount: inputs.length,
      inputLatency: Object.fromEntries(
        ['dispatchMs', 'parseMs', 'nextFrameMs'].map((key) => [
          key,
          {
            p50: percentile(
              inputs.map((value) => value[key]),
              0.5
            ),
            p95: percentile(
              inputs.map((value) => value[key]),
              0.95
            ),
            max: Math.max(...inputs.map((value) => value[key]))
          }
        ])
      ),
      inputTransportP95Ms: percentile(inputWallMs, 0.95),
      baseline: baseline.page,
      end: end.page,
      disposed: disposed.page,
      samples,
      inputs
    }
  } finally {
    await processSampler.dispose()
    await browser?.close()
    await browserServer.close()
  }
}

for (const slowdown of slowdowns) {
  for (let repetition = 1; repetition <= repeats; repetition++) {
    for (const mode of repetition % 2 ? ['dom', 'webgl'] : ['webgl', 'dom']) {
      console.log(JSON.stringify({ event: 'start', mode, slowdown, repetition }))
      const result = await run(mode, slowdown, repetition)
      const peer = results.find(
        (row) => row.repetition === repetition && row.slowdown === slowdown && row.mode !== mode
      )
      if (peer)
        for (const key of gridMode === 'production'
          ? ['measuredWidth', 'cols', 'rows']
          : ['measuredWidth', 'cellWidth', 'cellHeight', 'canvasWidth', 'canvasHeight', 'cols', 'rows'])
          assert.equal(result.baseline.grid[key], peer.baseline.grid[key], `paired grid ${key}`)
      results.push(result)
      writeFileSync(
        output,
        JSON.stringify(
          {
            addonVersion,
            environment: {
              engine: 'Playwright Chromium headless',
              platform: process.platform,
              osRelease: release(),
              osVersion: version(),
              architecture: process.arch,
              logicalCpuCount: cpus().length,
              totalMemoryBytes: totalmem(),
              gpuSource: 'Chromium CDP SystemInfo.getInfo per comparison run'
            },
            results
          },
          null,
          2
        ) + '\n'
      )
      console.log(
        JSON.stringify({
          event: 'result',
          ...Object.fromEntries(Object.entries(result).filter(([key]) => !['samples', 'inputs'].includes(key)))
        })
      )
    }
  }
}
