import { expect, test, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, fillUpToBackground, next, nextButton, select, stepBar } from './wizard.ts'

/* W-3: the Class step gate (every choice the step shows), the Species card (W6) and the Proficiencies rename (W7). */

const STORAGE_KEY = 'familliar:characters'
const stepButton = (page: Page, name: string) => stepBar(page).getByRole('button', { name, exact: true })

type Skip = 'subclass' | 'style' | 'mastery' | null

/** A new Fighter of `level` with every class pick made except the one named in `skip`. */
async function fillFighter(page: Page, level: number, skip: Skip): Promise<void> {
  await page.goto('/#/new')
  // A hash-only navigation keeps the previous wizard's state, so a second run in one test needs a fresh page.
  await page.reload()
  await page.getByLabel('Character name').fill('Brann')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption(String(level))
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  const masteries = level >= 4 ? 4 : 3
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe'].slice(0, skip === 'mastery' ? masteries - 1 : masteries)) {
    await chooseButton(page, weapon).first().click()
  }
  if (skip !== 'style') await chooseButton(page, 'Defense').first().click()
  if (level >= 3 && skip !== 'subclass') await chooseButton(page, 'Champion').first().click()
}

test('W-3 a: a new Fighter 3 cannot leave the class step while any one of subclass, fighting style or a mastery is missing', async ({ page }) => {
  await test.step('subclass missing', async () => {
    await fillFighter(page, 3, 'subclass')
    await expect(nextButton(page)).toBeDisabled()
    await expect(page.getByText('Choose a subclass.')).toBeVisible()
    await chooseButton(page, 'Champion').click()
    await expect(nextButton(page)).toBeEnabled()
  })

  await test.step('fighting style missing', async () => {
    await fillFighter(page, 3, 'style')
    await expect(nextButton(page)).toBeDisabled()
    await expect(page.getByText('Choose a fighting style.')).toBeVisible()
    await chooseButton(page, 'Defense').click()
    await expect(nextButton(page)).toBeEnabled()
  })

  await test.step('one mastery missing', async () => {
    await fillFighter(page, 3, 'mastery')
    await expect(nextButton(page)).toBeDisabled()
    await expect(page.getByText('Choose 1 more weapon mastery (2 of 3).')).toBeVisible()
    await chooseButton(page, 'Handaxe').click()
    await expect(nextButton(page)).toBeEnabled()
  })
})

test('W-3 b: a new Fighter 1 needs no subclass — Next unlocks after the fighting style and the masteries', async ({ page }) => {
  await fillFighter(page, 1, 'style')
  await expect(page.getByRole('button', { name: /^Subclass/ })).toHaveCount(0)
  await expect(nextButton(page)).toBeDisabled()
  await chooseButton(page, 'Defense').click()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-3 c: a Fighter 3 Battle Master needs all three maneuvers', async ({ page }) => {
  await fillFighter(page, 3, 'subclass')
  await chooseButton(page, 'Battle Master').click()
  await expect(nextButton(page)).toBeDisabled()
  await expect(page.getByText('Choose 3 more options.')).toBeVisible()

  await chooseButton(page, 'Trip Attack').click()
  await chooseButton(page, 'Riposte').click()
  await expect(nextButton(page)).toBeDisabled()
  await expect(page.getByText('Choose 1 more option.')).toBeVisible()

  await chooseButton(page, 'Parry').click()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-3 d: Edit Character on a Fighter 3 saved without a subclass locks Next and the later steps until one is chosen', async ({ page }) => {
  await createFighter(page, { name: 'Edda', level: 3, species: 'Dwarf|XPHB' })
  await page.evaluate((key) => {
    const characters = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const character of characters) character.classes[0].subclass = null
    localStorage.setItem(key, JSON.stringify(characters))
  }, STORAGE_KEY)
  await page.reload()

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await expect(page.getByText('Choose a subclass.')).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  await expect(stepButton(page, '2. Species')).toBeDisabled()
  await expect(stepButton(page, '3. Background')).toBeDisabled()

  await chooseButton(page, 'Champion').click()
  await expect(nextButton(page)).toBeEnabled()
  await expect(stepButton(page, '2. Species')).toBeEnabled()

  await stepBar(page).getByRole('button').last().click()
  await expectStep(page, 'Review and save')
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  const subclass = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].classes[0].subclass, STORAGE_KEY)
  expect(subclass).toBe('Champion')
})

test('W-3 e: a level up that keeps its held picks asks only for what the new level adds', async ({ page }) => {
  await createFighter(page, { name: 'Edda', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
  await expectStep(page, 'Class and level')

  // Fighter 4 knows one more mastery than Fighter 3; the three held ones and the subclass and style are not asked again.
  await expect(nextButton(page)).toBeDisabled()
  await expect(page.getByText('Choose 1 more weapon mastery (3 of 4).')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Subclass/ })).toHaveCount(0)
  await chooseButton(page, 'Battleaxe').click()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-3 f: the Species card shows size, speed and every trait with its text, and follows the species', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Brann')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').first().click()
  await next(page)
  await expectStep(page, 'Species')

  const card = page.locator('.species-card')
  await expect(card).toHaveCount(0)

  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await expect(card.locator('.species-card__stat', { hasText: 'Size' })).toContainText('Medium')
  await expect(card.locator('.species-card__stat', { hasText: 'Speed' })).toContainText('30 ft.')
  await expect(card.locator('.species-card__stat', { hasText: 'Creature Type' })).toContainText('Humanoid')
  for (const trait of ['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning']) {
    await expect(card.getByRole('heading', { name: trait, exact: true })).toBeVisible()
  }
  await expect(card.locator('.species-card__trait', { hasText: 'Dwarven Resilience' })).toContainText('Poison')

  // A species with a variant shows nothing until the variant is chosen, then its own traits replace the Dwarf's.
  await select(page, 'Species').selectOption('Elf|XPHB')
  await expect(card).toHaveCount(0)
  await select(page, 'Elven Lineage').selectOption({ index: 1 })
  await expect(card.getByRole('heading', { name: 'Fey Ancestry', exact: true })).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Dwarven Resilience' })).toHaveCount(0)
})

test('W-3 g: the languages step is called Proficiencies and still works', async ({ page }) => {
  await fillUpToBackground(page, { name: 'Brann', level: 1, species: 'Dwarf|XPHB' })
  await expect(stepButton(page, '4. Proficiencies')).toBeVisible()
  await next(page)
  await expectStep(page, 'Proficiencies')
  await expect(page.getByRole('heading', { level: 2, name: 'Proficiencies' })).toBeVisible()
  await expect(page.getByText('Languages & Tools')).toHaveCount(0)
  await expect(nextButton(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await expect(nextButton(page)).toBeEnabled()
  await next(page)
  await expectStep(page, 'Ability scores')
})
