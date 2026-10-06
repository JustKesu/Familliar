import { expect, test, type Locator, type Page } from '@playwright/test'

/* M2 (D321): saves from the first class, other classes only their fixed multiclass proficiencies. Seeded at schema 59 as an import would store them. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }

function multiclass(id: string, order: [string, number][], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 59,
    id,
    name: id,
    classes: order.map(([className, level]) => ({ className, classSource: 'XPHB', subclass: null, level })),
    levelOrder: order.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    ...extra,
  }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const saveRow = (page: Page, ability: string): Locator =>
  page.locator('.sheet__saving-throws .sheet__row').filter({ has: page.getByRole('button', { name: `${ability} saving throw breakdown`, exact: true }) })

test('M2 a: Warlock 6 / Sorcerer 3 with Warlock first is proficient in WIS and CHA saves only', async ({ page }) => {
  await open(page, multiclass('m2-a', [['Warlock', 6], ['Sorcerer', 3]]))
  for (const [ability, status] of [
    ['Strength', 'none'],
    ['Dexterity', 'none'],
    ['Constitution', 'none'],
    ['Intelligence', 'none'],
    ['Wisdom', 'proficient'],
    ['Charisma', 'proficient'],
  ]) {
    await expect(saveRow(page, ability).locator('.sheet__prof-mark')).toHaveAttribute('data-status', status)
  }
  await page.getByRole('button', { name: 'Saving throws details', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Saving throws', exact: true })
  await expect(drawer).toContainText('proficiency (Warlock)')
  await expect(drawer).not.toContainText('Sorcerer')
})

test('M2 b: Wizard 1 / Fighter 1 gets medium armor, shields and martial weapons from Fighter; a Longsword hits with the bonus', async ({ page }) => {
  await open(page, multiclass('m2-b', [['Wizard', 1], ['Fighter', 1]], { inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }] }))
  const card = page.locator('.sheet__proficiencies')
  await expect(card).toContainText('Medium armor')
  await expect(card).toContainText('Shields')
  await expect(card).toContainText('Martial weapons')
  await expect(card).not.toContainText('Heavy armor')
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).toContainText('Martial weapons — Fighter (multiclass)')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Actions' }).click()
  // STR +2 and proficiency +2 at character level 2.
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+4')
})
