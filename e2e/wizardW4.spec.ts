import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, fillUpToBackground, next, nextButton, select, stepBar } from './wizard.ts'

/* W-4: Ability scores step (W12–W15) and the class skill gate. Acolyte gives +2 Wisdom, +1 Intelligence. */

const STORAGE_KEY = 'familliar:characters'
const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']

async function reachAbilities(page: Page): Promise<void> {
  await fillUpToBackground(page, { name: 'Brann', level: 1, species: 'Dwarf|XPHB' })
  await next(page)
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
}

function tableRow(page: Page, name: string): Locator {
  return page.locator('.ability-table tr', { has: page.getByRole('rowheader', { name, exact: true }) }).getByRole('cell')
}

function method(page: Page, name: string): Locator {
  return page.getByRole('group', { name: 'Ability score method' }).getByRole('button', { name, exact: true })
}

test('W-4 a: Standard Array swaps a taken value, unlocks Next when all six are set, and totals add the background bonus', async ({ page }) => {
  await reachAbilities(page)
  await expect(method(page, 'Standard Array')).toHaveAttribute('aria-pressed', 'true')
  await expect(select(page, 'Strength')).toHaveValue('')

  await select(page, 'Strength').selectOption('15')
  await select(page, 'Dexterity').selectOption('15')
  await expect(select(page, 'Dexterity')).toHaveValue('15')
  await expect(select(page, 'Strength')).toHaveValue('')

  await select(page, 'Dexterity').selectOption('14')
  await select(page, 'Strength').selectOption('15')
  await select(page, 'Constitution').selectOption('13')
  await select(page, 'Intelligence').selectOption('12')
  await select(page, 'Wisdom').selectOption('10')
  await expect(nextButton(page)).toBeDisabled()
  await select(page, 'Charisma').selectOption('8')
  await expect(nextButton(page)).toBeEnabled()

  await expect(tableRow(page, 'Base')).toHaveText(['15', '14', '13', '12', '10', '8'])
  await expect(tableRow(page, 'Background')).toHaveText(['—', '—', '—', '+1', '+2', '—'])
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['—', '—', '—', '—', '—', '—'])
  await expect(tableRow(page, 'Total')).toHaveText(['15', '14', '13', '13', '12', '8'])
  await expect(tableRow(page, 'Modifier')).toHaveText(['+2', '+2', '+1', '+1', '+1', '−1'])
})

test('W-4 b: Point Buy shows the remaining budget live and disables options it cannot afford', async ({ page }) => {
  await reachAbilities(page)
  await method(page, 'Point Buy').click()
  const budget = page.locator('.ability-picker__budget')
  await expect(budget).toHaveText(/Points remaining\s*27 \/ 27/i)
  await expect(nextButton(page)).toBeEnabled()

  await select(page, 'Strength').selectOption('15')
  await expect(budget).toHaveText(/18 \/ 27/)
  await select(page, 'Dexterity').selectOption('15')
  await select(page, 'Constitution').selectOption('14')
  await expect(budget).toHaveText(/2 \/ 27/)

  const intelligence = select(page, 'Intelligence')
  await expect(intelligence.locator('option', { hasText: '10 (2)' })).toBeEnabled()
  await expect(intelligence.locator('option', { hasText: '11 (3)' })).toBeDisabled()
  await expect(intelligence.locator('option', { hasText: '15 (9)' })).toBeDisabled()
  await expect(tableRow(page, 'Total')).toHaveText(['15', '15', '14', '9', '10', '8'])
})

test('W-4 c: Manual / Rolled rolls 6 × 4d6, assigns and swaps results, rerolls, and takes typed numbers', async ({ page }) => {
  await reachAbilities(page)
  await method(page, 'Manual / Rolled').click()
  await page.getByRole('button', { name: 'Roll', exact: true }).click()

  const cards = page.locator('.ability-roll')
  await expect(cards).toHaveCount(6)
  const totals: string[] = []
  for (let i = 0; i < 6; i++) {
    const card = cards.nth(i)
    const dice = (await card.locator('.ability-roll__die').allTextContents()).map(Number)
    expect(dice).toHaveLength(4)
    await expect(card.locator('.ability-roll__die--dropped')).toHaveCount(1)
    const best3 = [...dice].sort((a, b) => b - a).slice(0, 3).reduce((sum, d) => sum + d, 0)
    await expect(card.locator('.ability-roll__total')).toHaveText(String(best3))
    totals.push(String(best3))
  }

  const strength = page.getByRole('spinbutton', { name: 'Strength', exact: true })
  const dexterity = page.getByRole('spinbutton', { name: 'Dexterity', exact: true })
  await select(page, 'Assign result 1').selectOption('strength')
  await expect(strength).toHaveValue(totals[0]!)
  await select(page, 'Assign result 2').selectOption('dexterity')
  await select(page, 'Assign result 2').selectOption('strength')
  await expect(strength).toHaveValue(totals[1]!)
  await expect(dexterity).toHaveValue(totals[0]!)
  await expect(select(page, 'Assign result 1')).toHaveValue('dexterity')

  await page.getByRole('button', { name: 'Reroll', exact: true }).click()
  await expect(cards).toHaveCount(6)
  await expect(strength).toHaveValue('')
  await expect(dexterity).toHaveValue('')
  for (let i = 1; i <= 6; i++) await expect(select(page, `Assign result ${i}`)).toHaveValue('')

  for (const ability of ABILITIES.slice(0, 5)) await page.getByRole('spinbutton', { name: ability, exact: true }).fill('12')
  const charisma = page.getByRole('spinbutton', { name: 'Charisma', exact: true })
  await charisma.fill('19')
  await expect(nextButton(page)).toBeDisabled()
  await charisma.fill('18')
  await expect(nextButton(page)).toBeEnabled()
  await expect(tableRow(page, 'Total')).toHaveText(['12', '12', '12', '13', '14', '18'])
})

test('W-4 d: Edit Character shows the saved method and values with the right totals', async ({ page }) => {
  await createFighter(page, { name: 'Edda', level: 1, species: 'Dwarf|XPHB' })
  const sheetUrl = page.url()

  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /Ability scores/ }).click()
  await expectStep(page, 'Ability scores')
  await expect(method(page, 'Standard Array')).toHaveAttribute('aria-pressed', 'true')
  await expect(select(page, 'Strength')).toHaveValue('15')
  await expect(select(page, 'Charisma')).toHaveValue('8')
  await expect(tableRow(page, 'Total')).toHaveText(['15', '14', '13', '13', '12', '8'])
  await expect(tableRow(page, 'Modifier')).toHaveText(['+2', '+2', '+1', '+1', '+1', '−1'])

  await page.evaluate((key) => {
    const characters = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const character of characters) character.abilityScores = { method: 'roll', scores: { strength: 17, dexterity: 9, constitution: 14, intelligence: 11, wisdom: 13, charisma: 6 } }
    localStorage.setItem(key, JSON.stringify(characters))
  }, STORAGE_KEY)
  await page.goto(sheetUrl)
  await page.reload()
  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /Ability scores/ }).click()
  await expect(method(page, 'Manual / Rolled')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('spinbutton', { name: 'Strength', exact: true })).toHaveValue('17')
  await expect(tableRow(page, 'Total')).toHaveText(['17', '9', '14', '12', '15', '6'])
  await expect(nextButton(page)).toBeEnabled()
})

test('W-4 e: a new Fighter cannot leave the class step until both class skills are chosen', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Brann')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').first().click()
  await expect(nextButton(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await expect(nextButton(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  await expect(nextButton(page)).toBeEnabled()
})
