/* global getComputedStyle */
// Serializable browser probe: measure the actual painted focus surface against every clipping ancestor.
export function inspectFocusShadow(control) {
  const wrapper = control.closest(
    '.ft-input-wrapper, .ft-select-shell, .connection-manager-search, .pane-filter-input-wrapper, .ai-copilot-conversation-search, .command-param-chip'
  )
  const surfaces = wrapper && wrapper !== control ? [control, wrapper] : [control]
  const result = []
  for (const surface of surfaces) {
    const style = getComputedStyle(surface)
    const layers = style.boxShadow.split(/,(?![^()]*\))/).filter((layer) => {
      if (layer.includes('inset') || layer.trim() === 'none') return false
      const color = layer
        .match(/rgba?\(([^)]*)\)/)?.[1]
        .split(/[, /]+/)
        .filter(Boolean)
      return !color || color.length < 4 || Number(color[3]) > 0
    })
    if (!layers.length) continue
    const r = surface.getBoundingClientRect()
    const extent = { left: 0, right: 0, top: 0, bottom: 0 }
    for (const layer of layers) {
      const [x = 0, y = 0, blur = 0, spread = 0] = (
        layer.replace(/rgba?\([^)]*\)/g, '').match(/-?\d+(?:\.\d+)?px/g) || []
      ).map(parseFloat)
      const radius = Math.max(0, spread) + blur * 1.5
      extent.left = Math.max(extent.left, radius - x)
      extent.right = Math.max(extent.right, radius + x)
      extent.top = Math.max(extent.top, radius - y)
      extent.bottom = Math.max(extent.bottom, radius + y)
    }
    const clips = []
    for (let parent = surface.parentElement; parent; parent = parent.parentElement) {
      const ps = getComputedStyle(parent)
      if (ps.display === 'contents') continue
      const rect = parent.getBoundingClientRect()
      const left = rect.left + parseFloat(ps.borderLeftWidth || '0')
      const top = rect.top + parseFloat(ps.borderTopWidth || '0')
      const gaps = {
        left: r.left - left,
        right: left + parent.clientWidth - r.right,
        top: r.top - top,
        bottom: top + parent.clientHeight - r.bottom
      }
      for (const edge of ['left', 'right', 'top', 'bottom']) {
        const overflow = edge === 'left' || edge === 'right' ? ps.overflowX : ps.overflowY
        if (['hidden', 'clip', 'auto', 'scroll'].includes(overflow) && gaps[edge] + 0.75 < extent[edge]) {
          clips.push({
            ancestor: parent.className || parent.tagName,
            edge,
            space: Math.round(gaps[edge] * 100) / 100,
            needed: extent[edge]
          })
        }
      }
    }
    result.push({ surface: surface.className || surface.tagName, shadow: style.boxShadow, clips })
  }
  return result
}
