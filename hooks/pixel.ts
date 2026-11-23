// Pixel drawing for the backdrop: a 5 by 7 bitmap font, and digit reels that move with CSS alone.
// The picture is only drawn again when a figure really changes (the app shows a redraw as a flash), so
// anything that keeps time, the clock, the turn timer and the idle counter, is a reel or a hand that CSS
// carries on. A reel is told how far along it already is with a negative animation-delay.

export const MONO = "Consolas,'Cascadia Mono','Courier New',monospace"

/** The glyphs, rows top to bottom, `1` for a lit square. Only letters, digits and a few marks are drawn. */
const GLYPHS: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01110/10001/10000/10000/10000/10001/01110',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01110/10001/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '01110/00100/00100/00100/00100/00100/01110',
  J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00010/01100',
  ':': '00000/00100/00100/00000/00100/00100/00000',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  $: '00100/01111/10100/01110/00101/11110/00100',
  '.': '00000/00000/00000/00000/00000/01100/01100',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '/': '00001/00010/00010/00100/01000/01000/10000',
  '>': '01000/00100/00010/00001/00010/00100/01000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
}

/** A glyph's lit squares as one path, each row's runs merged into one rectangle. */
function glyphPath(rows: string): string {
  let path = ''
  rows.split('/').forEach((row, line) => {
    let column = 0
    while (column < row.length) {
      if (row[column] !== '1') {
        column += 1
        continue
      }
      let end = column
      while (end < row.length && row[end] === '1') {
        end += 1
      }
      path += `M${column} ${line}h${end - column}v1h-${end - column}z`
      column = end
    }
  })

  return path
}

export const round = (value: number): number => Math.round(value * 10) / 10

/** The glyphs and ids one picture uses: text and reels ask for what they need, `defs` draws only those. */
export class Kit {
  private readonly used = new Set<string>()
  private serial = 0

  /** A fresh id for a clip path. */
  id(prefix: string): string {
    this.serial += 1

    return `${prefix}${this.serial}`
  }

  private glyphId(char: string): string {
    this.used.add(char)

    return `g${char.charCodeAt(0)}`
  }

  defs(): string {
    return [...this.used].map(char => `<g id="g${char.charCodeAt(0)}"><path d="${glyphPath(GLYPHS[char] ?? '')}"/></g>`).join('')
  }

  /** The width in pixels of a string at a scale: each glyph is five squares and a gap of one. */
  width(text: string, scale: number): number {
    return Math.max(0, text.length * 6 - 1) * scale
  }

  /** Text in the pixel font. `x` is the left edge, the centre or the right edge, by `anchor`. */
  text(text: string, x: number, y: number, scale: number, fill: string, anchor: 'start' | 'middle' | 'end' = 'start'): string {
    const left = anchor === 'start' ? x : anchor === 'middle' ? x - this.width(text, scale) / 2 : x - this.width(text, scale)
    let uses = ''
    ;[...text.toUpperCase()].forEach((char, index) => {
      if (GLYPHS[char] !== undefined) {
        uses += `<use href="#${this.glyphId(char)}" x="${index * 6}"/>`
      }
    })

    return `<g fill="${fill}" transform="translate(${round(left)} ${round(y)}) scale(${scale})">${uses}</g>`
  }

  /**
   * One digit of a counter that CSS turns on its own: a strip of faces behind a window, stepped along so the
   * face is right at the moment the picture is drawn and changes at the right moments after, with no redraw.
   * `cycleSeconds` is how long the whole strip takes, `elapsed` how far into the cycle it already is, `glyphs` how
   * many characters wide a face is.
   */
  counting(faces: readonly string[], x: number, y: number, scale: number, fill: string, cycleSeconds: number, elapsed: number, glyphs = 1): string {
    const cell = 7 * scale
    const clip = this.id('c')
    const strip = faces.map((face, index) => this.text(face, 0, index * cell, scale, fill)).join('')
    const lag = round(elapsed % cycleSeconds)
    // Where the strip rests when animation is off: on the face that is current at this moment.
    const at = Math.floor((lag / cycleSeconds) * faces.length) % faces.length

    return (
      `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${(glyphs * 6 - 1) * scale}" height="${cell}"/></clipPath>` +
      `<g clip-path="url(#${clip})"><g transform="translate(${x} ${y})"><g class="tick" style="transform:translateY(${-at * cell}px);--far:-${faces.length * cell}px;animation-duration:${cycleSeconds}s;animation-delay:-${lag}s;animation-timing-function:steps(${faces.length})">${strip}</g></g></g>`
    )
  }

  /**
   * One digit that rolls once, from the face it showed before to the face it shows now, like an odometer.
   */
  rolling(faces: readonly string[], from: number, to: number, x: number, y: number, scale: number, fill: string, delayMs: number): string {
    const cell = 7 * scale
    const clip = this.id('r')
    const strip = faces.map((face, index) => this.text(face, 0, index * cell, scale, fill)).join('')

    return (
      `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${5 * scale}" height="${cell}"/></clipPath>` +
      `<g clip-path="url(#${clip})"><g transform="translate(${x} ${y})"><g class="roll" style="--from:${-from * cell}px;--to:${-to * cell}px;transform:translateY(${-to * cell}px);animation-delay:${delayMs}ms">${strip}</g></g></g>`
    )
  }
}

/** A rectangle with its four corners notched, drawn as bars: the pixel look of a rounded box. */
export function frame(x: number, y: number, width: number, height: number, stroke: string, thickness = 3): string {
  const t = thickness

  return (
    `<g fill="${stroke}">` +
    `<rect x="${x + t}" y="${y}" width="${width - 2 * t}" height="${t}"/>` +
    `<rect x="${x + t}" y="${y + height - t}" width="${width - 2 * t}" height="${t}"/>` +
    `<rect x="${x}" y="${y + t}" width="${t}" height="${height - 2 * t}"/>` +
    `<rect x="${x + width - t}" y="${y + t}" width="${t}" height="${height - 2 * t}"/>` +
    `</g>`
  )
}

/** A bitmap as rectangles, each row's runs of one letter merged. `.` is empty. */
export function bitmap(rows: readonly string[], x: number, y: number, size: number, colors: Record<string, string>): string {
  let drawn = ''
  rows.forEach((row, line) => {
    let column = 0
    while (column < row.length) {
      const letter = row[column] ?? '.'
      if (letter === '.') {
        column += 1
        continue
      }
      let end = column
      while (end < row.length && row[end] === letter) {
        end += 1
      }
      drawn += `<rect x="${x + column * size}" y="${y + line * size}" width="${(end - column) * size}" height="${size}" fill="${colors[letter] ?? '#ffffff'}"/>`
      column = end
    }
  })

  return drawn
}
