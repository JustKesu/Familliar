import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/* F-25b (D354): a saved entry that cannot be read becomes its own card instead of breaking the whole list. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }

const valid = {
  schemaVersion: 61,
  id: 'f25b-good',
  name: 'Good One',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
  levelOrder: Array.from({ length: 4 }, () => ({ className: 'Fighter', classSource: 'XPHB' })),
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: SCORES },
  species: { name: 'Human', source: 'XPHB' },
  speciesSize: 'M',
  currentHp: 10,
}
const damaged = { schemaVersion: 61, id: 'f25b-bad', name: 'Broken One', classes: 'nope' }
const newer = { schemaVersion: 999, id: 'f25b-future', name: 'Future One', anything: [1, 2] }

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([valid, damaged, newer]) },
  )
}

const cards = (page: Page) => page.locator('.char-grid .char-card')
const damagedCard = (page: Page) => cards(page).filter({ hasText: 'Broken One' })
const newerCard = (page: Page) => cards(page).filter({ hasText: 'Future One' })

test('F-25b a: the valid character and both unreadable ones show as cards with their labels', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await expect(cards(page)).toHaveCount(3)
  await expect(damagedCard(page)).toContainText('Damaged')
  await expect(newerCard(page)).toContainText('Saved by a newer version')
  await expect(newerCard(page)).toContainText('Reload the page to open it.')
  await expect(page.locator('p.error')).toHaveCount(0)
})

test('F-25b b: the valid character still opens its sheet, an unreadable card does nothing when clicked', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await damagedCard(page).locator('.char-card__name').click()
  await newerCard(page).locator('.char-card__name').click()
  await expect(page).toHaveURL(/#\/$/)
  await page.getByRole('button', { name: 'Good One', exact: true }).click()
  await expect(page).toHaveURL(/#\/character\/f25b-good$/)
})

test('F-25b c: Export on the damaged card downloads its raw entry in an array', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  const download = page.waitForEvent('download')
  await damagedCard(page).getByRole('button', { name: 'Export Broken One', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Broken One.json')
  expect(JSON.parse(readFileSync((await file.path()) as string, 'utf8'))).toEqual([damaged])
})

test('F-25b d: Delete on the damaged card asks first and removes only it; the newer card has no Delete', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await expect(newerCard(page).getByRole('button', { name: 'Export Future One', exact: true })).toBeVisible()
  await expect(newerCard(page).getByRole('button', { name: /Delete/ })).toHaveCount(0)

  await damagedCard(page).getByRole('button', { name: /Delete/ }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Broken One?' })
  await dialog.getByRole('button', { name: 'Keep' }).click()
  await expect(cards(page)).toHaveCount(3)

  await damagedCard(page).getByRole('button', { name: /Delete/ }).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(cards(page)).toHaveCount(2)
  await expect(damagedCard(page)).toHaveCount(0)
  await expect(newerCard(page)).toHaveCount(1)
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]') as { id: string }[], STORAGE_KEY)
  expect(stored.map((entry) => entry.id)).toEqual(['f25b-good', 'f25b-future'])
})

test('F-25b e: a write on the valid character keeps both unreadable cards after a reload', async ({ page }) => {
  await seed(page)
  await page.goto('/#/character/f25b-good')
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await page.goto('/#/')
  await page.reload()
  await expect(cards(page)).toHaveCount(3)
  await expect(damagedCard(page)).toContainText('Damaged')
  await expect(newerCard(page)).toContainText('Saved by a newer version')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[], STORAGE_KEY)
  expect(stored).toContainEqual(damaged)
  expect(stored).toContainEqual(newer)
})
