import { expect, test, type Page } from '@playwright/test'

/* MON-3 (D433): saved encounters, the setup screen, and the Bestiary card fixes. */

const KEY = 'familliar:encounters'
const item = (page: Page, name: string) => page.locator('.encounters__item', { has: page.locator('.encounters__name', { hasText: new RegExp(`^${name}$`) }) })

async function buildWolves(page: Page): Promise<void> {
  await page.goto('/#/dm')
  await expect(page.getByText('No encounters yet.')).toBeVisible()
  await page.getByRole('button', { name: 'New encounter' }).click()
  await expect(page).toHaveURL(/#\/dm\/encounter\/new$/)

  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Wolves')
  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('wolf')
  await page.getByRole('button', { name: 'Add Wolf', exact: true }).click()
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'More Wolf', exact: true }).click()
  await expect(page.getByLabel('Wolf count', { exact: true })).toHaveText('6')
  await expect(page.getByRole('textbox', { name: 'Wolf name 6', exact: true })).toHaveValue('Wolf 6')
  await expect(page.getByRole('checkbox', { name: 'One initiative roll' })).toBeChecked()

  await page.getByRole('button', { name: 'Add Dire Wolf', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Dire Wolf name 1', exact: true })).toHaveValue('Dire Wolf')
  await page.getByRole('textbox', { name: 'Dire Wolf name 1', exact: true }).fill('Alpha')

  await expect(page.getByRole('region', { name: 'Difficulty' })).toHaveCount(0)
  await page.getByRole('spinbutton', { name: 'Players' }).fill('4')
  await page.getByRole('spinbutton', { name: 'Level' }).fill('2')
  const difficulty = page.getByRole('region', { name: 'Difficulty' })
  await expect(difficulty.locator('.encounter-difficulty__total')).toHaveText('500 XP')
  await expect(difficulty.locator('.encounter-difficulty__label')).toHaveText('Moderate')
  await expect(difficulty.locator('.encounter-difficulty__thresholds')).toHaveText('Low 400Moderate 600High 800')

  await page.getByRole('textbox', { name: 'Player name' }).fill('Ana')
  await page.getByRole('button', { name: 'Add player' }).click()
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Ana')
}

test('MON-3 a–c: create, reload and edit, delete', async ({ page }) => {
  await buildWolves(page)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL(/#\/dm$/)
  await expect(item(page, 'Wolves').locator('.encounters__summary')).toHaveText('Wolf x6, Dire Wolf')
  await expect(item(page, 'Wolves').locator('.encounters__xp')).toHaveText('500 XP · Moderate')

  await page.reload()
  await item(page, 'Wolves').getByRole('button', { name: 'Edit Wolves' }).click()
  await expect(page).toHaveURL(/#\/dm\/encounter\/[^/]+$/)
  await expect(page.getByRole('textbox', { name: 'Dire Wolf name 1', exact: true })).toHaveValue('Alpha')
  await expect(page.getByRole('list', { name: 'Players' })).toContainText('Ana')
  await page.getByRole('button', { name: 'Fewer Wolf', exact: true }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Discard changes?' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(item(page, 'Wolves').locator('.encounters__summary')).toHaveText('Wolf x5, Dire Wolf')
  await expect(item(page, 'Wolves').locator('.encounters__xp')).toHaveText('450 XP · Moderate')

  await page.getByRole('button', { name: 'Delete Wolves' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Wolves?' })
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('No encounters yet.')).toBeVisible()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null').encounters.length, KEY)).toBe(0)
})

test('MON-3 d: a corrupt key shows a notice and the app keeps working; a bad entry is skipped', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), KEY)
  await page.goto('/#/dm')
  await expect(page.getByRole('alert')).toContainText('Saved encounters could not be read.')
  await page.getByRole('tab', { name: 'Bestiary' }).click()
  await expect(page.locator('.bestiary__count')).toHaveText('648 monsters')
  await page.getByRole('tab', { name: 'Encounters' }).click()
  await page.getByRole('button', { name: 'Clear encounter data' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText('No encounters yet.')).toBeVisible()

  const good = { id: 'e1', name: 'Kept', createdAt: 'x', updatedAt: 'x', party: null, players: [], groups: [{ id: 'g1', monster: { name: 'Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'm1', name: 'Wolf' }] }] }
  const renamed = { ...good, id: 'e2', name: 'Renamed', groups: [{ ...good.groups[0], monster: { name: 'Old Wolf', source: 'XMM' } }] }
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify({ schemaVersion: 1, encounters: [{ id: 'bad' }, good, renamed] })])
  await page.reload()
  await expect(page.getByRole('alert')).toHaveText('1 saved encounter could not be read and is hidden.')
  await expect(item(page, 'Kept').locator('.encounters__xp')).toHaveText('50 XP')

  await page.getByRole('button', { name: 'Edit Renamed' }).click()
  await expect(page.getByRole('region', { name: 'Old Wolf group' })).toContainText('Unknown monster')
  await page.getByRole('button', { name: 'More Old Wolf', exact: true }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(item(page, 'Renamed').locator('.encounters__summary')).toHaveText('Old Wolf x2')
})

test('MON-3 e: Bestiary stat block runs the trait name into its text; singular count', async ({ page }) => {
  await page.goto('/#/dm/bestiary')
  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('adult green')
  await expect(page.locator('.bestiary__count')).toHaveText('1 monster')
  await page.locator('.bestiary__row', { hasText: 'Adult Green Dragon' }).click()
  const traits = page.locator('.monster-card').getByRole('region', { name: 'Traits' })
  await expect(traits.locator('p', { hasText: 'Amphibious.' }).first()).toHaveText('Amphibious. The dragon can breathe air and water.')
  const gap = await traits.locator('li').evaluateAll((items) => items[1].getBoundingClientRect().top - items[0].getBoundingClientRect().bottom)
  expect(gap).toBeLessThanOrEqual(8)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('MON-3 f: the setup flow at 390px without horizontal overflow', async ({ page }) => {
    const noOverflow = async () => {
      const wide = await page.evaluate(() =>
        [document.documentElement, ...document.querySelectorAll('main, main *')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && el.clientWidth > 0)
          .map((el) => `${el.tagName}.${el.className}`)
          .slice(0, 5),
      )
      expect(wide).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
    await buildWolves(page)
    await noOverflow()
    const search = await page.getByRole('searchbox', { name: 'Search monsters' }).boundingBox()
    const from = await page.getByLabel('CR from').boundingBox()
    const to = await page.getByLabel('CR to').boundingBox()
    expect(Math.abs(from!.y - to!.y)).toBeLessThan(4)
    expect(search!.width).toBeGreaterThan(300)
    const step = await page.getByRole('button', { name: 'More Wolf', exact: true }).boundingBox()
    expect(step!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(item(page, 'Wolves')).toBeVisible()
    await noOverflow()
  })
})
