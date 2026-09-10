import fs from 'node:fs'
import species from '../src/data/species.json' with { type: 'json' }
import released from '../src/data/goFormReleased.json' with { type: 'json' }

const wt = JSON.parse(fs.readFileSync(`${process.env.TEMP}/backgrounds-wiki.json`, 'utf8')).parse
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

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle)
  if (start < 0) return ''
  const end = endNeedle ? source.indexOf(endNeedle, start) : -1
  return source.slice(start, end < 0 ? undefined : end)
}

function cleanBgName(raw) {
  let name = raw.replace(/'''/g, '').replace(/''/g, '').replace(/&nbsp;/g, ' ').trim()
  name = name.replace(/\[\[(?:[^\]]*\|)?([^\]]+)\]\]/g, '$1')
  name = name.split('<br>')[0].replace(/\s+/g, ' ').trim()
  if (/unused/i.test(name)) return ''
  if (/^requires\b/i.test(name)) return ''
  return name
}

const special = sliceBetween(wt, '==List of Special Backgrounds==', '==List of Location Backgrounds==')
const location = sliceBetween(wt, '==List of Location Backgrounds==', '==Unused==')
const body = `${special}\n${location}`

const tokenRe = /\[\[File:[^\]]+\]\](?:<br>)*\s*([^|<\n]+)|\{\{I\|([^}|]+)/g
const missing = []
const seen = new Set()
const rows = []
const skippedNames = []
let bgs = []
let afterSpecies = false

for (const match of body.matchAll(tokenRe)) {
  if (match[1] != null) {
    const name = cleanBgName(match[1])
    if (!name) {
      skippedNames.push(match[1].trim())
      continue
    }
    if (afterSpecies) {
      bgs = []
      afterSpecies = false
    }
    bgs.push(name)
    continue
  }
  const speciesName = match[2].trim()
  const speciesId = byName.get(speciesName.toLowerCase())
  if (!speciesId) {
    missing.push(speciesName)
    afterSpecies = true
    continue
  }
  for (const variant of bgs) {
    const key = `${speciesId}:${variant.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ speciesId, variant })
  }
  afterSpecies = true
}

rows.sort((a, b) => a.speciesId - b.speciesId || a.variant.localeCompare(b.variant))

console.log('unique backgrounds slots', rows.length, 'species', new Set(rows.map((r) => r.speciesId)).size)
console.log('unique bg names', new Set(rows.map((r) => r.variant)).size)
console.log('missing', [...new Set(missing)])
console.log('skipped names', [...new Set(skippedNames)])
console.log('kyogre', rows.filter((r) => r.speciesId === 382))
console.log('nihilego', rows.filter((r) => r.speciesId === 793))
console.log('pikachu count', rows.filter((r) => r.speciesId === 25).length)
console.log('tokyo', rows.filter((r) => /tokyo/i.test(r.variant)).slice(0, 8))
console.log('community days', rows.filter((r) => r.variant === '2026 Community Days').map((r) => r.speciesId))
console.log('busan', rows.filter((r) => /busan/i.test(r.variant)))

released.background = rows
fs.writeFileSync(new URL('../src/data/goFormReleased.json', import.meta.url), JSON.stringify(released))
console.log('wrote background', rows.length)
