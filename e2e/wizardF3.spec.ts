import { expect, test, type Page } from '@playwright/test'
import {
  chooseLevelAsi,
  chooseLevelFeat,
  createFighter,
  expectStep,
  fillUpToBackground,
  finishFromBackground,
  levelCard,
  levelCardHeader,
  next,
  nextButton,
  select,
  stepBar,
  wizardNav,
  type FighterOptions,
} from './wizard.ts'

/* F-3: the ability cap on every card (D259), hit point rows pruned with a lowered level (D260), an item's feat clash as a warning (D261). */

const STORAGE_KEY = 'familliar:characters'
const STANDARD = [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]
/** Farmer's +1 may go to Strength; STR 15 + 1 = 16 before any card. */
const FARMER = { radio: 'Farmer (XPHB)', plusTwo: 'constitution', plusOne: 'strength' }

async function reachAsi(page: Page, level: number): Promise<void> {
  await fillUpToBackground(page, { name: 'Cap', level, species: 'Dwarf|XPHB', background: FARMER })
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of STANDARD) await select(page, ability!).selectOption({ label: score! })
  await next(page)
  await expectStep(page, 'ASI / Feat')
}

const CAP_SENTENCE = '+2 STR would take Strength above 20 — choose another ability.'

test('F-3 1 (D259): STR 16, then +2 STR on L6 and L8 and finally on L4 — L8 opens with the cap sentence and Next waits for another ability', async ({ page }) => {
  await reachAsi(page, 8)
  await chooseLevelAsi(page, 6, 'strength')
  await chooseLevelAsi(page, 8, 'strength')
  await expect(levelCard(page, 8).getByText(CAP_SENTENCE, { exact: true })).toHaveCount(0)

  await chooseLevelAsi(page, 4, 'strength')
  await expect(levelCardHeader(page, 8)).toHaveAttribute('aria-expanded', 'true')
  await expect(levelCard(page, 8).getByText(CAP_SENTENCE, { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()

  await chooseLevelAsi(page, 8, 'dexterity')
  await expect(levelCard(page, 8).getByText(CAP_SENTENCE, { exact: true })).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('F-3 2 (D259): with STR 20 below L8, Athlete on L8 has Strength disabled in its ability select', async ({ page }) => {
  await reachAsi(page, 8)
  await chooseLevelAsi(page, 4, 'strength')
  await chooseLevelAsi(page, 6, 'strength')
  await chooseLevelFeat(page, 8, 'Athlete')
  const strength = levelCard(page, 8).getByRole('combobox', { name: 'Level 8 ability', exact: true }).locator('option[value="strength"]')
  await expect(strength).toHaveJSProperty('disabled', true)
  await expect(strength).toHaveText('Strength (would exceed 20)')
  await expect(levelCard(page, 8).getByRole('combobox', { name: 'Level 8 ability', exact: true }).locator('option[value="dexterity"]')).toHaveJSProperty('disabled', false)
})

test('F-3 3 (D260): a new Fighter 8 with Roll on every level, lowered to level 4, saves hit points up to 4; a level up to 5 asks again', async ({ page }) => {
  const options: FighterOptions = { name: 'Lowered Rolls', level: 8, species: 'Dwarf|XPHB', stopAtHitPoints: true }
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
  await expectStep(page, 'Hit points')
  for (let level = 2; level <= 8; level++) await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: 'Roll (d10)', exact: true }).check()

  await stepBar(page).getByRole('button', { name: /Class and level/ }).click()
  await select(page, 'Level').selectOption('4')
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await next(page)
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('radiogroup', { name: /hit points method/ })).toHaveCount(3)
  await expect(nextButton(page)).toBeEnabled()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await page.getByRole('group', { name: /From your class/ }).getByRole('radio').last().check()
  await page.getByRole('group', { name: /From your background/ }).getByRole('radio').last().check()
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].hitPointLevels.map((entry: { level: number }) => entry.level), STORAGE_KEY)
  expect(stored).toEqual([2, 3, 4])

  await page.getByRole('button', { name: 'Level up to 5' }).click()
  for (let steps = 0; steps < 8 && (await page.locator('[aria-current="step"]').filter({ hasText: 'Hit points' }).count()) === 0; steps++) await next(page)
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('radiogroup', { name: 'Level 5 hit points method', exact: true }).getByRole('radio', { name: 'Roll (d10)', exact: true })).not.toBeChecked()
  await expect(nextButton(page)).toBeDisabled()
})

test('F-3 4 (D261): Alert on L4 and a custom item granting Alert — Edit Character warns on L4 and Next stays enabled', async ({ page }) => {
  await createFighter(page, { name: 'Item Alert', level: 4, species: 'Dwarf|XPHB', feat: 'Alert' })
  await page.evaluate((key) => {
    const [character] = JSON.parse(localStorage.getItem(key)!)
    const name = 'Ring of Alertness'
    character.inventory = [...(character.inventory ?? []), { name, source: 'custom', quantity: 1, custom: { name, kind: 'worn', feats: [{ name: 'Alert', source: 'XPHB' }] } }]
    localStorage.setItem(key, JSON.stringify([character]))
  }, STORAGE_KEY)
  await page.reload()

  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(levelCard(page, 4).getByText('Alert is also granted by Ring of Alertness — you may keep it or choose another feat.', { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeEnabled()
})
