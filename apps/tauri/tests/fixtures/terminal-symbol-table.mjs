// These widths are the table producer's contract, independent of xterm's provider.
export const terminalSymbolCases = [
  ['A', 1], // ASCII controls for both wall styles.
  ['A', 1],
  ['✻', 1],
  ['※', 1],
  ['①', 1],
  ['•', 1],
  ['○', 1],
  ['■', 1],
  ['§', 1],
  ['±', 1],
  ['×', 1],
  ['⚠', 1],
  ['✔', 1],
  ['✖', 1],
  ['⚠︎', 1],
  ['✅', 2],
  ['❌', 2],
  ['🚀', 2],
  ['🐛', 2],
  ['🔥', 2],
  ['⚠️', 2],
  ['✔️', 2],
  ['✖️', 2],
  ['ℹ️', 2],
  ['⚙️', 2],
  ['☁️', 2],
  ['©️', 2],
  ['®️', 2],
  ['™️', 2],
  ['1️⃣', 2],
  ['9️⃣', 2],
  ['#️⃣', 2],
  ['🇨🇳', 2],
  ['👍🏽', 2],
  ['👨‍💻', 2],
  ['🏳️‍⚧️', 2],
  ['👩🏽‍🚀', 2],
  ['👨‍👩‍👧‍👦', 2]
]

export const terminalSymbolTable = terminalSymbolCases
  .map(([glyph, width], index) => {
    const wall = index % 2 ? '│' : '|'
    return `${wall} ${glyph}${' '.repeat(8 - width)}${wall} Row${String(index).padStart(2, '0')}       ${wall}`
  })
  .join('\r\n')
