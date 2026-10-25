import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, context = {}) {
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
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
    assert.equal(initial.homeSidebarWidth, 190)
    assert.equal(app.resize(1280).homeSidebarWidth, 214)
    assert.equal(app.preferredWidth, 214)
    app.dispose()
    assert.equal(app.resizeListenerCount, 0)
  }
})

test('the default width fits the supported minimum and default window sizes', () => {
  for (const width of [1150, 1280]) {
    const app = fixture(width)
    assert.equal(app.render().homeSidebarWidth, 214)
    app.dispose()
  }
})

test('narrow windows temporarily constrain a manually widened sidebar', () => {
  const app = fixture(1280, 320)
  assert.equal(app.render().homeSidebarWidth, 320)
  assert.equal(app.resize(1150).homeSidebarWidth, 220)
  assert.equal(app.preferredWidth, 320)
  assert.equal(app.resize(1280).homeSidebarWidth, 320)
  app.dispose()
})

test('a manually narrowed sidebar stays narrow when the window grows', () => {
  const app = fixture(1120, 190)
  assert.equal(app.render().homeSidebarWidth, 190)
  assert.equal(app.resize(1280).homeSidebarWidth, 190)
  assert.equal(app.preferredWidth, 190)
  app.dispose()
})
