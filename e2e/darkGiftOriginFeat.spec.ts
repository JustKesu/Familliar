import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, featOption, fillUpToBackground, finishFromBackground, next, nextButton, takeFighterLevel4Mastery, wizardNav, type FighterOptions } from './wizard.ts'

/* D205: any background's origin feat can be swapped for a Dark Gift; Mist Wanderer and Spirit Medium require one. */

const DARK_GIFTS = ['Aberrant Anatomy', 'Echoing Soul', 'Gathered Whispers', 'Living Shadow', 'Mist Walker', 'Second Skin', 'Symbiotic Being', 'Touch of Death', 'Watchers']

const SPIRIT_MEDIUM = { radio: 'Spirit Medium (RHW)', plusTwo: 'wisdom', plusOne: 'constitution' }
const MIST_WANDERER = { radio: 'Mist Wanderer (RHW)', plusTwo: 'dexterity', plusOne: 'constitution' }
const HAUNTED_ONE = { radio: 'Haunted One (RHW)', plusTwo: 'constitution', plusOne: 'wisdom' }
const FARMER = { radio: 'Farmer (XPHB)', plusTwo: 'strength', plusOne: 'constitution' }

const darkGiftList = (page: Page): Locator => page.getByRole('list', { name: 'Dark Gift feats' })
const darkGift = (page: Page, name: string): Locator => darkGiftList(page).getByRole('radio', { name: `${name} — Dark Gift`, exact: true })
const abilitySelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Spellcasting ability', exact: true })

async function pickFirstTool(page: Page): Promise<void> {
  await page.locator('input[name="tool-proficiency"]').first().check()
}

function feats(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
}

function featRow(page: Page, name: string): Locator {
  return feats(page).locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
}

async function openFeatures(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
}

async function editToBackground(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  const current = page.locator('[aria-current="step"]')
  for (let steps = 0; steps < 4 && !(await current.textContent())?.includes('Background'); steps++) await next(page)
  await expectStep(page, 'Background')
}

async function saveEdit(page: Page): Promise<void> {
  while (!(await wizardNav(page).getByRole('button', { name: 'Save changes' }).isVisible())) await next(page)
  await wizardNav(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

async function createSpiritMedium(page: Page): Promise<void> {
  const options: FighterOptions = { name: 'Medium', level: 1, species: 'Dwarf|XPHB', background: SPIRIT_MEDIUM }
  await fillUpToBackground(page, options)
  await pickFirstTool(page)
  await expect(page.getByText('Origin feat: a Dark Gift feat of your choice')).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  await expect(darkGiftList(page).locator('label')).toHaveText(DARK_GIFTS.map((name) => `${name} — Dark Gift`))
  await darkGift(page, 'Gathered Whispers').check()
  await expect(abilitySelect(page).getByRole('option')).toHaveText(['Choose an ability', 'Intelligence', 'Wisdom', 'Charisma'])
  await abilitySelect(page).selectOption('wisdom')
  await expect(nextButton(page)).toBeEnabled()
  await finishFromBackground(page, options)
}

async function createFarmerWithEchoingSoul(page: Page): Promise<void> {
  const options: FighterOptions = { name: 'Farmhand', level: 1, species: 'Dwarf|XPHB', background: FARMER }
  await fillUpToBackground(page, options)
  await expect(page.getByRole('radio', { name: 'Tough', exact: true })).toBeChecked()
  await expect(darkGiftList(page)).toHaveCount(0)
  await page.getByRole('radio', { name: 'A Dark Gift feat instead', exact: true }).check()
  await darkGift(page, 'Echoing Soul').check()
  await page.getByLabel('Echoing Soul skill 1', { exact: true }).selectOption('acrobatics')
  await page.getByLabel('Echoing Soul skill 2', { exact: true }).selectOption('history')
  await finishFromBackground(page, options)
}

function skillRow(page: Page, skill: string): Locator {
  return page.locator('.sheet__skills li', { hasText: skill })
}

test('D205 a: Spirit Medium needs a Dark Gift; Gathered Whispers reaches the Spells and Features tabs', async ({ page }) => {
  await createSpiritMedium(page)
  await page.getByRole('tab', { name: 'Spells' }).click()
  const spells = page.getByRole('tabpanel', { name: 'Spells' })
  const named = (name: string) => page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
  await expect(spells.locator('.sheet__spell-row', { has: named('Message') })).toHaveCount(1)
  const augury = spells.locator('.sheet__spell-row--use', { has: named('Augury') })
  await expect(augury).toHaveCount(1)
  await expect(augury.locator('.sheet__spell-notes')).toContainText('/ Long Rest')
  await openFeatures(page)
  await expect(featRow(page, 'Gathered Whispers').locator('.sheet__group-row-source')).toHaveText('From Background')
})

test('D205 b: Farmer takes Echoing Soul instead of Tough — its skills reach the sheet and Tough is gone', async ({ page }) => {
  await createFarmerWithEchoingSoul(page)
  await expect(skillRow(page, 'Acrobatics')).toContainText('●')
  await expect(skillRow(page, 'History')).toContainText('●')
  await openFeatures(page)
  await expect(featRow(page, 'Echoing Soul').locator('.sheet__group-row-source')).toHaveText('From Background')
  await expect(featRow(page, 'Tough')).toHaveCount(0)
})

test('D205 c: Haunted One keeps Survivor without touching the Dark Gift control', async ({ page }) => {
  const options: FighterOptions = { name: 'Haunted', level: 1, species: 'Dwarf|XPHB', background: HAUNTED_ONE }
  await fillUpToBackground(page, options)
  await pickFirstTool(page)
  await expect(page.getByRole('radio', { name: 'Survivor', exact: true })).toBeChecked()
  await expect(darkGiftList(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
  await finishFromBackground(page, options)
  await openFeatures(page)
  await expect(featRow(page, 'Survivor').locator('.sheet__group-row-source')).toHaveText('From Background')
})

test('D205 d: changing the background clears the Dark Gift', async ({ page }) => {
  await fillUpToBackground(page, { name: 'Switcher', level: 1, species: 'Dwarf|XPHB', background: SPIRIT_MEDIUM })
  await pickFirstTool(page)
  await darkGift(page, 'Gathered Whispers').check()
  await expect(nextButton(page)).toBeEnabled()

  await page.getByRole('radio', { name: MIST_WANDERER.radio }).check()
  await page.getByRole('combobox', { name: '+2', exact: true }).selectOption(MIST_WANDERER.plusTwo)
  await page.getByRole('combobox', { name: '+1', exact: true }).selectOption(MIST_WANDERER.plusOne)
  await pickFirstTool(page)
  await expect(darkGift(page, 'Gathered Whispers')).not.toBeChecked()
  await expect(nextButton(page)).toBeDisabled()

  await darkGift(page, 'Watchers').check()
  await page.getByRole('radio', { name: FARMER.radio }).check()
  await page.getByRole('combobox', { name: '+2', exact: true }).selectOption(FARMER.plusTwo)
  await page.getByRole('combobox', { name: '+1', exact: true }).selectOption(FARMER.plusOne)
  await expect(page.getByRole('radio', { name: 'Tough', exact: true })).toBeChecked()
  await expect(darkGiftList(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('D205 e: Edit Character keeps the Dark Gift and its ability', async ({ page }) => {
  await createSpiritMedium(page)
  await editToBackground(page)
  await expect(darkGift(page, 'Gathered Whispers')).toBeChecked()
  await expect(abilitySelect(page)).toHaveValue('wisdom')
  await expect(nextButton(page)).toBeEnabled()
})

test('D205 e: Edit Character — switching back to the named feat persists', async ({ page }) => {
  await createFarmerWithEchoingSoul(page)
  await editToBackground(page)
  await expect(darkGift(page, 'Echoing Soul')).toBeChecked()
  await page.getByRole('radio', { name: 'Tough', exact: true }).check()
  await saveEdit(page)
  await openFeatures(page)
  await expect(featRow(page, 'Tough').locator('.sheet__group-row-source')).toHaveText('From Background')
  await expect(featRow(page, 'Echoing Soul')).toHaveCount(0)
  await editToBackground(page)
  await expect(page.getByRole('radio', { name: 'Tough', exact: true })).toBeChecked()
})

test('D205 f: a Dark Gift taken at background is not offered again at level 4', async ({ page }) => {
  const options: FighterOptions = { name: 'Toucher', level: 3, species: 'Dwarf|XPHB', background: FARMER }
  await fillUpToBackground(page, options)
  await page.getByRole('radio', { name: 'A Dark Gift feat instead', exact: true }).check()
  await darkGift(page, 'Living Shadow').check()
  await finishFromBackground(page, options)
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
  await takeFighterLevel4Mastery(page)
  const level4 = page.getByRole('group', { name: 'Level 4' })
  for (let steps = 0; steps < 8 && !(await level4.isVisible()); steps++) await next(page)
  const livingShadow = featOption(page, 4, 'Living Shadow')
  await expect(livingShadow).toHaveJSProperty('disabled', true)
  await expect(livingShadow).toContainText('(already taken)')
})
