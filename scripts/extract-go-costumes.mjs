import fs from 'node:fs'
import species from '../src/data/species.json' with { type: 'json' }
import released from '../src/data/goFormReleased.json' with { type: 'json' }

const wt = JSON.parse(fs.readFileSync(`${process.env.TEMP}/event-wiki.json`, 'utf8')).parse
  .wikitext['*']

const byName = new Map(species.map((row) => [row.name.toLowerCase(), row.id]))
byName.set('nidoran♀', 29)
byName.set('nidoran♂', 32)
byName.set("farfetch'd", 83)
byName.set("sirfetch'd", 865)
byName.set('flabébé', 669)
byName.set('mr. mime', 122)
byName.set('mr. rime', 866)
byName.set('mime jr.', 439)
byName.set('type: null', 772)
byName.set('jangmo-o', 782)
byName.set('hakamo-o', 783)
byName.set('kommo-o', 784)

function flagsOf(parts) {
  const flags = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq > 0) flags[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
  }
  return flags
}

function parseBlock(block) {
  return [...block.matchAll(/\{\{PC\|([^}]+)\}\}/g)].map((match) => {
    const parts = match[1].split('|').map((part) => part.trim())
    return { name: parts[0], key: parts[1], flags: flagsOf(parts), raw: match[1] }
  })
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  if (start < 0) return ''
  const end = endNeedle ? source.indexOf(endNeedle, start) : -1
  return source.slice(start, end < 0 ? undefined : end)
}

const regular = parseBlock(sliceBetween(wt, 'Regular (', 'Shiny ('))
const extra = parseBlock(sliceBetween(wt, 'Regular (6)=', 'Shiny (6)='))
const shadow = parseBlock(sliceBetween(wt, '==Shadow Event Pokémon==', '==Trivia=='))

const missing = []
const seen = new Set()
const rows = []

for (const row of [...regular, ...extra]) {
  if (row.flags.a === 'n') continue
  const speciesId = byName.get(row.name.toLowerCase())
  if (!speciesId) {
    missing.push(row.name)
    continue
  }
  const variant = (row.flags.form || row.key).trim()
  const key = `${speciesId}:${variant.toLowerCase()}`
  if (seen.has(key)) continue
  seen.add(key)
  rows.push({ speciesId, variant })
}

rows.sort((a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant))

console.log('regular', regular.length, 'released', regular.filter((r) => r.flags.a !== 'n').length)
console.log('unreleased', regular.filter((r) => r.flags.a === 'n').map((r) => `${r.name} ${r.flags.form}`))
console.log('extra', extra.map((r) => r.flags.form))
console.log('shadow', shadow.map((r) => `${r.name} ${r.flags.form}`))
console.log('unique costumes', rows.length, 'species', new Set(rows.map((r) => r.speciesId)).size)
console.log('missing', [...new Set(missing)])
console.log('bulbasaur', rows.filter((r) => r.speciesId === 1))
console.log('pikachu count', rows.filter((r) => r.speciesId === 25).length)

released.costume = rows
fs.writeFileSync(
  new URL('../src/data/goFormReleased.json', import.meta.url),
  JSON.stringify(released),
)
console.log('wrote costume', rows.length)
