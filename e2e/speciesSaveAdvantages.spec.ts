import { expect, test, type Locator, type Page } from '@playwright/test'

/* S4 (D314): species advantage on saving throws, listed under the Saving Throws card and in its drawer. */
const STORAGE_KEY = 'familliar:characters'
const ACOLYTE = { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function fighter(id: string, species: Record<string, unknown>) {
  return {
    schemaVersion: 56,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    background: ACOLYTE,
    abilityBonus: { wisdom: 2, intelligence: 1 },
    classSkills: ['athletics', 'perception'],
    fightingStyle: 'Defense',
    ...species,
  }
}

const HIGH_ELF = fighter('s4-elf', {
  species: { name: 'Elf; High Elf Lineage', source: 'XPHB' },
  speciesSkills: ['insight'],
  speciesSpellcastingAbility: 'intelligence',
  speciesCantrip: { name: 'Prestidigitation', source: 'XPHB' },
})
const ROCK_GNOME = fighter('s4-gnome', { species: { name: 'Gnome; Rock Gnome Lineage', source: 'XPHB' }, speciesSpellcastingAbility: 'intelligence' })
const HUMAN = fighter('s4-human', {
  species: { name: 'Human', source: 'XPHB' },
  speciesSize: 'M',
  speciesSkills: ['stealth'],
  grantedFeats: [{ origin: 'species', name: 'Tough', source: 'XPHB' }],
})
const YUAN_TI = fighter('s4-yuanti', { species: { name: 'Yuan-Ti', source: 'MPMM' }, speciesSize: 'M', speciesSpellcastingAbility: 'charisma' })
const TORTLE = fighter('s4-tortle', { species: { name: 'Tortle', source: 'MPMM' }, speciesSize: 'M', speciesSkills: ['survival'] })

async function open(page: Page, subject: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
  return page.locator('.sheet__saving-throws .sheet__save-advantages li')
}

test('S4 a: a High Elf Fighter shows Fey Ancestry under Saving Throws', async ({ page }) => {
  const lines = await open(page, HIGH_ELF)
  await expect(lines).toHaveText(['Advantage on saves to avoid or end Charmed (Fey Ancestry)'])
})

test('S4 b: a Rock Gnome Fighter shows Gnomish Cunning on the card and in the Saving Throws drawer', async ({ page }) => {
  const line = 'Advantage on Intelligence, Wisdom and Charisma saves (Gnomish Cunning)'
  await expect(await open(page, ROCK_GNOME)).toHaveText([line])
  await page.getByRole('button', { name: 'Saving throws details', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Saving throws', exact: true })
  await expect(drawer.locator('.sheet__save-advantages li')).toHaveText([line])
})

test('S4 c: a Human Fighter shows no species line', async ({ page }) => {
  const lines = await open(page, HUMAN)
  await expect(page.locator('.sheet__saving-throws h2')).toBeVisible()
  await expect(lines).toHaveCount(0)
})

test('S4 d: a Yuan-Ti (MPMM) Fighter shows both its lines', async ({ page }) => {
  const lines = await open(page, YUAN_TI)
  await expect(lines).toHaveText(['Advantage on saves to avoid or end Poisoned (Poison Resilience)', 'Advantage on saves against spells (Magic Resistance)'])
})

test('S4 e: a Tortle (MPMM) Fighter shows the conditional Shell Defense line', async ({ page }) => {
  const lines = await open(page, TORTLE)
  await expect(lines).toHaveText(['Advantage on Strength and Constitution saves while in your shell (Shell Defense)'])
})
