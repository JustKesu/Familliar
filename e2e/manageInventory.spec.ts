import { expect, test, type Locator, type Page } from '@playwright/test'

/* R10a. A Fighter seeded into storage before the app loads, as in manageSpells.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, inventory: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 50,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
    ...extra,
  }
}

const item = (name: string, source = 'XPHB', quantity = 1) => ({ name, source, quantity })

async function openInventory(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Inventory' }).click()
}

async function openManage(page: Page, character: { id: string }): Promise<Locator> {
  await openInventory(page, character)
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return drawer(page)
}

const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Manage Inventory' })
const tab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Inventory' })
const tabRow = (page: Page, name: string): Locator => tab(page).locator('.sheet__inventory-list > li', { hasText: name })
const addItems = (panel: Locator): Locator => panel.getByRole('region', { name: 'Add Items' })
const myInventory = (panel: Locator): Locator => panel.getByRole('region', { name: 'My Inventory' })
const rows = (scope: Locator): Locator => scope.locator('.manage-spells__row')
const row = (scope: Locator, name: string): Locator =>
  scope.locator('.manage-spells__row', { has: scope.page().locator('.manage-spells__name', { hasText: new RegExp(`^${name.replace(/[+()]/g, '\\$&')}$`) }) })

test('R10a a: the tab shows MANAGE INVENTORY and no edit controls; the panel has four sections and Esc closes it', async ({ page }) => {
  await openInventory(page, fighter('r10a-a', [{ ...item('Longsword'), equipped: 'held' }]))
  await expect(tab(page).getByRole('button', { name: 'Manage Inventory', exact: true })).toBeVisible()
  await expect(tabRow(page, 'Longsword')).toContainText('×1')
  await expect(tab(page).locator('input, select')).toHaveCount(0)
  await expect(tab(page).getByRole('button', { name: /^(Equip|Put down|Remove|Discard|Attune|Edit)/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  const panel = drawer(page)
  await expect(panel.locator('.drawer-section > summary')).toHaveText(['Add Items', 'Add Custom Item', 'Currency', 'My Inventory'])
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})

test('R10a b: search, type pills, Magical and the 20-row cap filter Add Items', async ({ page }) => {
  const panel = addItems(await openManage(page, fighter('r10a-b')))
  await expect(rows(panel)).toHaveCount(20)
  await expect(panel).toContainText(/Showing 20 of \d+ — narrow the search or filters\./)

  const search = panel.getByRole('searchbox', { name: 'Search items' })
  await search.fill('resistance')
  await expect(rows(panel).locator('.manage-spells__meta').filter({ hasNotText: /Potion|Ring/ }).first()).toBeVisible()
  await panel.getByRole('button', { name: 'Potion', exact: true }).click()
  await expect(rows(panel).locator('.manage-spells__meta').filter({ hasNotText: 'Potion' })).toHaveCount(0)
  await expect(rows(panel).first()).toBeVisible()
  await panel.getByRole('button', { name: 'Ring', exact: true }).click()
  await expect(rows(panel).locator('.manage-spells__meta', { hasText: 'Ring' }).first()).toBeVisible()
  const metas = await rows(panel).locator('.manage-spells__meta').allTextContents()
  expect(metas.some((meta) => meta.includes('Potion'))).toBe(true)
  expect(metas.some((meta) => meta.includes('Ring'))).toBe(true)
  await expect(panel).not.toContainText('Showing 20 of')

  await panel.getByRole('button', { name: 'Potion', exact: true }).click()
  await panel.getByRole('button', { name: 'Ring', exact: true }).click()
  await search.fill('shield')
  await expect(row(panel, 'Shield').first()).toBeVisible()
  await panel.getByRole('checkbox', { name: 'Magical' }).check()
  await expect(row(panel, 'Shield')).toHaveCount(0)
  await expect(rows(panel).first()).toBeVisible()
})

test('R10a c: ADD twice gives one row of 2, in the panel and on the tab', async ({ page }) => {
  const panel = await openManage(page, fighter('r10a-c'))
  await addItems(panel).getByRole('searchbox', { name: 'Search items' }).fill('arrow')
  const add = addItems(panel).getByRole('button', { name: 'Add Arrow', exact: true }).first()
  await add.click()
  await add.click()
  await expect(rows(myInventory(panel))).toHaveCount(1)
  await expect(myInventory(panel).getByRole('spinbutton', { name: 'Quantity of Arrow', exact: true })).toHaveValue('2')
  await expect(tabRow(page, 'Arrow')).toContainText('×2')
})

test('R10a d: − and + change the quantity, − is disabled at 0, and typing still commits', async ({ page }) => {
  const panel = myInventory(await openManage(page, fighter('r10a-d', [item('Torch')])))
  const minus = panel.getByRole('button', { name: 'Decrease quantity of Torch' })
  await minus.click()
  await expect(panel.getByRole('spinbutton', { name: 'Quantity of Torch' })).toHaveValue('0')
  await expect(minus).toBeDisabled()
  await panel.getByRole('button', { name: 'Increase quantity of Torch' }).click()
  await expect(tabRow(page, 'Torch')).toContainText('×1')
  const field = panel.getByRole('spinbutton', { name: 'Quantity of Torch' })
  await field.fill('5')
  await field.press('Enter')
  await expect(tabRow(page, 'Torch')).toContainText('×5')
})

test('R10a e: a second suit of armour puts the first down, with the notice', async ({ page }) => {
  const panel = myInventory(await openManage(page, fighter('r10a-e', [item('Leather Armor'), item('Chain Mail')])))
  await panel.getByRole('button', { name: 'Equip Leather Armor' }).click()
  await panel.getByRole('button', { name: 'Equip Chain Mail' }).click()
  await expect(panel.getByRole('status')).toHaveText('Unequipped Leather Armor — only one suit of armour can be worn at a time.')
  await expect(panel.getByRole('button', { name: 'Equip Leather Armor' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Put down Chain Mail' })).toBeVisible()
})

test('R10a f: attuning up to the limit, then a refusal; the count follows in panel and tab', async ({ page }) => {
  const magic = ['Cloak of Protection', 'Ring of Protection', 'Amulet of Health', '+1 Wand of the War Mage'].map((name) => item(name, 'XDMG'))
  const panel = myInventory(await openManage(page, fighter('r10a-f', magic)))
  await expect(panel).toContainText('0 of 3 attuned')
  for (const name of ['Cloak of Protection', 'Ring of Protection', 'Amulet of Health']) await panel.getByRole('button', { name: `Attune to ${name}` }).click()
  await expect(panel).toContainText('3 of 3 attuned')
  await expect(tab(page).locator('.sheet__attunement-count')).toContainText('3 of 3 attuned')
  await panel.getByRole('button', { name: 'Attune to +1 Wand of the War Mage' }).click()
  await expect(panel.getByRole('status')).toContainText('Cannot attune to +1 Wand of the War Mage')
  await expect(panel).toContainText('3 of 3 attuned')
})

test('R10a g: a custom item is created, shown, loaded back by Edit and renamed', async ({ page }) => {
  const panel = await openManage(page, fighter('r10a-g'))
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Lucky Pebble')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await expect(row(myInventory(panel), 'Lucky Pebble')).toHaveCount(1)
  await expect(tabRow(page, 'Lucky Pebble')).toHaveCount(1)

  await myInventory(panel).getByRole('button', { name: 'Edit Lucky Pebble' }).click()
  const name = panel.getByLabel('Custom item name')
  await expect(name).toHaveValue('Lucky Pebble')
  await expect(name).toBeInViewport()
  await name.fill('Lucky Stone')
  await panel.getByRole('button', { name: 'Save changes' }).click()
  await expect(tabRow(page, 'Lucky Stone')).toHaveCount(1)
  await expect(tabRow(page, 'Lucky Pebble')).toHaveCount(0)
})

test('R10a h: Gold changed in the panel reaches the tab', async ({ page }) => {
  const panel = await openManage(page, fighter('r10a-h', [], { currencyCopper: 1000 }))
  const gold = panel.getByRole('spinbutton', { name: 'Gold', exact: true })
  await expect(gold).toHaveValue('10')
  await gold.fill('42')
  await gold.press('Enter')
  await expect(tab(page).locator('.sheet__currency')).toContainText('42 gp')
})

test('R10a i: REMOVE deletes the row from panel and tab', async ({ page }) => {
  const panel = myInventory(await openManage(page, fighter('r10a-i', [item('Torch'), item('Longsword')])))
  await panel.getByRole('button', { name: 'Remove Torch from inventory' }).click()
  await expect(row(panel, 'Torch')).toHaveCount(0)
  await expect(tabRow(page, 'Torch')).toHaveCount(0)
  await expect(tabRow(page, 'Longsword')).toHaveCount(1)
})
