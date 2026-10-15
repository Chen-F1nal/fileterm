import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function fixture({ supportsLongTasks = false } = {}) {
  let now = 0
  let callback
  let reset
  let cleared = false
  let longTaskCallback
  let observerDisconnected = false
  const calls = []
  const document = {
    hidden: false,
    hasFocus: () => true,
    querySelectorAll: () => Array(10),
    getElementsByTagName: () => Array(8000),
    addEventListener: (_, listener) => {
      reset = listener
    },
    removeEventListener: (_, listener) => {
      assert.equal(listener, reset)
      reset = undefined
    }
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL('../src/renderer/lib/renderer-performance-log.ts', import.meta.url), 'utf8'),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
      }
    ).outputText,
    {
      exports,
      document,
      performance: { now: () => now, memory: { usedJSHeapSize: 1234, totalJSHeapSize: 4567 } },
      PerformanceObserver: supportsLongTasks
        ? class {
            static supportedEntryTypes = ['longtask']
            constructor(callback) {
              longTaskCallback = callback
            }
            observe(options) {
              assert.equal(options.type, 'longtask')
            }
            disconnect() {
              observerDisconnected = true
            }
          }
        : undefined,
      window: {
        fileterm: { appVersion: '2.2.31', platform: 'win32' },
        __TAURI_INTERNALS__: { callbacks: new Map([[1, () => {}]]) },
        setInterval: (listener, interval) => {
          assert.equal(interval, 1000)
          callback = listener
          return 7
        },
        clearInterval: (timer) => {
          assert.equal(timer, 7)
          cleared = true
        }
      },
      require: () => ({
        DIAGNOSTIC_SCOPES: { performance: 'renderer:performance' },
        writeDiagnosticLog: (...args) => calls.push(args)
      })
    }
  )
  const dispose = exports.installRendererPerformanceLogging()
  return {
    calls,
    document,
    dispose,
    get cleared() {
      return cleared
    },
    get observerDisconnected() {
      return observerDisconnected
    },
    longTasks: (...durations) => longTaskCallback({ getEntries: () => durations.map((duration) => ({ duration })) }),
    tick: (elapsed) => {
      now += elapsed
      callback()
    },
    visibility: () => reset()
  }
}

test('recovered foreground stalls log WARN without an exception and are rate limited', () => {
  const f = fixture()
  f.tick(1000)
  assert.equal(f.calls.length, 0)
  f.tick(5000)
  assert.equal(f.calls[0][0], 'WARN')
  assert.equal(f.calls[0][1], 'renderer:performance')
  assert.equal(JSON.parse(f.calls[0][2]).elapsedMs, 5000)
  f.tick(5000)
  assert.equal(f.calls.length, 1)
  f.tick(30000)
  assert.equal(f.calls.length, 2)
  f.dispose()
  assert.equal(f.cleared, true)
})

test('hidden timer throttling and the transition back to foreground are ignored', () => {
  const f = fixture()
  f.document.hidden = true
  f.tick(60000)
  f.document.hidden = false
  f.visibility()
  f.tick(1000)
  assert.equal(f.calls.length, 0)
  f.tick(4000)
  assert.equal(f.calls.length, 1)
  f.dispose()
})

test('minute health reports include bounded counters without terminal contents', () => {
  const f = fixture()
  for (let index = 0; index < 60; index++) f.tick(1000)
  assert.equal(f.calls.length, 1)
  const health = JSON.parse(f.calls[0][2])
  assert.equal(health.event, 'renderer-health')
  assert.equal(health.uptimeMs, 60000)
  assert.equal(health.usedJSHeapBytes, 1234)
  assert.equal(health.totalJSHeapBytes, 4567)
  assert.equal(health.ipcCallbackCount, 1)
  assert.equal(health.terminalCount, 10)
  assert.equal(health.domNodeCount, 8000)
  assert.equal(health.maxEventLoopGapMs, 1000)
  assert.equal(health.longTaskCount, undefined)
  f.dispose()
})

test('long task summaries reset each minute and across visibility, then disconnect', () => {
  const f = fixture({ supportsLongTasks: true })
  f.longTasks(50, 123)
  for (let index = 0; index < 60; index++) f.tick(1000)
  const health = JSON.parse(f.calls[0][2])
  assert.equal(health.longTaskCount, 2)
  assert.equal(health.longTaskTotalMs, 173)
  assert.equal(health.maxLongTaskMs, 123)
  f.document.hidden = true
  f.longTasks(999)
  f.document.hidden = false
  f.visibility()
  for (let index = 0; index < 60; index++) f.tick(1000)
  assert.equal(JSON.parse(f.calls[1][2]).longTaskCount, 0)
  f.dispose()
  assert.equal(f.observerDisconnected, true)
})
