import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText,
    { exports, require: (name) => dependencies[name] ?? {} }
  )
  return exports
}
const { scopeTransfersToSession } = load('../src/renderer/features/transfers/transfer-scope.ts')
const { buildOrderedTabs, parseStoredMainTabUiState } = load('../src/renderer/hooks/workspace-tabs-utils.ts', {
  '../i18n': { t: { untitledTab: 'Home' } }
})

test('server copies are visible from both endpoints without leaking to unrelated sessions', () => {
  const copy = { id: 'copy', tabId: 'b', profileId: 'B', copySource: { tabId: 'a', profileId: 'A' } }
  const sessions = [
    { id: 'a', profileId: 'A' },
    { id: 'b', profileId: 'B' },
    { id: 'c', profileId: 'C' }
  ]
  assert.equal(scopeTransfersToSession([copy], 'a', 'A', sessions)[0], copy)
  assert.equal(scopeTransfersToSession([copy], 'b', 'B', sessions)[0], copy)
  assert.equal(scopeTransfersToSession([copy], 'c', 'C', sessions).length, 0)
})

test('file transfer tab survives saved UI state while invalid endpoint fields are rejected', () => {
  const tab = { id: 'file-transfers', kind: 'transfers', title: 'Files', initialTabId: 'a', initialPath: '/srv' }
  const state = parseStoredMainTabUiState(
    JSON.stringify({ localTabs: [tab], activeLocalTabId: tab.id, tabOrder: [`home:${tab.id}`] })
  )
  assert.equal(state.localTabs[0].initialPath, '/srv')
  assert.equal(buildOrderedTabs(state.tabOrder, state.localTabs, [])[0].tabKind, 'transfers')
  const invalid = parseStoredMainTabUiState(JSON.stringify({ localTabs: [{ ...tab, initialTabId: {} }] }))
  assert.equal(invalid.localTabs.length, 0)
})
