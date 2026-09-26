import { expect, test, type Locator, type Page } from '@playwright/test'

/* D195: class and subclass senses on the Senses card. Characters are seeded into storage like rhw.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

function seeded(id: string, className: string, level: number, subclass: string | null, species: string) {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass, level }],
    abilityScores: { method: 'standardArray', scores: { strength: 10, dexterity: 15, constitution: 13, intelligence: 8, wisdom: 14, charisma: 12 } },
    species: { name: species, source: 'XPHB' },
    spellChoices: [],
  }
}

async function sensesCard(page: Page, saved: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  return page.locator('.sheet__senses-card')
}

const darkvisionRow = (card: Locator) => card.locator('li', { hasText: /^Darkvision:/ })
const grantedSenses = (card: Locator) => card.locator('.sheet__senses')

test('D195 a: Ranger 18 lists Blindsight 30 ft. from Feral Senses', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-ranger-18', 'Ranger', 18, null, 'Human'))
  await expect(grantedSenses(card)).toContainText('Blindsight: 30 ft. — from class feature (Feral Senses)')
})

// Eyes of Night is a level-1 feature in the 2014 data; the app grants every non-XPHB subclass at class level 3 (D176).
test('D195 b: Twilight Domain Cleric 3 has Darkvision 300 ft.', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-twilight', 'Cleric', 3, 'Twilight Domain', 'Human'))
  await expect(darkvisionRow(card)).toHaveText('Darkvision: 300 ft.')
})

test('D195 c: Shadow Sorcery 3 on a Human — Darkvision 120 ft. and Blindsight 10 ft.', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-shadow-sorcery', 'Sorcerer', 3, 'Shadow Sorcery', 'Human'))
  await expect(darkvisionRow(card)).toHaveText('Darkvision: 120 ft.')
  await expect(grantedSenses(card)).toContainText('Blindsight: 10 ft. — from class feature (Eyes of the Dark)')
})

test('D195 d: Gloom Stalker 3 on a Human — Darkvision 60 ft.', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-gloom-human', 'Ranger', 3, 'Gloom Stalker', 'Human'))
  await expect(darkvisionRow(card)).toHaveText('Darkvision: 60 ft.')
})

test('D195 e: Gloom Stalker 3 on an Elf — Darkvision 120 ft., breakdown names Elf and Umbral Sight', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-gloom-elf', 'Ranger', 3, 'Gloom Stalker', 'Elf'))
  await expect(darkvisionRow(card)).toHaveText('Darkvision: 120 ft.')
  await card.getByRole('button', { name: 'Senses details' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toContainText('Elf: does not exceed from class feature (Umbral Sight) (120 ft.)')
  await expect(drawer).toContainText('from class feature (Umbral Sight): +120 (Elf 60 ft. + 60 ft.)')
})

test('D195 f: Warrior of Shadow Monk 3 on a Human — Darkvision 60 ft.', async ({ page }) => {
  const card = await sensesCard(page, seeded('d195-shadow-monk', 'Monk', 3, 'Warrior of Shadow', 'Human'))
  await expect(darkvisionRow(card)).toHaveText('Darkvision: 60 ft.')
})
