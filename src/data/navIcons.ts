import type { TagId } from '../lib/tags'

export type UiTone =
  | 'inbox'
  | 'dex'
  | 'settings'
  | 'living'
  | TagId
  | 'default'
  | 'alolan'
  | 'galarian'
  | 'hisuian'
  | 'paldean'
  | 'mega'

export const TAB_ICONS = {
  inbox: '📥',
  dex: '📒',
  settings: '⚙️',
} as const

export const TAG_ICONS: Record<TagId, string> = {
  shiny: '✨',
  shadow: '🌑',
  purified: '💎',
  costume: '🎭',
  background: '🖼️',
  hundo: '💯',
  nundo: '0️⃣',
}

export const CATEGORY_ICONS: Record<string, string> = {
  Living: '🌿',
  Shiny: TAG_ICONS.shiny,
  Shadow: TAG_ICONS.shadow,
  Purified: TAG_ICONS.purified,
  Costume: TAG_ICONS.costume,
  Background: TAG_ICONS.background,
  Hundo: TAG_ICONS.hundo,
  Nundo: TAG_ICONS.nundo,
}

export const FORM_ICONS: Record<string, string> = {
  Default: '⚪',
  Alolan: '🌺',
  Galarian: '⚔️',
  Hisuian: '🏯',
  Paldean: '🍊',
  Mega: '⚡',
}

const FALLBACK_ICON = '📌'

export function iconForCategory(category: { name: string; requiredTags: TagId[] }) {
  const named = CATEGORY_ICONS[category.name]
  if (named) return named
  const firstTag = category.requiredTags[0]
  if (firstTag) return TAG_ICONS[firstTag]
  return FALLBACK_ICON
}

export function iconForForm(form: string | null) {
  return FORM_ICONS[form ?? 'Default'] ?? FALLBACK_ICON
}

export function toneForCategory(category: { name: string; requiredTags: TagId[] }): UiTone {
  if (category.name === 'Living' || category.requiredTags.length === 0) return 'living'
  if (category.name === 'Background') return 'background'
  const named = category.name.toLowerCase()
  if (named === 'shiny' || named === 'shadow' || named === 'purified' || named === 'costume' || named === 'hundo' || named === 'nundo') {
    return named
  }
  return category.requiredTags[0] ?? 'living'
}

export function toneForForm(form: string | null): UiTone {
  if (!form) return 'default'
  const key = form.toLowerCase()
  if (key === 'alolan' || key === 'galarian' || key === 'hisuian' || key === 'paldean' || key === 'mega') {
    return key
  }
  return 'default'
}
