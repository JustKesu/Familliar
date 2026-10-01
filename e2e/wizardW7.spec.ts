import { expect, test, type Page } from '@playwright/test'
import { chooseButton, equipmentChoose, equipmentSection, expectStep, fillUpToBackground, finishFromBackground, next, wizardNav, type FighterOptions } from './wizard.ts'

/* W-7 (D263): the Starting equipment step as option cards, packs behind ▸, a pick list under the cards and the start table. */

// Soldier offers a gaming set in its option A; its tool proficiency is a radio on the Background step.
const SOLDIER: FighterOptions = {
  name: 'Cardy',
  level: 1,
  species: 'Dwarf|XPHB',
  background: { radio: 'Soldier (XPHB)', plusTwo: 'strength', plusOne: 'dexterity' },
  stopAtEquipment: true,
  onBackgroundStep: async (p) => {
    await p.getByRole('radio', { name: 'Dice Set', exact: true }).check()
  },
}

async function openEquipmentStep(page: Page): Promise<void> {
  await fillUpToBackground(page, SOLDIER)
  await finishFromBackground(page, SOLDIER)
  await expectStep(page, 'Starting equipment')
}

const card = (page: Page, origin: 'Class' | 'Background', option: string) => page.getByRole('group', { name: `${origin} option ${option}`, exact: true })

test('W-7 a: Fighter class cards — Choose marks one CHOSEN, choosing another switches', async ({ page }) => {
  await openEquipmentStep(page)
  await expect(page.getByRole('group', { name: /^Class option / })).toHaveCount(3)

  const a = equipmentChoose(page, 'class', 'A')
  const b = equipmentChoose(page, 'class', 'B')
  await expect(a).toHaveText('Choose')
  await expect(b).toHaveText('Choose')

  await a.click()
  await expect(a).toHaveText('Chosen')
  await expect(a).toHaveAttribute('aria-pressed', 'true')
  await expect(b).toHaveText('Choose')

  await b.click()
  await expect(b).toHaveText('Chosen')
  await expect(a).toHaveText('Choose')

  // The whole card is the click target, not just its button.
  await card(page, 'Class', 'A').getByText('Option A', { exact: true }).click()
  await expect(a).toHaveText('Chosen')
  await expect(b).toHaveText('Choose')
})

test('W-7 b: the gaming-set pick of Soldier appears under the cards only once option A is chosen', async ({ page }) => {
  await openEquipmentStep(page)
  const background = equipmentSection(page, 'background')
  const pick = chooseButton(background, 'Dice Set')

  await expect(pick).toHaveCount(0)
  await equipmentChoose(page, 'background', 'B').click()
  await expect(pick).toHaveCount(0)

  await equipmentChoose(page, 'background', 'A').click()
  await expect(pick).toBeVisible()
  await expect(pick).toHaveText('Choose')
  // Full width under the cards, not inside one of them.
  await expect(card(page, 'Background', 'A').getByRole('button', { name: /^Choose Dice Set/ })).toHaveCount(0)

  await pick.click()
  await expect(pick).toHaveText('Chosen')
  await expect(pick).toHaveAttribute('aria-pressed', 'true')

  await equipmentChoose(page, 'background', 'B').click()
  await expect(pick).toHaveCount(0)
})

test('W-7 c: the Dungeoneer’s Pack of Fighter option A expands with ▸ and collapses again', async ({ page }) => {
  await openEquipmentStep(page)
  const toggle = card(page, 'Class', 'A').getByRole('button', { name: "Dungeoneer's Pack contents" })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toContainText('▸')
  await expect(card(page, 'Class', 'A').locator('.equip-card__contents')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toContainText('▾')
  await expect(card(page, 'Class', 'A').locator('.equip-card__contents li').first()).toBeVisible()
  // Opening a pack must not take the option.
  await expect(equipmentChoose(page, 'class', 'A')).toHaveText('Choose')

  await toggle.click()
  await expect(card(page, 'Class', 'A').locator('.equip-card__contents')).toHaveCount(0)
})

test('W-7 e (D269): a click inside an open pack’s contents never chooses the option; the card body still does', async ({ page }) => {
  await openEquipmentStep(page)
  const classA = card(page, 'Class', 'A')
  await classA.getByRole('button', { name: "Dungeoneer's Pack contents" }).click()
  const row = classA.locator('.equip-card__contents li').first()
  await expect(row).toBeVisible()

  await row.click()
  await expect(equipmentChoose(page, 'class', 'A')).toHaveText('Choose')
  await classA.locator('.equip-card__contents').click({ position: { x: 2, y: 2 } })
  await expect(equipmentChoose(page, 'class', 'A')).toHaveText('Choose')

  await classA.getByText('Option A', { exact: true }).click()
  await expect(equipmentChoose(page, 'class', 'A')).toHaveText('Chosen')
})

test('W-7 d: the start table lists the items with quantities and the money, and the sheet’s Inventory tab matches', async ({ page }) => {
  await openEquipmentStep(page)
  await expect(page.getByRole('heading', { name: 'You will start with' })).toHaveCount(0)

  await equipmentChoose(page, 'class', 'A').click()
  await equipmentChoose(page, 'background', 'A').click()
  await chooseButton(equipmentSection(page, 'background'), 'Dice Set').click()
  await expect(page.getByRole('heading', { name: 'You will start with' })).toBeVisible()

  const summary = page.locator('.starting-equipment__summary')
  const money = (await summary.locator('.start-table__money').innerText()).trim()
  expect(money).toMatch(/^\d+ gp · \d+ sp · \d+ cp$/)
  await expect(summary.getByRole('columnheader')).toHaveText(['Name', 'Qty'])

  const rows = await summary.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim() ?? '') as [string, string]),
  )
  const table = Object.fromEntries(rows)
  expect(table['Chain Mail']).toBe('1')
  expect(table['Dice Set']).toBe('1')

  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await page.getByRole('tab', { name: 'Inventory' }).click()

  const inventory = page.getByRole('tabpanel', { name: 'Inventory' })
  await expect(inventory.locator('.inventory-tab__header')).toContainText(money.replaceAll(' · ', ', '))
  const sheetRows = await inventory.locator('.sheet__inventory-list > li').evaluateAll((lis) =>
    lis.map((li) => [li.querySelector('.inventory-tab__name')?.textContent?.trim() ?? '', li.querySelector('.inventory-tab__qty')?.textContent?.trim() ?? '']),
  )
  expect(Object.fromEntries(sheetRows)).toEqual(table)
})
