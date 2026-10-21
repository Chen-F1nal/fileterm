/* global window, WebGL2RenderingContext */
/** Test-only accounting of requested RGBA texture levels, not native/driver memory. */
export function installWebglTextureTrace() {
  const contexts = new WeakMap()
  const textures = new Map()
  const state = (gl) => {
    let value = contexts.get(gl)
    if (!value) contexts.set(gl, (value = { unit: gl.TEXTURE0, bindings: new Map() }))
    return value
  }
  const prototype = WebGL2RenderingContext.prototype
  for (const name of [
    'createTexture',
    'activeTexture',
    'bindTexture',
    'texImage2D',
    'generateMipmap',
    'deleteTexture'
  ]) {
    const original = prototype[name]
    prototype[name] = function (...args) {
      const result = original.apply(this, args)
      const current = state(this)
      if (name === 'createTexture' && result) textures.set(result, { levels: new Map(), unknown: false })
      if (name === 'activeTexture') current.unit = args[0]
      if (name === 'bindTexture' && args[0] === this.TEXTURE_2D) current.bindings.set(current.unit, args[1])
      const texture = textures.get(current.bindings.get(current.unit))
      if (name === 'texImage2D' && args[0] === this.TEXTURE_2D && texture) {
        const width = args.length === 6 ? args[5].width : args[3]
        const height = args.length === 6 ? args[5].height : args[4]
        const format = args.length === 6 ? args[3] : args[6]
        const type = args.length === 6 ? args[4] : args[7]
        if (format === this.RGBA && type === this.UNSIGNED_BYTE && Number.isFinite(width) && Number.isFinite(height))
          texture.levels.set(args[1], { width, height })
        else texture.unknown = true
      }
      if (name === 'generateMipmap' && args[0] === this.TEXTURE_2D && texture?.levels.has(0)) {
        let { width, height } = texture.levels.get(0)
        for (let level = 1; width > 1 || height > 1; level++) {
          width = Math.max(1, Math.floor(width / 2))
          height = Math.max(1, Math.floor(height / 2))
          texture.levels.set(level, { width, height })
        }
      }
      if (name === 'deleteTexture') {
        textures.delete(args[0])
        for (const [unit, bound] of current.bindings) if (bound === args[0]) current.bindings.delete(unit)
      }
      return result
    }
  }
  const describe = (texture) => {
    const value = textures.get(texture)
    return value
      ? {
          bytes: [...value.levels.values()].reduce((sum, level) => sum + level.width * level.height * 4, 0),
          levels: value.levels.size,
          unknown: value.unknown
        }
      : null
  }
  window.webglTextureTrace = {
    describe,
    snapshot: () => ({
      textures: textures.size,
      bytes: [...textures.keys()].reduce((sum, texture) => sum + describe(texture).bytes, 0),
      unknownTextures: [...textures.values()].filter((value) => value.unknown).length
    })
  }
}
