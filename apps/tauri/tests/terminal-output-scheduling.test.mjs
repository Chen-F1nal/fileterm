import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
const chunkSize = 16 * 1024
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../src/renderer/components/terminal-view-actions.ts', import.meta.url), 'utf8').replaceAll(
      'import.meta.env.DEV',
      'false'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  {
    exports,
    queueMicrotask,
    document: { documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    window: {
      requestAnimationFrame: () => {
        throw new Error('Output must drain even when animation frames are suspended')
      }
    },
    require: (name) => {
      if (name === 'react') return { useCallback: (callback) => callback }
      if (name === '../app/terminal-log-colorizer') return { getTerminalLogColorPalette: (theme) => theme }
      if (name === './terminal-view-utils')
        return {
          TERMINAL_WRITE_CHUNK_SIZE: chunkSize,
          splitPaneShortcutsForPlatform: () => ({}),
          trimTranscript: (value) => value,
          toDisplayTerminalText: (value) => value,
          logTerminalRender: () => {}
        }
      if (
        [
          '@fileterm/core',
          '../app/app-utils',
          '../app/terminal-log-colorizer',
          '../app/ui-zoom',
          '../app/terminal-font-size-store',
          '../i18n'
        ].includes(name)
      )
        return {}
      throw new Error(`Unexpected import ${name}`)
    }
  }
)

function fixture() {
  const writes = []
  const callbacks = []
  const terminal = {
    reset: () => {},
    write: (text, callback) => {
      writes.push(text)
      callbacks.push(callback)
    }
  }
  const refs = {
    terminalRef: { current: terminal },
    pendingWriteRef: { current: '' },
    pendingWriteCompletionsRef: { current: [] },
    isWritingRef: { current: false },
    transcriptReplayGenerationRef: { current: 0 },
    renderedTranscriptRef: { current: '' },
    replayingTranscriptRef: { current: false },
    tabIdRef: { current: 'tab' },
    suppressHydratedChunksUntilRef: { current: 0 }
  }
  const { scheduleTerminalWrite, replaceTerminalWithTranscript } = exports.useTerminalViewActions(refs)
  return { ...refs, writes, callbacks, scheduleTerminalWrite, replaceTerminalWithTranscript }
}

test('idle terminal output reaches xterm without waiting for an animation frame', () => {
  const f = fixture()
  f.scheduleTerminalWrite('prompt> ')
  assert.deepEqual(f.writes, ['prompt> '])
  assert.equal(f.isWritingRef.current, true)
})

test('parsing completion drains bounded chunks in order with animation frames suspended', async () => {
  const f = fixture()
  const first = 'A'.repeat(chunkSize + 10)
  f.scheduleTerminalWrite(first)
  f.scheduleTerminalWrite('B')
  assert.deepEqual(f.writes, ['A'.repeat(chunkSize)])
  assert.equal(f.pendingWriteRef.current, 'A'.repeat(10) + 'B')
  f.callbacks.shift()()
  await Promise.resolve()
  assert.equal(f.writes.join(''), first + 'B')
  f.callbacks.shift()()
  assert.equal(f.pendingWriteRef.current, '')
  assert.equal(f.isWritingRef.current, false)
})

test('late parser callbacks cannot change a replacement terminal or transcript replay', () => {
  for (const replace of ['terminal', 'transcript']) {
    const f = fixture()
    f.scheduleTerminalWrite('old')
    if (replace === 'terminal') f.terminalRef.current = null
    else f.transcriptReplayGenerationRef.current++
    f.pendingWriteRef.current = 'new'
    f.callbacks.shift()()
    assert.equal(f.isWritingRef.current, true)
    assert.equal(f.pendingWriteRef.current, 'new')
    assert.deepEqual(f.writes, ['old'])
  }
})

test('credit resolves after the full batch is parsed, including combined writes', async () => {
  const f = fixture()
  let completed = 0
  const first = f.scheduleTerminalWrite('A'.repeat(chunkSize + 10)).then(() => completed++)
  const second = f.scheduleTerminalWrite('B').then(() => completed++)
  f.callbacks.shift()()
  await Promise.resolve()
  assert.equal(completed, 0)
  f.callbacks.shift()()
  await Promise.all([first, second])
  assert.equal(completed, 2)
  assert.equal(f.pendingWriteCompletionsRef.current.length, 0)
})

test('transcript replacement settles discarded output without credit leaking', async () => {
  const f = fixture()
  const first = f.scheduleTerminalWrite('old')
  const second = f.scheduleTerminalWrite('older pending')
  f.replaceTerminalWithTranscript(f.terminalRef.current, 'snapshot')
  await Promise.all([first, second])
  assert.equal(f.pendingWriteCompletionsRef.current.length, 0)
  const next = f.scheduleTerminalWrite('new')
  f.callbacks.shift()()
  assert.equal(f.pendingWriteCompletionsRef.current.length, 1)
  f.callbacks.shift()()
  f.callbacks.shift()()
  await next
  assert.equal(f.pendingWriteCompletionsRef.current.length, 0)
})

test('unchanged terminal themes do not invalidate contrast caches or repaint history', () => {
  const f = fixture()
  let themes = 0
  let recolors = 0
  let refreshes = 0
  let currentTheme
  f.terminalRef.current.options = {
    get theme() {
      return currentTheme
    },
    set theme(theme) {
      currentTheme = theme
      themes++
    }
  }
  f.terminalRef.current.rows = 24
  f.terminalRef.current.refresh = () => refreshes++
  f.terminalLogColorizerRef = { current: { setPalette: () => recolors++ } }
  const { applyTerminalTheme } = exports.useTerminalViewActions(f)
  for (let index = 0; index < 100; index++) applyTerminalTheme()
  assert.equal(themes, 1)
  assert.equal(recolors, 1)
  assert.equal(refreshes, 1)
  currentTheme.foreground = '#123456'
  applyTerminalTheme()
  assert.equal(themes, 2)
  assert.equal(recolors, 2)
})
