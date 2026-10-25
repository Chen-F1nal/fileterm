import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, context = {}) {
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      fileName: path,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
    }).outputText,
    { exports, ...context }
  )
  return exports
}

const utils = load('../src/renderer/app/app-shell-utils.ts')

function fixture(initialViewportWidth, initialSidebarWidth = utils.DEFAULT_SIDEBAR_WIDTH) {
  const listeners = new Map()
  const states = []
  const effects = []
  let stateIndex = 0
  let effectIndex = 0
  let preferredWidth = initialSidebarWidth
  const window = {
    innerWidth: initialViewportWidth,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(callback)
    },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback)
  }
  const hook = load('../src/renderer/hooks/use-app-resize.ts', {
    window,
    require(name) {
      if (name === '../app/app-shell-utils') return utils
      assert.equal(name, 'react')
      return {
        useCallback: (callback) => callback,
        useState(initialValue) {
          const index = stateIndex++
          if (!(index in states)) states[index] = typeof initialValue === 'function' ? initialValue() : initialValue
          return [
            states[index],
            (update) => {
              states[index] = typeof update === 'function' ? update(states[index]) : update
            }
          ]
        },
        useEffect(effect, dependencies) {
          const index = effectIndex++
          const previous = effects[index]
          if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return
          previous?.cleanup?.()
          effects[index] = { dependencies, cleanup: effect() }
        }
      }
    }
  })
  const render = () => {
    stateIndex = effectIndex = 0
    return hook.useAppResize({
      isHomeWorkspaceVisible: true,
      sidebarWidth: preferredWidth,
      setSidebarWidth: (update) => {
        preferredWidth = typeof update === 'function' ? update(preferredWidth) : update
      },
      workspace: { tabs: [] }
    })
  }
  return {
    render,
    resize(width) {
      window.innerWidth = width
      listeners.get('resize')?.forEach((callback) => callback())
      return render()
    },
    dispose: () => effects.forEach((effect) => effect.cleanup?.()),
    get preferredWidth() {
      return preferredWidth
    },
    get resizeListenerCount() {
      return listeners.get('resize')?.size ?? 0
    }
  }
}

test('a temporary startup viewport does not permanently shrink the default sidebar', () => {
  for (const width of [1, 800, 1120]) {
    const app = fixture(width)
    const initial = app.render()
    assert.equal(app.preferredWidth, 214)
    assert.equal(initial.expandedSidebarWidth, 190)
    assert.equal(app.resize(1280).expandedSidebarWidth, 214)
    assert.equal(app.preferredWidth, 214)
    app.dispose()
    assert.equal(app.resizeListenerCount, 0)
  }
})

test('the default width fits the supported minimum and default window sizes', () => {
  for (const width of [1150, 1280]) {
    const app = fixture(width)
    assert.equal(app.render().expandedSidebarWidth, 214)
    app.dispose()
  }
})

test('narrow windows temporarily constrain a manually widened sidebar', () => {
  const app = fixture(1280, 320)
  assert.equal(app.render().expandedSidebarWidth, 320)
  assert.equal(app.resize(1150).expandedSidebarWidth, 220)
  assert.equal(app.preferredWidth, 320)
  assert.equal(app.resize(1280).expandedSidebarWidth, 320)
  app.dispose()
})

test('a manually narrowed sidebar stays narrow when the window grows', () => {
  const app = fixture(1120, 190)
  assert.equal(app.render().expandedSidebarWidth, 190)
  assert.equal(app.resize(1280).expandedSidebarWidth, 190)
  assert.equal(app.preferredWidth, 190)
  app.dispose()
})

function renderWorkspace({ home = false, hostGroups = false, local = false, copilot = false, transfers = false } = {}) {
  const { AppMainWorkspace } = load('../src/renderer/features/layout/app-main-workspace.tsx', {
    require(name) {
      if (name.endsWith('.css')) return {}
      if (name === 'react/jsx-runtime') {
        const jsx = (type, props) => ({ type, props, children: [props.children].flat() })
        return { jsx, jsxs: jsx }
      }
      if (name === 'react') {
        return { useState: (value) => [value, () => {}], useEffect() {} }
      }
      if (name.endsWith('/use-host-navigation')) return { useHostNavigation: () => ({ groups: [] }) }
      if (name.endsWith('/shared-monitoring')) return { resolveMonitoringSource: () => ({ peers: [] }) }
      if (name.endsWith('/app-shell-utils')) return utils
      if (name.endsWith('/i18n')) return { t: {} }
      return {}
    }
  })
  return AppMainWorkspace({
    model: {
      shell: {
        workspace: { profiles: [], sessions: {} },
        sessionSecurity: {},
        sidebarWidth: 320,
        hostInfoWidth: 300,
        tabBarLayout: hostGroups ? 'host-groups' : 'horizontal'
      },
      workspace: {
        isHomeWorkspaceVisible: home,
        isLocalTerminalWorkspace: local,
        shouldShowAiCopilot: copilot,
        activeLocalTab: transfers ? { kind: 'transfers' } : home ? { kind: 'home' } : null,
        visibleWorkspaceTabs: [],
        localTabs: [],
        activeSidebarMetricOrder: [],
        activeSidebarMetrics: [],
        activeTerminalDockSendState: {}
      },
      data: {},
      resize: { expandedSidebarWidth: 220 }
    }
  }).children[0]
}

test('home and session titlebars and sidebars use the same constrained width', () => {
  for (const home of [false, true]) {
    const shell = renderWorkspace({ home })
    assert.equal(shell.props.style['--sidebar-width'], '220px')
    assert.equal(shell.props.style['--brand-width'], '220px')
  }
  const grouped = renderWorkspace({ hostGroups: true })
  assert.equal(grouped.props.style['--sidebar-width'], '300px')
  assert.equal(grouped.props.style['--host-rail-width'], '320px')
})

test('terminal edge frame stays mounted and is shown only for ordinary remote workspaces', () => {
  for (const options of [
    {},
    { home: true },
    { hostGroups: true },
    { local: true },
    { copilot: true },
    { transfers: true }
  ]) {
    const frame = renderWorkspace(options).children.find((child) =>
      child?.props?.className?.startsWith('terminal-right-frame')
    )
    assert.ok(frame)
    assert.equal(frame.props.className.includes('is-visible'), Object.keys(options).length === 0)
    assert.equal(frame.props['aria-hidden'], 'true')
  }
})
