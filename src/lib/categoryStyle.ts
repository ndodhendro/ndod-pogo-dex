import type { CSSProperties } from 'react'

export const FALLBACK_EMOJI = '📌'
export const DEFAULT_LABEL_COLOR = '#6ee7b7'

export function firstGrapheme(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      .segment(text)
      [Symbol.iterator]()
      .next().value
    return first?.segment ?? ''
  }
  return [...text][0] ?? ''
}

function lastGrapheme(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let last = ''
    for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
      last = part.segment
    }
    return last
  }
  return [...text].at(-1) ?? ''
}

/** Keep a single emoji when the keyboard appends instead of replacing. */
export function pickEmojiInput(previous: string, next: string): string {
  if (!next.trim()) return ''
  if (previous && next.startsWith(previous) && next.length > previous.length) {
    return lastGrapheme(next.slice(previous.length)) || firstGrapheme(next)
  }
  return firstGrapheme(next)
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw)
  if (short) {
    const [r, g, b] = short[1]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(raw)
  return full ? `#${full[1].toLowerCase()}` : null
}

export type HsvColor = { h: number; s: number; v: number }

function hexToRgb(hex: string) {
  const n = normalizeHexColor(hex) ?? DEFAULT_LABEL_COLOR
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

export function hexToHsv(hex: string): HsvColor {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function categoryChromeStyle(color: string): CSSProperties {
  const hex = normalizeHexColor(color) ?? DEFAULT_LABEL_COLOR
  return {
    '--tone': hex,
    '--tone-fill': hex,
    '--tone-soft': hexToRgba(hex, 0.12),
  } as CSSProperties
}
