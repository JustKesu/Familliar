import { expect, test, type Page } from '@playwright/test'

/* MON-2 (D432): the DM area's read-only Bestiary and monster stat block. */

const row = (page: Page, name: string) => page.locator('.bestiary__row', { has: page.locator('.bestiary__name', { hasText: new RegExp(`^${name}$`) }) })
const count = (page: Page) => page.locator('.bestiary__count')
const card = (page: Page) => page.locator('.monster-card')

async function openBestiary(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'DM', exact: true }).click()
  await expect(page).toHaveURL(/#\/dm\/bestiary$/)
  await expect(page.getByRole('tab', { name: 'Bestiary' })).toHaveAttribute('aria-selected', 'true')
  await expect(count(page)).toHaveText('648 monsters')
}

async function countNumber(page: Page): Promise<number> {
  return Number.parseInt((await count(page).textContent()) ?? '', 10)
}

test('MON-2 a–d: header DM button, search, Wolf card, CR filter', async ({ page }) => {
  await openBestiary(page)

  await page.getByRole('tab', { name: 'Encounters' }).click()
  await expect(page.getByText('Encounters come in the next update.')).toBeVisible()
  await expect(page).toHaveURL(/#\/dm$/)
  await page.getByRole('tab', { name: 'Bestiary' }).click()

  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('wolf')
  await expect(row(page, 'Wolf')).toBeVisible()
  await expect(row(page, 'Dire Wolf')).toBeVisible()

  await row(page, 'Wolf').click()
  await expect(card(page).getByRole('heading', { name: 'Wolf' })).toBeVisible()
  await expect(card(page).locator('.beast__vitals')).toContainText('AC 12')
  await expect(card(page).locator('.beast__vitals')).toContainText('HP 11 (2d8 + 2)')
  await expect(card(page).getByRole('region', { name: 'Actions' })).toContainText('Bite.')

  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('')
  await expect(count(page)).toHaveText('648 monsters')
  await page.getByLabel('CR from').selectOption({ label: '5' })
  const narrowed = await countNumber(page)
  expect(narrowed).toBeGreaterThan(0)
  expect(narrowed).toBeLessThan(648)
  await page.getByLabel('CR to').selectOption({ label: '10' })
  // DATA.md MON-1: CR band 5–10 holds 175 monsters.
  await expect(count(page)).toHaveText('175 monsters')
})

test('MON-2 e: Adult Green Dragon shows Legendary Resistance, Legendary Actions and a Lair section', async ({ page }) => {
  await openBestiary(page)
  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('adult green')
  await row(page, 'Adult Green Dragon').click()

  await expect(card(page).getByRole('region', { name: 'Traits' })).toContainText('Legendary Resistance (3/Day, or 4/Day in Lair)')
  const legendary = card(page).getByRole('region', { name: 'Legendary Actions' })
  await expect(legendary).toContainText('Legendary Action Uses: 3 (4 in Lair).')
  await expect(legendary).toContainText('Pounce')
  await expect(card(page).getByRole('region', { name: 'Lair' })).toContainText('Regional Effects')
  await expect(card(page).locator('.beast__vitals')).toContainText('Initiative +11')
  await expect(card(page).locator('.monster-card__save--proficient')).toHaveText(['save +6', 'save +7'])
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('MON-2 f: the card replaces the list, with a back button, no horizontal overflow', async ({ page }) => {
    await openBestiary(page)
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await noOverflow()

    await page.getByRole('searchbox', { name: 'Search monsters' }).fill('wolf')
    await row(page, 'Wolf').click()
    await expect(card(page).getByRole('heading', { name: 'Wolf' })).toBeVisible()
    await expect(page.locator('.bestiary__row')).toHaveCount(0)
    await noOverflow()

    await page.getByRole('button', { name: '← Back to list' }).click()
    await expect(row(page, 'Dire Wolf')).toBeVisible()
    await expect(card(page)).toHaveCount(0)

    await page.getByRole('searchbox', { name: 'Search monsters' }).fill('adult green')
    await row(page, 'Adult Green Dragon').click()
    await expect(card(page).getByRole('region', { name: 'Lair' })).toBeVisible()
    await noOverflow()
  })
})
