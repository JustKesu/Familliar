import { expect, test, type Locator, type Page } from '@playwright/test'

/* M3 (D322): one shared ordinary pool from the multiclass table for 2+ Spellcasting classes; Pact Magic stays separate. Seeded at schema 59. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }

function multiclass(id: string, order: [string, number][]) {
  return {
    // Multiclass max HP is not computed yet and Long Rest needs one.
    maxHpOverride: 40,
    schemaVersion: 59,
    id,
    name: id,
    classes: order.map(([className, level]) => ({ className, classSource: 'XPHB', subclass: null, level })),
    levelOrder: order.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
  }
}

async function openSpells(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => panel(page).getByRole('region', { name: label, exact: true })
const slotBoxes = (scope: Locator): Locator => scope.locator('.sheet__spell-section-heading .sheet__use-box')
const usedBoxes = (scope: Locator): Locator => scope.locator('.sheet__spell-section-heading .sheet__use-box--used')

test('M3 a: Wizard 3 / Cleric 3 — caster level 6 gives 4/3/3 slot boxes; a spent 3rd-level slot returns on a Long Rest', async ({ page }) => {
  await openSpells(page, multiclass('m3-a', [['Wizard', 3], ['Cleric', 3]]))
  await expect(slotBoxes(section(page, '1st Level'))).toHaveCount(4)
  await expect(slotBoxes(section(page, '2nd Level'))).toHaveCount(3)
  const third = section(page, '3rd Level')
  await expect(slotBoxes(third)).toHaveCount(3)
  await expect(section(page, '4th Level')).toHaveCount(0)

  await third.getByRole('group', { name: 'level 3 spell slots uses', exact: true }).getByRole('button').first().click()
  await expect(usedBoxes(third)).toHaveCount(1)
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(usedBoxes(third)).toHaveCount(0)
})

test('M3 b: Warlock 6 / Sorcerer 3 — ordinary 1st and 2nd from Sorcerer 3 alone (4 and 2), the pact section unchanged', async ({ page }) => {
  await openSpells(page, multiclass('m3-b', [['Warlock', 6], ['Sorcerer', 3]]))
  await expect(slotBoxes(section(page, '1st Level'))).toHaveCount(4)
  await expect(slotBoxes(section(page, '2nd Level'))).toHaveCount(2)
  const pact = section(page, '3rd Level')
  await expect(pact.locator('.sheet__spell-pact-tag')).toHaveText('Pact')
  await expect(slotBoxes(pact)).toHaveCount(2)
  await expect(pact.getByRole('group', { name: 'level 3 spell slots uses', exact: true })).toHaveCount(0)
})
