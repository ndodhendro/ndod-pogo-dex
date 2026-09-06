import {
  DEFAULT_LABEL_COLOR,
  FALLBACK_EMOJI,
  firstGrapheme,
  normalizeHexColor,
} from '../lib/categoryStyle'
import { FORM_TAGS, formNameForTag, isBuiltInTag, type BuiltInTagId, type TagId } from '../lib/tags'

export type UiTone =
  | 'inbox'
  | 'dex'
  | 'settings'
  | 'living'
  | BuiltInTagId
  | 'default'
  | 'alolan'
  | 'galarian'
  | 'hisuian'
  | 'paldean'
  | 'mega'

export const TAB_ICONS = {
  inbox: '📥',
  settings: '⚙️',
} as const

export const TAB_LOGOS = {
  dex: 'nav/pokedex.png',
} as const

export const TAG_ICONS: Record<BuiltInTagId, string> = {
  shiny: '✨',
  shadow: '🌑',
  purified: '💎',
  costume: '🎭',
  background: '🖼️',
  hundo: '💯',
  nundo: '0️⃣',
}

export const CATEGORY_ICONS: Record<string, string> = {
  Basic: '🌿',
  Pokémon: '🌿',
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

export const TONE_TEXT_HEX: Record<UiTone, string> = {
  inbox: '#5eead4',
  dex: '#6ee7b7',
  settings: '#cbd5e1',
  living: DEFAULT_LABEL_COLOR,
  shiny: '#f5e19a',
  shadow: '#c4b5fd',
  purified: '#bae6fd',
  costume: '#f0abfc',
  background: '#67e8f9',
  hundo: '#fcd34d',
  nundo: '#cbd5e1',
  default: '#cbd5e1',
  alolan: '#fbcfe8',
  galarian: '#bfdbfe',
  hisuian: '#fed7aa',
  paldean: '#fdba74',
  mega: '#fde68a',
}

export function iconForCategory(category: {
  name: string
  requiredTags: TagId[]
  emoji?: string | null
}) {
  const custom = firstGrapheme(category.emoji ?? '')
  if (custom) return custom
  const named = CATEGORY_ICONS[category.name]
  if (named) return named
  const firstTag = category.requiredTags[0]
  if (firstTag && isBuiltInTag(firstTag)) return TAG_ICONS[firstTag]
  return FALLBACK_EMOJI
}

export function iconForForm(form: string | null) {
  return FORM_ICONS[form ?? 'Default'] ?? FALLBACK_EMOJI
}

export function toneForCategory(category: { name: string; requiredTags: TagId[] }): UiTone {
  if (
    category.name === 'Basic' ||
    category.name === 'Pokémon' ||
    category.name === 'Living' ||
    category.requiredTags.length === 0
  ) {
    return 'living'
  }
  if (category.name === 'Background') return 'background'
  const named = category.name.toLowerCase()
  if (named === 'shiny' || named === 'shadow' || named === 'purified' || named === 'costume' || named === 'hundo' || named === 'nundo') {
    return named
  }
  const first = category.requiredTags[0]
  return first && isBuiltInTag(first) ? first : 'living'
}

export function colorForCategory(category: {
  name: string
  requiredTags: TagId[]
  labelColor?: string | null
}): string {
  return normalizeHexColor(category.labelColor) ?? TONE_TEXT_HEX[toneForCategory(category)]
}

export function suggestedLook(requiredTags: TagId[]): { emoji: string; labelColor: string } {
  const first = requiredTags[0]
  if (!first || !isBuiltInTag(first)) return { emoji: FALLBACK_EMOJI, labelColor: DEFAULT_LABEL_COLOR }
  return {
    emoji: TAG_ICONS[first],
    labelColor: TONE_TEXT_HEX[first] ?? DEFAULT_LABEL_COLOR,
  }
}

type TagCategoryLook = {
  seed: boolean
  name: string
  requiredTags: TagId[]
  emoji?: string | null
  labelColor?: string | null
}

export function categoryForTag(categories: TagCategoryLook[], tag: TagId) {
  return categories.find((row) => row.requiredTags.length === 1 && row.requiredTags[0] === tag)
}

export function lookForTag(tag: TagId, categories: TagCategoryLook[]): { emoji: string; labelColor: string } {
  const category = categoryForTag(categories, tag)
  if (category) {
    return { emoji: iconForCategory(category), labelColor: colorForCategory(category) }
  }
  if (isBuiltInTag(tag)) {
    return { emoji: TAG_ICONS[tag], labelColor: TONE_TEXT_HEX[tag] ?? DEFAULT_LABEL_COLOR }
  }
  const formName = formNameForTag(tag)
  if (formName) {
    const tone = tag.toLowerCase() as UiTone
    return { emoji: FORM_ICONS[formName] ?? FALLBACK_EMOJI, labelColor: TONE_TEXT_HEX[tone] ?? DEFAULT_LABEL_COLOR }
  }
  return { emoji: FALLBACK_EMOJI, labelColor: DEFAULT_LABEL_COLOR }
}

export type RequiredTagChoice = {
  key: string
  label: string
  icon: string
  labelColor: string
  tone: UiTone
  tags: TagId[]
}

export function requiredTagChoices(
  categories: Array<TagCategoryLook & { id: string }>,
): RequiredTagChoice[] {
  return categories.flatMap((cat) => {
    if (cat.requiredTags.length === 0) return []
    return [
      {
        key: cat.id,
        label: cat.name,
        icon: iconForCategory(cat),
        labelColor: colorForCategory(cat),
        tone: toneForCategory(cat),
        tags: [...cat.requiredTags],
      },
    ]
  })
}

export type SpecimenTagChoice = {
  tag: TagId | null
  label: string
  icon: string
  labelColor: string
}

export function specimenTagChoices(categories: TagCategoryLook[]): SpecimenTagChoice[] {
  const seen = new Set<string>()
  const choices: SpecimenTagChoice[] = []
  for (const cat of categories) {
    if (cat.requiredTags.length !== 0) continue
    if (seen.has('')) continue
    seen.add('')
    choices.push({
      tag: null,
      label: cat.name,
      icon: iconForCategory(cat),
      labelColor: colorForCategory(cat),
    })
  }
  for (const tag of FORM_TAGS) {
    if (seen.has(tag)) continue
    seen.add(tag)
    const look = lookForTag(tag, categories)
    const named = categoryForTag(categories, tag)
    choices.push({
      tag,
      label: named?.name ?? formNameForTag(tag) ?? tag,
      icon: look.emoji,
      labelColor: look.labelColor,
    })
  }
  for (const cat of categories) {
    if (cat.requiredTags.length !== 1) continue
    const tag = cat.requiredTags[0]
    if (seen.has(tag)) continue
    seen.add(tag)
    choices.push({
      tag,
      label: cat.name,
      icon: iconForCategory(cat),
      labelColor: colorForCategory(cat),
    })
  }
  return choices
}

export function toneForForm(form: string | null): UiTone {
  if (!form) return 'default'
  const key = form.toLowerCase()
  if (key === 'alolan' || key === 'galarian' || key === 'hisuian' || key === 'paldean' || key === 'mega') {
    return key
  }
  return 'default'
}
