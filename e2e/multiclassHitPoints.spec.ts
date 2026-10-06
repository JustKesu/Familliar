import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep } from './wizard.ts'

/* M4 (D323): maximum hit points per level from Character.levelOrder. Seeded at schema 59, a state import can produce. */
const STORAGE_KEY = 'familliar:characters'
// CON 13 = +1.
const SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 }

function warlockSorcerer(id: string, withHistory: boolean) {
  return {
    schemaVersion: 59,
    id,
    name: id,
    classes: [
      { className: 'Warlock', classSource: 'XPHB', subclass: null, level: 6 },
      { className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 3 },
    ],
    ...(withHistory
      ? { levelOrder: [...Array.from({ length: 6 }, () => ({ className: 'Warlock', classSource: 'XPHB' })), ...Array.from({ length: 3 }, () => ({ className: 'Sorcerer', classSource: 'XPHB' }))] }
      : {}),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
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
}

const hitPointsValue = (page: Page) => page.locator('.sheet__hit-points-value').first()
const longRest = (page: Page) => page.getByRole('button', { name: 'Long Rest', exact: true })

test('M4 a: Warlock 6 / Sorcerer 3 with a level history — max HP 54, per-class rows in the breakdown, Long Rest enabled', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m4-a', true))
  // d8 max 8 + 5 × 5 + 3 × 4 + CON 1 × 9.
  await expect(hitPointsValue(page)).toContainText('/ 54')
  await page.getByRole('button', { name: 'Hit points details', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Hit Points', exact: true })
  await expect(drawer).toContainText('level 1 (Warlock d8 maximum)')
  await expect(drawer).toContainText('level 7 (Sorcerer d6 average)')
  await page.keyboard.press('Escape')
  await expect(longRest(page)).toBeEnabled()
})

test('M4 b: the same character without a level history — the maximum is unknown with the reason, Long Rest disabled', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m4-b', false))
  await expect(hitPointsValue(page)).toContainText('/ —')
  await page.getByRole('button', { name: 'Hit points details', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Hit Points', exact: true })).toContainText(
    'Cannot tell which class each level came from (no level history). Set a manual maximum.',
  )
  await page.keyboard.press('Escape')
  await expect(longRest(page)).toBeDisabled()
})

test('M4 c: level up Fighter 1 → 2 — the Hit points step has a Level 2 row and no Level 1 row', async ({ page }) => {
  await createFighter(page, { name: 'Climber', level: 1, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 2' }).click()
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('radiogroup', { name: 'Level 2 hit points method', exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /^Level 1 / })).toHaveCount(0)
})
