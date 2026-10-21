import type { TerminalRenderer } from '@fileterm/core'

let terminalRenderer: TerminalRenderer = 'dom'

export function getTerminalRendererPreference() {
  return terminalRenderer
}

export function setTerminalRendererPreference(value: TerminalRenderer) {
  terminalRenderer = value
}
