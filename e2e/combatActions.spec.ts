import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/* D187. A Fighter 1 with nothing in hand; Daggers and a Shortsword are added from the Inventory tab. */

function actions(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function group(page: Page, name: string): Locator {
  return actions(page).getByRole('region', { name, exact: true })
}

function combatLine(page: Page, name: string): Locator {
  return group(page, name).locator('.sheet__combat-actions')
}

async function addItem(page: Page, search: string, checkbox: string): Promise<void> {
  const inventory = page.locator('.sheet__inventory')
  if ((await inventory.getByRole('searchbox', { name: 'Search Add an item' }).count()) === 0) {
    await inventory.getByRole('button', { name: /^Add an item/ }).click()
  }
  await inventory.getByRole('searchbox', { name: 'Search Add an item' }).fill(search)
  await inventory.getByRole('checkbox', { name: checkbox, exact: true }).first().check()
}

test.beforeEach(async ({ page }) => {
  await createFighter(page, { name: 'Combat Tester', level: 1, species: 'Dwarf|XPHB' })
  await page.getByRole('tab', { name: 'Actions' }).click()
})

test('D187 a: the Action group ends with Actions in Combat; a name opens its text, again closes it, another switches', async ({ page }) => {
  const line = combatLine(page, 'Action')
  await expect(line).toContainText('Actions in Combat:')
  const dash = line.getByRole('button', { name: 'Dash', exact: true })
  const dodge = line.getByRole('button', { name: 'Dodge', exact: true })
  await expect(line.getByRole('button', { name: 'Attack', exact: true })).toBeVisible()
  await expect(dash).toHaveAttribute('aria-expanded', 'false')

  const text = line.locator('.sheet__combat-action-text')
  await dash.click()
  await expect(dash).toHaveAttribute('aria-expanded', 'true')
  await expect(text.getByRole('heading', { name: 'Dash' })).toBeVisible()
  await expect(text).toContainText(/Speed/)

  await dash.click()
  await expect(text).toHaveCount(0)

  await dash.click()
  await dodge.click()
  await expect(text.getByRole('heading', { name: 'Dodge' })).toBeVisible()
  await expect(text.getByRole('heading', { name: 'Dash' })).toHaveCount(0)
  await expect(dash).toHaveAttribute('aria-expanded', 'false')
  await expect(dodge).toHaveAttribute('aria-expanded', 'true')
})

test('D187 b: Reaction shows Opportunity Attack; Other shows End Concentration and Improvising an Action', async ({ page }) => {
  await expect(combatLine(page, 'Reaction').getByRole('button', { name: 'Opportunity Attack', exact: true })).toBeVisible()
  const other = combatLine(page, 'Other')
  await expect(other.getByRole('button', { name: 'End Concentration', exact: true })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Improvising an Action', exact: true })).toBeVisible()
})

test('D187 c: the Reaction filter shows only the Reaction group with its line', async ({ page }) => {
  await actions(page).getByRole('button', { name: 'Reaction', exact: true }).click()
  await expect(actions(page).locator('.sheet__action-group')).toHaveCount(1)
  await expect(combatLine(page, 'Reaction')).toContainText('Opportunity Attack')
  await expect(actions(page).getByRole('table')).toHaveCount(0)
})

test('D187 d: Two-Weapon Fighting only while two Light weapons are held', async ({ page }) => {
  const twf = combatLine(page, 'Bonus Action').getByRole('button', { name: 'Two-Weapon Fighting', exact: true })
  const equip = async (name: string) => {
    await page.getByRole('button', { name: `Equip ${name}`, exact: true }).click()
  }

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await addItem(page, 'dagger', 'Dagger (XPHB)')
  await equip('Dagger')
  await addItem(page, 'shortsword', 'Shortsword (XPHB)')
  await page.getByRole('tab', { name: 'Actions' }).click()
  // One Light weapon held, the second still in the backpack. TWF is the only XPHB bonus action, so the whole line is absent.
  await expect(group(page, 'Bonus Action')).toContainText('Second Wind')
  await expect(twf).toHaveCount(0)

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await equip('Shortsword')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(twf).toBeVisible()
})

/* D188: one inventory row of Dagger ×2. */
async function stackOfDaggers(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await addItem(page, 'dagger', 'Dagger (XPHB)')
  const quantity = page.getByRole('spinbutton', { name: 'Quantity of Dagger', exact: true })
  await quantity.fill('2')
  await quantity.press('Enter')
  await expect(quantity).toHaveValue('2')
}

function inventoryRow(page: Page, name: string): Locator {
  return page.locator('.sheet__inventory-list > li').filter({ has: page.getByRole('spinbutton', { name: `Quantity of ${name}`, exact: true }) })
}

async function holdBothDaggers(page: Page): Promise<void> {
  await stackOfDaggers(page)
  await page.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  // One dagger split off into hand; the one left on the stack can still be taken.
  await expect(inventoryRow(page, 'Dagger')).toHaveCount(2)
  await expect(inventoryRow(page, 'Dagger').first().getByRole('spinbutton')).toHaveValue('1')
  await page.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Put down Dagger', exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Equip Dagger', exact: true })).toHaveCount(0)
}

async function expectTwoDaggersHeld(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actions(page).locator('.sheet__action-name-cell', { hasText: 'Dagger' })).toHaveCount(2)
  await expect(combatLine(page, 'Bonus Action').getByRole('button', { name: 'Two-Weapon Fighting', exact: true })).toBeVisible()
}

test('D188 a: both daggers of a Dagger ×2 stack can be taken in hand, and Two-Weapon Fighting appears', async ({ page }) => {
  await holdBothDaggers(page)
  await expectTwoDaggersHeld(page)
})

test('D188 b: putting a dagger away returns it to the stack and Two-Weapon Fighting goes', async ({ page }) => {
  await holdBothDaggers(page)
  await page.getByRole('button', { name: 'Put down Dagger', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Put down Dagger', exact: true })).toHaveCount(1)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actions(page).locator('.sheet__action-name-cell', { hasText: 'Dagger' })).toHaveCount(1)
  await expect(combatLine(page, 'Bonus Action').getByRole('button', { name: 'Two-Weapon Fighting', exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Put down Dagger', exact: true }).click()
  await expect(inventoryRow(page, 'Dagger')).toHaveCount(1)
  await expect(inventoryRow(page, 'Dagger').getByRole('spinbutton')).toHaveValue('2')
})

test('D188 c: the second dagger follows the same hands rule — never three hands\' worth, whatever no longer fits is put down and named', async ({ page }) => {
  const heldMarks = page.locator('.sheet__inventory-equipped')
  // Shield first: what makes room is the held row highest in the list (hands.ts), so it is the one put down.
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await addItem(page, 'shield', 'Shield (XPHB)')
  await stackOfDaggers(page)
  await page.getByRole('button', { name: 'Equip Shield', exact: true }).click()
  await page.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  await expect(heldMarks).toHaveCount(2)

  await page.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  await expect(page.locator('.sheet__inventory-notice')).toContainText('Unequipped Shield — Dagger needs a free hand.')
  await expect(heldMarks).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Equip Shield', exact: true })).toBeVisible()

  await addItem(page, 'greatsword', 'Greatsword (XPHB)')
  await page.getByRole('button', { name: 'Equip Greatsword', exact: true }).click()
  await expect(page.locator('.sheet__inventory-notice')).toContainText('Unequipped Dagger, Dagger — Greatsword needs both hands.')
  await expect(heldMarks).toHaveCount(1)
  // Both daggers went back onto one stack.
  await expect(inventoryRow(page, 'Dagger')).toHaveCount(1)
  await expect(inventoryRow(page, 'Dagger').getByRole('spinbutton')).toHaveValue('2')
})

test('D188 d: both daggers are still held after a reload', async ({ page }) => {
  await holdBothDaggers(page)
  await page.reload()
  await expectTwoDaggersHeld(page)
})

test('D187 e: Help renders its {@note} as readable italic text', async ({ page }) => {
  const line = combatLine(page, 'Action')
  await line.getByRole('button', { name: 'Help', exact: true }).click()
  const text = line.locator('.sheet__combat-action-text')
  await expect(text.locator('em', { hasText: 'stabilize a creature' })).toBeVisible()
  await expect(text).not.toContainText('{@')
})
