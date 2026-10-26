export function createTerminalModifierTapTracker() {
  let pressedKey: string | null = null
  let usedInChord = false
  let lastTapKey: string | null = null
  let lastTapAt = 0
  const reset = () => {
    pressedKey = lastTapKey = null
    usedInChord = false
    lastTapAt = 0
  }
  return {
    reset,
    keyDown(event: KeyboardEvent) {
      if (event.repeat) return
      if (event.key === 'Control' || event.key === 'Meta') {
        if (pressedKey) usedInChord = true
        else {
          pressedKey = event.key
          usedInChord = event.altKey || event.shiftKey || (event.key === 'Control' ? event.metaKey : event.ctrlKey)
        }
      } else if (pressedKey) usedInChord = true
      else lastTapKey = null
    },
    keyUp(event: KeyboardEvent) {
      if (event.key !== pressedKey) return false
      pressedKey = null
      if (usedInChord) {
        reset()
        return false
      }
      const now = Date.now()
      const isDoubleTap = event.key === lastTapKey && now - lastTapAt < 400
      lastTapKey = isDoubleTap ? null : event.key
      lastTapAt = now
      return isDoubleTap
    }
  }
}
