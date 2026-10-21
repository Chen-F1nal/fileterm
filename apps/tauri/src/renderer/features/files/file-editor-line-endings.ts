import { editor } from 'monaco-editor'
import './file-editor-line-endings.css'

export function installFileEditorLineEndings(instance: editor.IStandaloneCodeEditor) {
  const decorations = instance.createDecorationsCollection()
  const update = () => {
    const model = instance.getModel()
    if (!model || instance.getOption(editor.EditorOption.renderWhitespace) === 'none') {
      decorations.clear()
      return
    }

    const crlf = model.getEOL() === '\r\n'
    const markers: editor.IModelDeltaDecoration[] = []
    // Only decorate visible lines, including the viewport's final terminating newline.
    for (const range of instance.getVisibleRanges()) {
      for (let line = range.startLineNumber; line <= range.endLineNumber && line < model.getLineCount(); line++) {
        const column = model.getLineMaxColumn(line)
        markers.push({
          range: { startLineNumber: line, endLineNumber: line, startColumn: column, endColumn: column },
          options: {
            showIfCollapsed: true,
            after: {
              content: crlf ? '↵' : '↓',
              inlineClassName: 'file-editor-line-ending',
              cursorStops: editor.InjectedTextCursorStops.None
            },
            hoverMessage: { value: crlf ? 'CRLF (\\r\\n)' : 'LF (\\n)' }
          }
        })
      }
    }
    decorations.set(markers)
  }

  const listeners = [
    instance.onDidChangeModelContent(update),
    instance.onDidChangeModel(update),
    instance.onDidScrollChange(update),
    instance.onDidLayoutChange(update),
    instance.onDidChangeConfiguration((event) => {
      if (event.hasChanged(editor.EditorOption.renderWhitespace)) update()
    }),
    instance.onDidDispose(() => {
      for (const listener of listeners) listener.dispose()
    })
  ]
  update()
}
