import { expect, test, type Page } from '@playwright/test'

/* U-1 (D308-D311). Characters seeded into storage before the app loads, as in manageFeats.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }
// A 1x1 JPEG; the stored portrait only has to carry the JPEG data-URL prefix.
const PORTRAIT = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='

function character(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 56,
    id,
    name,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: ABILITIES,
    species: { name: 'Elf', source: 'XPHB' },
    ...extra,
  }
}

async function seed(page: Page): Promise<void> {
  const subjects = [character('c-aria', 'Aria', { portrait: PORTRAIT }), character('c-bree', 'Bree')]
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(subjects) },
  )
}

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const more = (page: Page, name: string) => page.getByRole('button', { name: `More actions for ${name}`, exact: true })
const wordmark = (page: Page) => page.getByRole('button', { name: 'Familliar — your characters' })

test('U-1 a: the list has its heading and neither the Markup demo tab nor the old explanation', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Your characters' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Markup demo' })).toHaveCount(0)
  await expect(page.getByText('Creation opens the real wizard')).toHaveCount(0)
})

test('U-1 b: New character is the first grid item and opens the wizard', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  const first = page.locator('.char-grid > li').first()
  await expect(first.getByRole('button', { name: 'New character' })).toBeVisible()
  await first.getByRole('button', { name: 'New character' }).click()
  await expect(page).toHaveURL(/#\/new$/)
})

test('U-1 c: a card opens the sheet and the wordmark returns to the list', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await card(page, 'Aria').click()
  await expect(page).toHaveURL(/#\/character\/c-aria$/)
  await wordmark(page).click()
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('heading', { name: 'Your characters' })).toBeVisible()
})

test('U-1 d: portrait or letter, and the "<Species> · <Class> <N>" sub line', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await expect(page.getByAltText('Portrait of Aria')).toHaveCount(1)
  await expect(card(page, 'Bree').locator('.char-card__portrait')).toHaveText('B')
  await expect(card(page, 'Bree').locator('.char-card__sub')).toHaveText('Elf · Fighter 3')
})

test('U-1 e: Rename in the card saves on Enter and survives a reload; Esc keeps the old name', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await more(page, 'Bree').click()
  await page.getByRole('button', { name: 'Rename', exact: true }).click()
  await page.keyboard.type('Zed')
  await page.keyboard.press('Escape')
  await expect(card(page, 'Bree')).toBeVisible()

  await more(page, 'Bree').click()
  await page.getByRole('button', { name: 'Rename', exact: true }).click()
  await page.keyboard.type('Brenna')
  await page.keyboard.press('Enter')
  await expect(card(page, 'Brenna')).toBeVisible()
  await page.reload()
  await expect(card(page, 'Brenna')).toBeVisible()
  await expect(card(page, 'Bree')).toHaveCount(0)
})

test('U-1 f, g: Export downloads <name>.json and Import character turns it into a new card', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await more(page, 'Bree').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Bree.json')

  // The imported copy gets a fresh id, so it appears next to the original.
  await page.locator('input[type="file"]').setInputFiles((await file.path()) as string)
  await expect(page.locator('.char-card__name', { hasText: 'Bree' })).toHaveCount(2)
})

test('U-1 h: Delete asks first; Keep and Esc leave the card, Delete removes it for good', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  const dialog = page.getByRole('alertdialog', { name: 'Delete Bree?' })

  await more(page, 'Bree').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog).toContainText('This removes the character from this browser. It cannot be undone.')
  await dialog.getByRole('button', { name: 'Keep' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(card(page, 'Bree')).toBeVisible()

  await more(page, 'Bree').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(card(page, 'Bree')).toBeVisible()

  await more(page, 'Bree').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(card(page, 'Bree')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New character' })).toBeFocused()
  await page.reload()
  await expect(card(page, 'Aria')).toBeVisible()
  await expect(card(page, 'Bree')).toHaveCount(0)
})

test('U-1 i: #/markup-demo still renders the Markup demo page', async ({ page }) => {
  await page.goto('/#/markup-demo')
  await expect(page.getByRole('heading', { name: 'Your characters' })).toHaveCount(0)
  await expect(page.getByText(/5etools markup renderer/)).toBeVisible()
})

test('U-1 j: at phone width the grid is one column and nothing overflows horizontally', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/')
  await expect(card(page, 'Aria')).toBeVisible()
  const columns = await page.locator('.char-grid').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
