import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillUpToBackground, finishFromBackground, select, type FighterOptions } from './wizard.ts'

/*
 * R5a. A Fighter 1 whose wizard masteries are Longsword, Greatsword and Handaxe
 * (wizard.ts), with the class's first gear option (Greatsword, Flail, Javelins)
 * and Acolyte's Magic Initiate (Cleric) set to Guiding Bolt (spell attack) and
 * Sacred Flame (save) — the spell rows without needing a caster class.
 */
async function createFighter(page: Page): Promise<void> {
  const options: FighterOptions = { name: 'Action Tester', level: 1, species: 'Dwarf|XPHB', classGear: true }
  await fillUpToBackground(page, options)
  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await originFeat.getByRole('checkbox', { name: 'Sacred Flame', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guiding Bolt', exact: true }).first().check()
  await select(originFeat, 'Ability').selectOption('wisdom')
  await finishFromBackground(page, options)
}

function actionsPanel(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function row(page: Page, name: string): Locator {
  return actionsPanel(page).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })
}

async function equip(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: `Equip ${name}`, exact: true }).click()
  await page.getByRole('tab', { name: 'Actions' }).click()
}

test.beforeEach(async ({ page }) => {
  await createFighter(page)
})

test('R5a a: All is the default and shows the table and the groups; Attack hides the groups only', async ({ page }) => {
  const actions = actionsPanel(page)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actions.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const bonus = actions.getByRole('region', { name: 'Bonus Action' })
  await expect(actions.getByRole('table')).toBeVisible()
  await expect(bonus).toContainText('Second Wind')

  await actions.getByRole('button', { name: 'Attack', exact: true }).click()
  await expect(bonus).toHaveCount(0)
  await expect(actions.getByRole('table')).toBeVisible()

  await actions.getByRole('button', { name: 'All', exact: true }).click()
  await expect(bonus).toBeVisible()
})

test('R5a b: the weapon HIT and DAMAGE buttons each add a roll history entry', async ({ page }) => {
  await equip(page, 'Greatsword')
  await row(page, 'Greatsword').getByRole('button', { name: 'Roll Greatsword to hit' }).click()
  await row(page, 'Greatsword').getByRole('button', { name: 'Roll Greatsword damage' }).click()
  await page.getByRole('button', { name: 'Rolls', exact: true }).click()
  const history = page.getByRole('dialog', { name: 'Roll history' }).getByRole('listitem')
  await expect(history).toHaveCount(2)
  await expect(history.filter({ hasText: 'Greatsword to hit' })).toHaveCount(1)
  await expect(history.filter({ hasText: 'Greatsword damage' })).toHaveCount(1)
})

test('R5a c: a spell attack has a HIT button that rolls; a save spell shows its DC and no button', async ({ page }) => {
  await page.getByRole('tab', { name: 'Actions' }).click()
  await row(page, 'Guiding Bolt').getByRole('button', { name: 'Roll Guiding Bolt spell attack' }).click()
  await expect(page.locator('.roll-toast')).toContainText('Guiding Bolt spell attack')

  const hit = row(page, 'Sacred Flame').locator('.sheet__action-to-hit')
  await expect(hit).toContainText(/DC \d+ DEX/)
  await expect(hit.getByRole('button')).toHaveCount(0)
})

test('R5a d: the Mastery note shows only on a mastered weapon kind', async ({ page }) => {
  // Javelin (mastery Slow) is not among the wizard's masteries; Greatsword is.
  await equip(page, 'Javelin')
  await expect(row(page, 'Javelin').locator('.sheet__action-notes')).toContainText('Properties: Thrown')
  await expect(row(page, 'Javelin').locator('.sheet__action-notes')).not.toContainText('Mastery')
  await equip(page, 'Greatsword')
  await expect(row(page, 'Greatsword').locator('.sheet__action-notes')).toContainText('Mastery: Graze')
})
