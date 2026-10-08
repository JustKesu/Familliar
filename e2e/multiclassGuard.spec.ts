import { expect, test, type Page } from '@playwright/test'

/* M0 (D316). A multiclass character only exists by import, so every scenario imports it through the list. */
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }
const SINGLE_KEY = 'familliar:characters'

function multi(name: string, levels: [number, number]) {
  return {
    schemaVersion: 56,
    id: 'm0-file-id',
    name,
    classes: [
      { className: 'Warlock', classSource: 'XPHB', subclass: null, level: levels[0] },
      { className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: levels[1] },
    ],
    abilityScores: ABILITIES,
    species: { name: 'Elf', source: 'XPHB' },
  }
}

async function importFile(page: Page, entry: unknown): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([entry])) })
}

test('M0 a: an imported Warlock 6 / Sorcerer 3 without a level history has Edit (D333), Level up and Remove level disabled', async ({ page }) => {
  await page.goto('/#/')
  await importFile(page, multi('Multi', [6, 3]))
  await page.locator('.char-grid').getByRole('button', { name: 'Multi', exact: true }).click()
  await expect(page.locator('.sheet__edit-character')).toBeDisabled()
  await expect(page.locator('.sheet__edit-character')).toHaveAttribute('title', 'Edit unavailable: Cannot tell which class each level came from (no level history).')
  await expect(page.locator('.sheet__level-up')).toBeDisabled()
  await expect(page.locator('.sheet__remove-level')).toBeDisabled()
})

test('M0 b: #/edit/<id> for a multiclass character without a level history lands on its sheet with no wizard', async ({ page }) => {
  await page.goto('/#/')
  await importFile(page, multi('Multi', [6, 3]))
  await page.locator('.char-grid').getByRole('button', { name: 'Multi', exact: true }).click()
  await expect(page.locator('.sheet__edit-character')).toBeVisible()
  const sheetUrl = page.url()
  await page.goto('/#/')
  await page.goto(`${sheetUrl}/edit`)
  await expect(page.locator('.sheet__edit-character')).toBeVisible()
  await expect(page.locator('.char-create')).toHaveCount(0)
  expect(page.url()).toBe(sheetUrl)
})

test('M0 c: levels adding up to 21 are refused and the list does not change', async ({ page }) => {
  await page.goto('/#/')
  await importFile(page, multi('Too High', [12, 9]))
  await expect(page.locator('.error')).toContainText('classes add up to level 21, the maximum is 20.')
  await expect(page.locator('.char-grid .char-card__name')).toHaveCount(0)
})

test('M0 d: a single-class character still opens the wizard from Edit', async ({ page }) => {
  const single = { ...multi('Solo', [3, 0]), id: 'm0-solo', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }] }
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: SINGLE_KEY, payload: JSON.stringify([single]) },
  )
  await page.goto('/#/')
  await page.locator('.char-grid').getByRole('button', { name: 'Solo', exact: true }).click()
  await expect(page.locator('.sheet__edit-character')).toBeEnabled()
  await page.locator('.sheet__edit-character').click()
  await expect(page.locator('.char-create')).toBeVisible()
})
