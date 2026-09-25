import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/* D183: Short Rest opens a drawer with the hit dice; the rest itself happens only on Finish Short Rest. */
const shortRestButton = (page: Page): Locator => page.getByRole('button', { name: 'Short Rest', exact: true })
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Short Rest' })
const hpValue = (page: Page): Locator => page.locator('.sheet__hit-points-value')
const hitDiceRow = (page: Page): Locator => drawer(page).locator('.sheet__hit-dice > ul > li')

async function currentHp(page: Page): Promise<number> {
  return Number((await hpValue(page).innerText()).split('/')[0])
}

async function dealDamage(page: Page, amount: string): Promise<void> {
  const group = page.getByRole('group', { name: 'Damage and healing' })
  await group.getByLabel('Amount').fill(amount)
  await group.getByRole('button', { name: 'Damage', exact: true }).click()
}

async function useSecondWind(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByRole('button', { name: 'Use Second Wind' }).first().click()
}

/* R6: the Features & Traits panel carries the same boxes, so count only the Actions tab's. */
const usedBoxes = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__use-box--used')

test.beforeEach(async ({ page }) => {
  await createFighter(page, { name: 'Rester', level: 2, species: 'Dwarf|XPHB' })
  await dealDamage(page, '5')
})

test('D183 a: SHORT REST opens the Short Rest drawer with the Hit Dice section', async ({ page }) => {
  await shortRestButton(page).click()
  await expect(drawer(page)).toBeVisible()
  await expect(drawer(page).getByText('Hit Dice', { exact: true })).toBeVisible()
  await expect(hitDiceRow(page)).toContainText('2 / 2 remaining')
  await expect(drawer(page).getByRole('button', { name: 'Finish Short Rest' })).toBeVisible()
})

test('D183 b: rolling a hit die raises HP and spends one die', async ({ page }) => {
  const before = await currentHp(page)
  await shortRestButton(page).click()
  await drawer(page).getByRole('button', { name: 'Roll Fighter hit die' }).click()
  await expect(hitDiceRow(page)).toContainText('1 / 2 remaining')
  expect(await currentHp(page)).toBeGreaterThan(before)
})

test('D183 c: Finish Short Rest closes the drawer and restores the short-rest resource', async ({ page }) => {
  await useSecondWind(page)
  await expect(usedBoxes(page)).toHaveCount(1)

  await shortRestButton(page).click()
  await drawer(page).getByRole('button', { name: 'Finish Short Rest' }).click()

  await expect(drawer(page)).toHaveCount(0)
  await expect(usedBoxes(page)).toHaveCount(0)
})

test('D183 d: Esc keeps the rolled die and the HP but does not restore the resource', async ({ page }) => {
  await useSecondWind(page)
  const before = await currentHp(page)

  await shortRestButton(page).click()
  await drawer(page).getByRole('button', { name: 'Roll Fighter hit die' }).click()
  await page.keyboard.press('Escape')

  await expect(drawer(page)).toHaveCount(0)
  expect(await currentHp(page)).toBeGreaterThan(before)
  await expect(usedBoxes(page)).toHaveCount(1)

  await shortRestButton(page).click()
  await expect(hitDiceRow(page)).toContainText('1 / 2 remaining')
})

test('D183 e: the Hit Points drawer has no Hit dice section', async ({ page }) => {
  await page.getByRole('button', { name: 'Hit points details' }).click()
  const hp = page.getByRole('dialog', { name: 'Hit Points' })
  await expect(hp).toBeVisible()
  await expect(hp.getByText(/hit dice/i)).toHaveCount(0)
})

test('D183 f: Long Rest still restores HP and hit dice', async ({ page }) => {
  await shortRestButton(page).click()
  await drawer(page).getByRole('button', { name: 'Roll Fighter hit die' }).click()
  await expect(hitDiceRow(page)).toContainText('1 / 2 remaining')
  await page.keyboard.press('Escape')
  await dealDamage(page, '5')

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()

  await expect(hpValue(page)).toHaveText(/^(\d+)\s*\/\s*\1$/)
  await shortRestButton(page).click()
  await expect(hitDiceRow(page)).toContainText('2 / 2 remaining')
})
