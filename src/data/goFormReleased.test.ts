import { describe, expect, it } from 'vitest'
import {
  GO_ALTERNATE_FORME,
  GO_BACKGROUND,
  GO_COSTUME,
  GO_FORM_SPECIES_IDS,
  GO_GENDER,
  GO_MEGA,
  goFormSpeciesIds,
  isGoFormReleased,
} from './goFormReleased'
import { GO_LUCKY_IDS } from './goReleased'

describe('GO regional and alternate forme lists', () => {
  it('lists released Alolan, Galarian, Hisuian, and Paldean species', () => {
    expect([...GO_FORM_SPECIES_IDS.alolan]).toEqual([
      19, 20, 26, 27, 28, 37, 38, 50, 51, 52, 53, 74, 75, 76, 88, 89, 103, 105,
    ])
    expect(GO_FORM_SPECIES_IDS.galarian.size).toBe(19)
    expect(GO_FORM_SPECIES_IDS.galarian.has(144)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.hisuian.size).toBe(14)
    expect(GO_FORM_SPECIES_IDS.hisuian.has(705)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.hisuian.has(706)).toBe(false)
    expect([...GO_FORM_SPECIES_IDS.paldean]).toEqual([128, 194])
  })

  it('lists wiki Gigantamax species and skips unreleased rows', () => {
    expect([...GO_FORM_SPECIES_IDS.gigantamax]).toEqual([
      3, 6, 9, 12, 25, 52, 68, 94, 99, 131, 143, 569, 812, 815, 818, 849, 861,
    ])
    expect(GO_FORM_SPECIES_IDS.gigantamax.size).toBe(17)
    expect(GO_FORM_SPECIES_IDS.gigantamax.has(25)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.gigantamax.has(1)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.gigantamax.has(892)).toBe(false)
    expect(isGoFormReleased('gigantamax', 3, '')).toBe(true)
    expect(isGoFormReleased('gigantamax', 25, '')).toBe(true)
    expect(isGoFormReleased('gigantamax', 1, '')).toBe(false)
    expect(isGoFormReleased('gigantamax', 892, '')).toBe(false)
    expect(isGoFormReleased('gigantamax', 3, 'Gigantamax')).toBe(false)
  })

  it('lists wiki Shiny species and skips greyed rows', () => {
    expect(GO_FORM_SPECIES_IDS.shiny.size).toBe(891)
    expect(GO_FORM_SPECIES_IDS.shiny.has(1)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(25)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(29)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(32)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(151)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(792)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(827)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(828)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(872)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(973)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shiny.has(494)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.shiny.has(778)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.shiny.has(840)).toBe(false)
    expect(isGoFormReleased('shiny', 1, '')).toBe(true)
    expect(isGoFormReleased('shiny', 494, '')).toBe(false)
    expect(isGoFormReleased('shiny', 1, 'Shiny')).toBe(false)
  })

  it('lists wiki Dynamax species and skips greyed rows', () => {
    expect(GO_FORM_SPECIES_IDS.dynamax.size).toBe(138)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(1)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(6)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(25)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(891)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(892)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(13)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.dynamax.has(143)).toBe(false)
    expect(isGoFormReleased('dynamax', 1, '')).toBe(true)
    expect(isGoFormReleased('dynamax', 13, '')).toBe(false)
    expect(isGoFormReleased('dynamax', 1, 'Dynamax')).toBe(false)
  })

  it('lists wiki Shadow species and skips greyed rows', () => {
    expect(GO_FORM_SPECIES_IDS.shadow.size).toBe(458)
    expect(GO_FORM_SPECIES_IDS.shadow.has(1)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(13)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(150)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(215)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(263)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(645)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(979)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.shadow.has(25)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.shadow.has(151)).toBe(false)
    expect(isGoFormReleased('shadow', 1, '')).toBe(true)
    expect(isGoFormReleased('shadow', 25, '')).toBe(false)
    expect(isGoFormReleased('shadow', 1, 'Shadow')).toBe(false)
  })

  it('lists Purified from the same Shadow species list', () => {
    expect(goFormSpeciesIds('purified')).toEqual(GO_FORM_SPECIES_IDS.shadow)
    expect(isGoFormReleased('purified', 1, '')).toBe(true)
    expect(isGoFormReleased('purified', 25, '')).toBe(false)
    expect(isGoFormReleased('purified', 1, 'Purified')).toBe(false)
  })

  it('lists Lucky from the released list minus Untradable species', () => {
    expect(goFormSpeciesIds('lucky')).toEqual(GO_LUCKY_IDS)
    expect(isGoFormReleased('lucky', 1, '')).toBe(true)
    expect(isGoFormReleased('lucky', 808, '')).toBe(true)
    expect(isGoFormReleased('lucky', 151, '')).toBe(false)
    expect(isGoFormReleased('lucky', 1, 'Lucky')).toBe(false)
  })

  it('lists wiki Mega Evolutions and skips unreleased rows', () => {
    expect(GO_FORM_SPECIES_IDS.mega.size).toBe(58)
    expect(GO_MEGA).toHaveLength(61)
    expect(GO_MEGA.filter((row) => row.speciesId === 3).map((row) => row.variant)).toEqual(['Mega'])
    expect(
      GO_MEGA.filter((row) => row.speciesId === 6)
        .map((row) => row.variant)
        .sort(),
    ).toEqual(['Mega X', 'Mega Y'])
    expect(GO_FORM_SPECIES_IDS.mega.has(398)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.mega.has(609)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.mega.has(382)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.mega.has(383)).toBe(true)
    expect(isGoFormReleased('mega', 382, 'Mega')).toBe(true)
    expect(isGoFormReleased('mega', 383, 'Mega')).toBe(true)
    expect(isGoFormReleased('mega', 3, 'Mega')).toBe(true)
    expect(isGoFormReleased('mega', 6, 'Mega X')).toBe(true)
    expect(isGoFormReleased('mega', 6, 'Mega')).toBe(false)
    expect(isGoFormReleased('mega', 398, 'Mega')).toBe(false)
  })

  it('lists wiki gender-difference variants', () => {
    expect(GO_FORM_SPECIES_IDS.gender.size).toBe(101)
    expect(GO_GENDER).toHaveLength(204)
    expect(GO_FORM_SPECIES_IDS.gender.has(25)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.gender.has(3)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.gender.has(133)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.gender.has(215)).toBe(true)
    expect(GO_FORM_SPECIES_IDS.gender.has(1)).toBe(false)
    expect(GO_FORM_SPECIES_IDS.gender.has(876)).toBe(false)
    expect(GO_GENDER.filter((row) => row.speciesId === 3).map((row) => row.variant)).toEqual([
      'Female',
      'Male',
    ])
    expect(
      GO_GENDER.filter((row) => row.speciesId === 215)
        .map((row) => row.variant)
        .sort(),
    ).toEqual(['Female', 'Hisuian Female', 'Hisuian Male', 'Male'])
    expect(isGoFormReleased('gender', 3, 'Male')).toBe(true)
    expect(isGoFormReleased('gender', 3, 'Female')).toBe(true)
    expect(isGoFormReleased('gender', 215, 'Hisuian Female')).toBe(true)
    expect(isGoFormReleased('gender', 1, 'Male')).toBe(false)
    expect(isGoFormReleased('gender', 876, 'Male')).toBe(false)
  })

  it('lists wiki extra formes and skips greyed rows', () => {
    expect(GO_ALTERNATE_FORME.some((row) => row.speciesId === 201 && row.variant === 'A')).toBe(true)
    expect(GO_ALTERNATE_FORME.some((row) => row.speciesId === 201 && row.variant === 'F')).toBe(false)
    expect(
      GO_ALTERNATE_FORME.some((row) => row.speciesId === 128 && row.variant === 'Combat Breed'),
    ).toBe(true)
    expect(GO_ALTERNATE_FORME.some((row) => row.speciesId === 351 && row.variant === 'Sunny')).toBe(
      true,
    )
    expect(GO_ALTERNATE_FORME.some((row) => row.speciesId === 493)).toBe(false)
    expect(isGoFormReleased('alternate-forme', 201, 'A')).toBe(true)
    expect(isGoFormReleased('alternate-forme', 201, 'F')).toBe(false)
    expect(goFormSpeciesIds('costume')).toBeNull()
  })

  it('lists wiki Event Pokémon costumes and skips greyed rows', () => {
    expect(GO_COSTUME).toHaveLength(309)
    expect(GO_FORM_SPECIES_IDS.costume.size).toBe(123)
    expect(GO_COSTUME.filter((row) => row.speciesId === 1).map((row) => row.variant)).toEqual([
      'Halloween',
      'Party hat',
      'Pikachu visor',
    ])
    expect(GO_COSTUME.some((row) => row.speciesId === 25 && row.variant === 'Party hat')).toBe(true)
    expect(GO_COSTUME.some((row) => row.speciesId === 150 && row.variant === 'Armored')).toBe(true)
    expect(GO_COSTUME.some((row) => row.speciesId === 999)).toBe(true)
    expect(GO_COSTUME.some((row) => /friede/i.test(row.variant))).toBe(false)
    expect(GO_COSTUME.some((row) => /pokéxciting/i.test(row.variant))).toBe(false)
    expect(isGoFormReleased('costume', 1, 'Halloween')).toBe(true)
    expect(isGoFormReleased('costume', 1, 'Party hat')).toBe(true)
    expect(isGoFormReleased('costume', 1, 'Party Hat')).toBe(true)
    expect(isGoFormReleased('costume', 4, "Friede's goggles")).toBe(false)
    expect(isGoFormReleased('costume', 13, 'Halloween')).toBe(false)
  })

  it('lists wiki Location and Special backgrounds and skips unused rows', () => {
    expect(GO_BACKGROUND).toHaveLength(879)
    expect(GO_FORM_SPECIES_IDS.background.size).toBe(249)
    expect(GO_BACKGROUND.some((row) => row.speciesId === 382 && row.variant === 'Las Vegas, US')).toBe(
      true,
    )
    expect(
      GO_BACKGROUND.some((row) => row.speciesId === 793 && row.variant === 'Pokémon GO Fest 2024: Wormhole'),
    ).toBe(true)
    expect(
      GO_BACKGROUND.some((row) => row.speciesId === 827 && row.variant === '2026 Community Days'),
    ).toBe(true)
    expect(GO_BACKGROUND.some((row) => /busan fireworks/i.test(row.variant))).toBe(false)
    expect(isGoFormReleased('background', 382, 'Las Vegas, US')).toBe(true)
    expect(isGoFormReleased('background', 1, 'Las Vegas, US')).toBe(false)
    expect(isGoFormReleased('background', 382, 'Busan Fireworks Festival')).toBe(false)
    expect(goFormSpeciesIds('background')).toBeNull()
  })
})
