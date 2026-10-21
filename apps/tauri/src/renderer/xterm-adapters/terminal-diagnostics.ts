import type { Terminal } from '@xterm/xterm'
import { trackRendererWork } from '../lib/renderer-work-log'

type Parser = { parse(data: string | Uint8Array, promiseResult?: boolean): void | Promise<boolean> }
type Renderer = { renderRows(start: number, end: number): void; _gl?: unknown }
type DiagnosticTerminal = Terminal & {
  _core?: {
    _inputHandler?: Parser
    _renderService?: { _renderer?: { value?: Renderer } }
    _writeBuffer?: { _pendingData?: number }
  }
}
const readers = new Set<
  () => {
    normalBufferRows: number
    alternateBufferRows: number
    cellStorageBytesEstimate: number
    pendingWriteCharacters: number
    transcriptCharacters: number
    pendingXtermCharacters: number | null
    parserInstrumented: boolean
    rendererInstrumented: boolean
    tabId: string | null
    renderer: 'dom' | 'webgl' | 'unknown'
  }
>()

/** Guard the same xterm 6 internals used by the other adapters; restore exact methods on dispose. */
export function registerTerminalDiagnostics(
  terminal: Terminal,
  pendingWrite: { current: string },
  transcript: { current: string },
  tabId?: { current: string }
) {
  const core = (terminal as DiagnosticTerminal)._core
  const parser = core?._inputHandler
  const originalParse = typeof parser?.parse === 'function' ? parser.parse : undefined
  const parse = originalParse && trackRendererWork('xterm-parse', originalParse)
  if (parser && parse) parser.parse = parse
  let renderer: Renderer | undefined
  let originalRender: Renderer['renderRows'] | undefined
  let render: Renderer['renderRows'] | undefined
  const refreshRenderer = () => {
    const nextRenderer = core?._renderService?._renderer?.value
    if (renderer === nextRenderer) return
    if (renderer && render && originalRender && renderer.renderRows === render) renderer.renderRows = originalRender
    renderer = nextRenderer
    originalRender = typeof renderer?.renderRows === 'function' ? renderer.renderRows : undefined
    render = originalRender && trackRendererWork('xterm-render', originalRender)
    if (renderer && render) renderer.renderRows = render
  }
  refreshRenderer()
  const rendererSubscription = terminal.onRender(refreshRenderer)
  const read = () => ({
    tabId: tabId?.current ?? null,
    renderer: (renderer?._gl ? 'webgl' : terminal.element?.querySelector('.xterm-rows') ? 'dom' : 'unknown') as
      'dom' | 'webgl' | 'unknown',
    normalBufferRows: terminal.buffer.normal.length,
    alternateBufferRows: terminal.buffer.alternate.length,
    // xterm 6 uses three Uint32 words per cell; this excludes strings, capacity slack and native/GPU memory.
    cellStorageBytesEstimate: (terminal.buffer.normal.length + terminal.buffer.alternate.length) * terminal.cols * 12,
    pendingWriteCharacters: pendingWrite.current.length,
    transcriptCharacters: transcript.current.length,
    pendingXtermCharacters: core?._writeBuffer?._pendingData ?? null,
    parserInstrumented: Boolean(parse && core?._inputHandler?.parse === parse),
    rendererInstrumented: Boolean(
      render && core?._renderService?._renderer?.value === renderer && renderer?.renderRows === render
    )
  })
  readers.add(read)
  return {
    refreshRenderer,
    dispose() {
      readers.delete(read)
      if (parser && parser.parse === parse && originalParse) parser.parse = originalParse
      rendererSubscription.dispose()
      if (renderer && renderer.renderRows === render && originalRender) renderer.renderRows = originalRender
    }
  }
}

export function getTerminalResourceSnapshot() {
  const totals = {
    terminals: readers.size,
    byRenderer: { dom: 0, webgl: 0, unknown: 0 },
    perTerminal: [] as Array<{
      tabId: string | null
      renderer: string
      normalBufferRows: number
      alternateBufferRows: number
      pendingWriteCharacters: number
      pendingXtermCharacters: number | null
    }>,
    terminalsTruncated: readers.size > 8,
    normalBufferRows: 0,
    alternateBufferRows: 0,
    cellStorageBytesEstimate: 0,
    pendingWriteCharacters: 0,
    transcriptCharacters: 0,
    pendingXtermCharacters: 0,
    unknownXtermQueues: 0,
    instrumentedParsers: 0,
    instrumentedRenderers: 0
  }
  for (const read of readers) {
    const value = read()
    totals.byRenderer[value.renderer]++
    if (totals.perTerminal.length < 8)
      totals.perTerminal.push({
        tabId: value.tabId,
        renderer: value.renderer,
        normalBufferRows: value.normalBufferRows,
        alternateBufferRows: value.alternateBufferRows,
        pendingWriteCharacters: value.pendingWriteCharacters,
        pendingXtermCharacters: value.pendingXtermCharacters
      })
    totals.normalBufferRows += value.normalBufferRows
    totals.alternateBufferRows += value.alternateBufferRows
    totals.cellStorageBytesEstimate += value.cellStorageBytesEstimate
    totals.pendingWriteCharacters += value.pendingWriteCharacters
    totals.transcriptCharacters += value.transcriptCharacters
    totals.pendingXtermCharacters += value.pendingXtermCharacters ?? 0
    totals.unknownXtermQueues += Number(value.pendingXtermCharacters === null)
    totals.instrumentedParsers += Number(value.parserInstrumented)
    totals.instrumentedRenderers += Number(value.rendererInstrumented)
  }
  return totals
}
