import type { Terminal } from '@xterm/xterm'
import { trackRendererWork } from '../lib/renderer-work-log'

type Parser = { parse(data: string | Uint8Array, promiseResult?: boolean): void | Promise<boolean> }
type Renderer = { renderRows(start: number, end: number): void }
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
  }
>()

/** Guard the same xterm 6 internals used by the other adapters; restore exact methods on dispose. */
export function registerTerminalDiagnostics(
  terminal: Terminal,
  pendingWrite: { current: string },
  transcript: { current: string }
) {
  const core = (terminal as DiagnosticTerminal)._core
  const parser = core?._inputHandler
  const renderer = core?._renderService?._renderer?.value
  const originalParse = typeof parser?.parse === 'function' ? parser.parse : undefined
  const originalRender = typeof renderer?.renderRows === 'function' ? renderer.renderRows : undefined
  const parse = originalParse && trackRendererWork('xterm-parse', originalParse)
  const render = originalRender && trackRendererWork('xterm-render', originalRender)
  if (parser && parse) parser.parse = parse
  if (renderer && render) renderer.renderRows = render
  const read = () => ({
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
    dispose() {
      readers.delete(read)
      if (parser && parser.parse === parse && originalParse) parser.parse = originalParse
      if (renderer && renderer.renderRows === render && originalRender) renderer.renderRows = originalRender
    }
  }
}

export function getTerminalResourceSnapshot() {
  const totals = {
    terminals: readers.size,
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
