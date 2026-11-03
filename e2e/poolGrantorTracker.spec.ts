import { expect, test, type Locator, type Page } from '@playwright/test'

/* SP-1 (D410): the feature that grants a pool shows the pool's use boxes. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function seeded(id: string, className: string, level: number, subclass: string | null = null) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  }
}

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Actions' }).click()
}

const row = (page: Page, feature: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).getByRole('listitem').filter({ has: page.getByRole('button', { name: feature, exact: true }) })
const boxes = (page: Page, feature: string, pool: string): Locator => row(page, feature).getByRole('group', { name: `${pool} uses`, exact: true }).getByRole('button')
const used = (page: Page, feature: string, pool: string): Locator => row(page, feature).getByRole('group', { name: `${pool} uses`, exact: true }).locator('.sheet__use-box--used')

test('SP-1 a: Sorcerer 5 with no Metamagic shows 5 Sorcery Point boxes on Font of Magic', async ({ page }) => {
  await openSheet(page, seeded('sp1-a', 'Sorcerer', 5))
  await expect(boxes(page, 'Font of Magic', 'Sorcery Point')).toHaveCount(5)
})

test('SP-1 b: Monk 5 shows 5 Focus Point boxes on Monk\'s Focus, shared with Flurry of Blows', async ({ page }) => {
  await openSheet(page, seeded('sp1-b', 'Monk', 5))
  await expect(boxes(page, "Monk's Focus", 'Focus Point')).toHaveCount(5)
  await boxes(page, "Monk's Focus", 'Focus Point').first().click()
  await expect(used(page, "Monk's Focus", 'Focus Point')).toHaveCount(1)
  await expect(used(page, 'Flurry of Blows', 'Focus Point')).toHaveCount(1)
})

test('SP-1 c: Battle Master 3 shows 4 Superiority Die boxes on Combat Superiority', async ({ page }) => {
  await openSheet(page, seeded('sp1-c', 'Fighter', 3, 'Battle Master'))
  await expect(boxes(page, 'Combat Superiority', 'Superiority Die')).toHaveCount(4)
})

test('SP-1 e: a die spent on a maneuver row is used on Combat Superiority too, and a Short Rest restores it', async ({ page }) => {
  const character = { ...seeded('sp1-e', 'Fighter', 3, 'Battle Master'), optionalFeatureChoices: [{ featureType: 'MV:B', choices: ['Trip Attack', 'Riposte', 'Parry'].map((name) => ({ name })) }] }
  await openSheet(page, character)
  await boxes(page, 'Riposte', 'Superiority Die').first().click()
  await expect(used(page, 'Combat Superiority', 'Superiority Die')).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(used(page, 'Combat Superiority', 'Superiority Die')).toHaveCount(0)
})

test('SP-1 d: a Long Rest restores the Font of Magic boxes', async ({ page }) => {
  await openSheet(page, seeded('sp1-d', 'Sorcerer', 5))
  await boxes(page, 'Font of Magic', 'Sorcery Point').first().click()
  await expect(used(page, 'Font of Magic', 'Sorcery Point')).toHaveCount(1)
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page, 'Font of Magic', 'Sorcery Point')).toHaveCount(0)
})
