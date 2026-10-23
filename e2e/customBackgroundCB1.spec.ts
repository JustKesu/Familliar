import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, equipmentChooseAny, expectStep, fillUpToBackground, finishFromBackground, next, nextButton, select, wizardNav, type FighterOptions } from './wizard.ts'

/* CB-1 (D383): a custom background — name, 2 free skills, any PHB tool, an Origin feat, a free ability trio, 50 gp. CB-2: Edit and level up. */

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

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const skillRow = (page: Page, skill: string): Locator => page.locator('.sheet__skills li', { hasText: skill })
const score = (page: Page, ability: string): Locator => page.locator(`.ability-card[data-ability="${ability}"] .ability-card__score`)

async function editToBackground(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 4 && !(await currentStep(page).textContent())?.includes('Background'); steps++) await next(page)
  await expectStep(page, 'Background')
}

/** A complete choice starts collapsed in Edit. */
async function openBackgroundList(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Background Background chosen/ }).click()
}

/** A switched background clears its equipment pick, so the walk retakes the background's last card on the way. */
async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 12 && !(await save.isVisible()); steps++) {
    if ((await currentStep(page).textContent())?.includes('Starting equipment')) await equipmentChooseAny(page, 'background', 'last').click()
    await next(page)
  }
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

test('CB-1 d, CB-2 c: Edit Character without changes keeps background, skills, tool and feat; its own skills stay enabled', async ({ page }) => {
  await createScholar(page)
  await editToBackground(page)
  await expect(nameField(page)).toHaveValue('Temple Scholar')
  for (const skill of ['History', 'Insight']) {
    await expect(skills(page).getByRole('checkbox', { name: skill, exact: true })).toBeChecked()
    await expect(skills(page).getByRole('checkbox', { name: skill, exact: true })).toBeEnabled()
  }
  await expect(skills(page)).not.toContainText('History (already granted')
  await expect(tool(page)).toBeChecked()
  await expect(alert(page)).toBeChecked()
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)
  await expectScholarSheet(page)
})

test('CB-2 a: Edit from the custom background to Acolyte replaces skills, tool and feat', async ({ page }) => {
  await createScholar(page)
  await editToBackground(page)
  await openBackgroundList(page)
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('wisdom')
  await select(page, '+1').selectOption('intelligence')
  await saveEdit(page)
  await expect(page.locator('.sheet__background')).toHaveText('Acolyte')
  await expect(skillRow(page, 'History')).not.toContainText('●')
  await expect(skillRow(page, 'Insight')).toContainText('●')
  await expect(skillRow(page, 'Religion')).toContainText('●')
  await expect(page.locator('.sheet__proficiencies')).toContainText("Calligrapher's Supplies")
  await expect(page.locator('.sheet__proficiencies')).not.toContainText(/Thieves.? Tools/)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const feats = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('.sheet__group-row-name', { hasText: /^Magic Initiate/ })).toHaveCount(1)
  await expect(feats.locator('.sheet__group-row-name', { hasText: /^Alert$/ })).toHaveCount(0)
})

test('CB-2 b: Edit from Acolyte to a custom background gates Next and saves it', async ({ page }) => {
  await createFighter(page, OPTIONS)
  await editToBackground(page)
  await openBackgroundList(page)
  await page.getByRole('radio', { name: 'Custom background' }).check()
  await fillCustom(page)
  await saveEdit(page)
  await expectScholarSheet(page)
})

test('CB-2 d: levelling the custom-background Fighter 1 → 2 keeps the background', async ({ page }) => {
  await createScholar(page)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 1 → 2', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const save = wizardNav(page).getByRole('button', { name: 'Save level 2' })
  for (let steps = 0; steps < 12 && !(await save.isVisible()); steps++) {
    if ((await currentStep(page).textContent())?.includes('Hit points')) {
      await page.getByRole('radiogroup', { name: 'Level 2 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await next(page)
  }
  await save.click()
  await expect(page).not.toHaveURL(/\/level-up/)
  // Wisdom 10 +2 and Intelligence 12 +1 from the custom background's bonus.
  await expect(score(page, 'wisdom')).toHaveText('12')
  await expect(score(page, 'intelligence')).toHaveText('13')
  await expectScholarSheet(page)
})
