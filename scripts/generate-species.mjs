import fs from 'node:fs'

const SPECIAL = {
  'nidoran-f': 'Nidoran ♀',
  'nidoran-m': 'Nidoran ♂',
  'mr-mime': 'Mr. Mime',
  'mime-jr': 'Mime Jr.',
  'ho-oh': 'Ho-Oh',
  'porygon-z': 'Porygon-Z',
  'type-null': 'Type: Null',
  'jangmo-o': 'Jangmo-o',
  'hakamo-o': 'Hakamo-o',
  'kommo-o': 'Kommo-o',
  'tapu-koko': 'Tapu Koko',
  'tapu-lele': 'Tapu Lele',
  'tapu-bulu': 'Tapu Bulu',
  'tapu-fini': 'Tapu Fini',
  'mr-rime': 'Mr. Rime',
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  flabebe: 'Flabébé',
  'wo-chien': 'Wo-Chien',
  'chien-pao': 'Chien-Pao',
  'ting-lu': 'Ting-Lu',
  'chi-yu': 'Chi-Yu',
}

function displayName(slug) {
  if (SPECIAL[slug]) return SPECIAL[slug]
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const res = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=1025')
const data = await res.json()
const species = data.results.map((r, i) => ({
  id: i + 1,
  slug: r.name,
  name: displayName(r.name),
}))

fs.mkdirSync('src/data', { recursive: true })
fs.writeFileSync('src/data/species.json', JSON.stringify(species))
console.log('wrote', species.length, 'species')
