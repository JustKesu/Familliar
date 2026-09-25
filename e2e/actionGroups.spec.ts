import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillUpToBackground, finishFromBackground, select, type FighterOptions } from './wizard.ts'

/*
 * R5c (D182). A Fighter 1 whose Acolyte Magic Initiate (Cleric) takes Healing
 * Word — bonus-action casting, no attack roll, no save — so the Bonus Action
 * group holds a feature (Second Wind) and a spell. Cunning Action (Rogue 2) is a
 * render-level test: the wizard helper builds Fighters only.
 */
async function createFighter(page: Page): Promise<void> {
  const options: FighterOptions = { name: 'Group Tester', level: 1, species: 'Dwarf|XPHB' }
  await fillUpToBackground(page, options)
  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await originFeat.getByRole('checkbox', { name: 'Sacred Flame', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Healing Word', exact: true }).first().check()
  await select(originFeat, 'Ability').selectOption('wisdom')
  await finishFromBackground(page, options)
  await page.getByRole('tab', { name: 'Actions' }).click()
}

function actions(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function group(page: Page, name: string): Locator {
  return actions(page).getByRole('region', { name, exact: true })
}

function secondWind(page: Page): Locator {
  return group(page, 'Bonus Action').locator('.sheet__group-row', { hasText: 'Second Wind' })
}

test.beforeEach(async ({ page }) => {
  await createFighter(page)
})

test('R5c a: Second Wind is a collapsed Bonus Action row; its name opens and closes its text', async ({ page }) => {
  const row = secondWind(page)
  const toggle = row.getByRole('button', { name: 'Second Wind', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(row.locator('.sheet__group-row-text')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(row.locator('.sheet__group-row-text')).toContainText('stamina')

  await toggle.click()
  await expect(row.locator('.sheet__group-row-text')).toHaveCount(0)
})

test('R5c b: Second Wind boxes mark and undo one use, survive a reload, and a Long Rest empties them', async ({ page }) => {
  const row = secondWind(page)
  const used = row.locator('.sheet__use-box--used')
  await expect(row.getByRole('button', { name: 'Use Second Wind' })).toHaveCount(2)
  await expect(used).toHaveCount(0)

  await row.getByRole('button', { name: 'Use Second Wind' }).first().click()
  await expect(used).toHaveCount(1)
  await expect(row.locator('.sheet__group-row-text')).toHaveCount(0)
  await row.getByRole('button', { name: 'Undo a use of Second Wind' }).click()
  await expect(used).toHaveCount(0)

  // The count is the stored play.resourceUses record, not row state.
  await row.getByRole('button', { name: 'Use Second Wind' }).first().click()
  await page.reload()
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(used).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used).toHaveCount(0)
})

test('R5c c: filters — Bonus Action only its group, Attack only the table, Action the table without other groups, All everything', async ({ page }) => {
  const table = actions(page).getByRole('table')
  await expect(table).toBeVisible()
  await expect(group(page, 'Bonus Action')).toBeVisible()
  await expect(group(page, 'Other')).toBeVisible()

  await actions(page).getByRole('button', { name: 'Bonus Action', exact: true }).click()
  await expect(table).toHaveCount(0)
  await expect(group(page, 'Bonus Action')).toBeVisible()
  await expect(group(page, 'Other')).toHaveCount(0)

  await actions(page).getByRole('button', { name: 'Attack', exact: true }).click()
  await expect(table).toBeVisible()
  await expect(actions(page).locator('.sheet__action-group')).toHaveCount(0)

  await actions(page).getByRole('button', { name: 'Action', exact: true }).click()
  await expect(table).toBeVisible()
  await expect(group(page, 'Bonus Action')).toHaveCount(0)
  await expect(group(page, 'Other')).toHaveCount(0)

  await actions(page).getByRole('button', { name: 'All', exact: true }).click()
  await expect(table).toBeVisible()
  await expect(group(page, 'Bonus Action')).toBeVisible()
  await expect(group(page, 'Other')).toBeVisible()
})

test('R5c d: Healing Word (bonus action, no attack or save) is in the Bonus Action group and not in the table', async ({ page }) => {
  await expect(group(page, 'Bonus Action').locator('.sheet__group-row', { hasText: 'Healing Word' })).toHaveCount(1)
  await expect(actions(page).getByRole('table').getByText('Healing Word')).toHaveCount(0)
})
