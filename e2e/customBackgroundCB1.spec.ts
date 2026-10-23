import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, fillUpToBackground, finishFromBackground, next, nextButton, select, wizardNav, type FighterOptions } from './wizard.ts'

/* CB-1 (D383): a custom background — name, 2 free skills, any PHB tool, an Origin feat, a free ability trio, 50 gp. */

const OPTIONS: FighterOptions = { name: 'Scholar', level: 1, species: 'Dwarf|XPHB' }

const skills = (page: Page): Locator => page.getByRole('group', { name: 'Custom background skills' })
const abilities = (page: Page): Locator => page.getByRole('group', { name: 'Custom background abilities' })
const tool = (page: Page): Locator => page.getByRole('radio', { name: /^Thieves.? Tools$/ })
const alert = (page: Page): Locator => page.getByRole('list', { name: 'Origin feats' }).getByRole('radio', { name: 'Alert', exact: true })
const nameField = (page: Page): Locator => page.getByRole('textbox', { name: 'Background name' })

async function chooseCustom(page: Page): Promise<void> {
  await fillUpToBackground(page, OPTIONS)
  await page.getByRole('radio', { name: 'Custom background' }).check()
}

async function fillCustom(page: Page): Promise<void> {
  await expect(nextButton(page)).toBeDisabled()
  await nameField(page).fill('Temple Scholar')
  await expect(nextButton(page)).toBeDisabled()
  await skills(page).getByRole('checkbox', { name: 'History', exact: true }).check()
  await skills(page).getByRole('checkbox', { name: 'Insight', exact: true }).check()
  await expect(nextButton(page)).toBeDisabled()
  await tool(page).check()
  await expect(nextButton(page)).toBeDisabled()
  await alert(page).check()
  await expect(nextButton(page)).toBeDisabled()
  for (const ability of ['Intelligence', 'Wisdom', 'Charisma']) await abilities(page).getByRole('checkbox', { name: ability, exact: true }).check()
  await expect(nextButton(page)).toBeDisabled()
  await select(page, '+2').selectOption('wisdom')
  await expect(nextButton(page)).toBeDisabled()
  await select(page, '+1').selectOption('intelligence')
  await expect(nextButton(page)).toBeEnabled()
}

async function createScholar(page: Page): Promise<void> {
  await chooseCustom(page)
  await fillCustom(page)
  await finishFromBackground(page, OPTIONS)
}

async function expectScholarSheet(page: Page): Promise<void> {
  await expect(page.locator('.sheet__background')).toHaveText('Temple Scholar')
  await expect(page.locator('.sheet__skills li', { hasText: 'History' })).toContainText('●')
  await expect(page.locator('.sheet__skills li', { hasText: 'Insight' })).toContainText('●')
  await expect(page.locator('.sheet__proficiencies')).toContainText(/Thieves.? Tools/)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const feats = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('.sheet__group-row-name', { hasText: /^Alert$/ })).toHaveCount(1)
  await page.getByRole('tab', { name: 'Inventory' }).click()
  // Fighter's last class option is 155 gp; the custom background adds 50.
  await expect(page.getByRole('tabpanel', { name: 'Inventory' }).locator('.sheet__currency')).toContainText('205 gp')
}

test('CB-1 a: Next waits for name, 2 skills, tool, feat and the ability bonus', async ({ page }) => {
  await chooseCustom(page)
  await fillCustom(page)
})

test('CB-1 b: a class skill is disabled in the custom skill list', async ({ page }) => {
  await chooseCustom(page)
  await expect(skills(page).getByRole('checkbox', { name: /^Athletics/ })).toBeDisabled()
  await expect(skills(page)).toContainText('Athletics (already granted by Fighter)')
})

test('CB-1 c: the sheet shows the custom background, and it survives a reload', async ({ page }) => {
  await createScholar(page)
  await expectScholarSheet(page)
  await page.reload()
  await expectScholarSheet(page)
})

test('CB-1 d: Edit Character without changes keeps background, skills, tool and feat', async ({ page }) => {
  await createScholar(page)
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  const current = page.locator('[aria-current="step"]')
  for (let steps = 0; steps < 4 && !(await current.textContent())?.includes('Background'); steps++) await next(page)
  await expectStep(page, 'Background')
  await expect(nameField(page)).toHaveValue('Temple Scholar')
  await expect(skills(page).getByRole('checkbox', { name: 'History', exact: true })).toBeChecked()
  await expect(tool(page)).toBeChecked()
  await expect(alert(page)).toBeChecked()
  await expect(nextButton(page)).toBeEnabled()
  while (!(await wizardNav(page).getByRole('button', { name: 'Save changes' }).isVisible())) await next(page)
  await wizardNav(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expectScholarSheet(page)
})
