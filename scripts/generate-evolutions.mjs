import fs from 'node:fs'

const SPECIES_CSV =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species.csv'
const MAX_ID = 1025

const res = await fetch(SPECIES_CSV)
if (!res.ok) throw new Error(`pokemon_species.csv ${res.status}`)
const text = await res.text()
const lines = text.trim().split(/\r?\n/)
const header = lines[0].split(',')
const idIdx = header.indexOf('id')
const fromIdx = header.indexOf('evolves_from_species_id')
const chainIdx = header.indexOf('evolution_chain_id')
if (idIdx < 0 || fromIdx < 0 || chainIdx < 0) {
  throw new Error(`unexpected pokemon_species.csv header: ${lines[0]}`)
}

const rows = []
for (const line of lines.slice(1)) {
  const cols = line.split(',')
  const id = Number(cols[idIdx])
  if (!Number.isInteger(id) || id < 1 || id > MAX_ID) continue
  const fromRaw = cols[fromIdx]
  const fromId = fromRaw ? Number(fromRaw) : null
  rows.push({
    id,
    fromId: Number.isInteger(fromId) && fromId >= 1 && fromId <= MAX_ID ? fromId : null,
    chainId: Number(cols[chainIdx]),
  })
}

const byId = new Map(rows.map((row) => [row.id, row]))
const stageCache = new Map()

function stageOf(id, seen = new Set()) {
  if (stageCache.has(id)) return stageCache.get(id)
  if (seen.has(id)) return 0
  seen.add(id)
  const row = byId.get(id)
  const stage = row?.fromId ? stageOf(row.fromId, seen) + 1 : 0
  stageCache.set(id, stage)
  return stage
}

const chains = new Map()
for (const row of rows) {
  const list = chains.get(row.chainId) ?? []
  list.push(row.id)
  chains.set(row.chainId, list)
}

const families = [...chains.values()]
  .map((ids) => [...new Set(ids)].sort((a, b) => stageOf(a) - stageOf(b) || a - b))
  .sort((a, b) => a[0] - b[0])
const stages = Array.from({ length: MAX_ID + 1 }, (_, id) => (id === 0 ? 0 : stageOf(id)))

fs.mkdirSync('src/data', { recursive: true })
fs.writeFileSync('src/data/evolutions.json', JSON.stringify({ families, stages }))
console.log('wrote', families.length, 'evolution families')
