import { expect, test, type Locator, type Page } from '@playwright/test'

/* R10b (D211). A Fighter seeded into storage before the app loads, as in manageInventory.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, inventory: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
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

async function openInventory(page: Page, character: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Inventory' }).click()
  return tab(page)
}

const tab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Inventory' })
const tabRow = (scope: Locator, name: string): Locator => scope.locator('.sheet__inventory-list > li', { hasText: name })
const pill = (scope: Locator, name: string): Locator => scope.getByRole('button', { name, exact: true })
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Manage Inventory' })

const MIXED = [item('Longsword'), item('Chain Mail'), item('Rope'), item('Cloak of Protection', 'XDMG')]

test('R10b a: header with money and attunement, toolbar, and the table header', async ({ page }) => {
  const t = await openInventory(page, fighter('r10b-a', MIXED, { currencyCopper: 1234 }))
  await expect(t.locator('.inventory-tab__header')).toContainText('12 gp, 3 sp, 4 cp')
  await expect(t.locator('.inventory-tab__header')).toContainText('0 of 3 attuned')
  await expect(t.getByRole('searchbox', { name: 'Search inventory' })).toBeVisible()
  await expect(t.getByRole('group', { name: 'Filter inventory' }).getByRole('button')).toHaveText(['All', 'Equipment', 'Attunement', 'Other possessions'])
  await expect(t.getByRole('button', { name: 'Manage Inventory', exact: true })).toBeVisible()
  await expect(t.locator('.inventory-tab__head span')).toHaveText(['Active', 'Name', 'Qty', 'Notes'])
})

test('R10b b: filters and search', async ({ page }) => {
  const t = await openInventory(page, fighter('r10b-b', MIXED))
  await expect(t.locator('.sheet__inventory-list > li')).toHaveCount(4)

  await pill(t, 'Equipment').click()
  await expect(tabRow(t, 'Longsword')).toHaveCount(1)
  await expect(tabRow(t, 'Chain Mail')).toHaveCount(1)
  await expect(tabRow(t, 'Rope')).toHaveCount(0)
  await expect(tabRow(t, 'Cloak')).toHaveCount(0)

  await pill(t, 'Attunement').click()
  await expect(t.locator('.sheet__inventory-list > li')).toHaveCount(1)
  await expect(tabRow(t, 'Cloak of Protection')).toHaveCount(1)

  await pill(t, 'Other possessions').click()
  await expect(t.locator('.sheet__inventory-list > li')).toHaveCount(1)
  await expect(tabRow(t, 'Rope')).toHaveCount(1)

  await pill(t, 'All').click()
  await expect(t.locator('.sheet__inventory-list > li')).toHaveCount(4)
  await t.getByRole('searchbox', { name: 'Search inventory' }).fill('chain')
  await expect(t.locator('.sheet__inventory-list > li')).toHaveCount(1)
  await t.getByRole('searchbox', { name: 'Search inventory' }).fill('zzz')
  await expect(t).toContainText('No items match.')
})

test('R10b c: ACTIVE checkbox only on equippable rows; armour goes worn, a second suit displaces the first with the notice', async ({ page }) => {
  const t = await openInventory(page, fighter('r10b-c', [item('Leather Armor'), item('Chain Mail'), item('Potion of Healing')]))
  await expect(t.getByRole('checkbox', { name: 'Active Leather Armor' })).toBeVisible()
  await expect(tabRow(t, 'Potion of Healing').getByRole('checkbox')).toHaveCount(0)

  await t.getByRole('checkbox', { name: 'Active Leather Armor' }).check()
  await expect(tabRow(t, 'Leather Armor').locator('.inventory-tab__notes')).toContainText('worn')
  await t.getByRole('checkbox', { name: 'Active Chain Mail' }).check()
  await expect(t.getByRole('status')).toHaveText('Unequipped Leather Armor — only one suit of armour can be worn at a time.')
  await expect(t.getByRole('checkbox', { name: 'Active Leather Armor' })).not.toBeChecked()
  await expect(tabRow(t, 'Chain Mail').locator('.inventory-tab__notes')).toContainText('worn')

  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  await expect(drawer(page).getByRole('button', { name: 'Put down Chain Mail' })).toBeVisible()
  await expect(drawer(page).getByRole('button', { name: 'Equip Leather Armor' })).toBeVisible()
})

test('R10b d+g: a two-handed grip set in the panel shows in Notes; Equip/Put down in the panel still work', async ({ page }) => {
  const t = await openInventory(page, fighter('r10b-d', [item('Longsword')]))
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  const panel = drawer(page)
  await panel.getByRole('button', { name: 'Equip Longsword' }).click()
  await expect(tabRow(t, 'Longsword').locator('.inventory-tab__notes')).toHaveText('held')
  await panel.getByLabel('Grip for Longsword').selectOption('two-handed')
  await expect(tabRow(t, 'Longsword').locator('.inventory-tab__notes')).toContainText('two-handed')
  await panel.getByRole('button', { name: 'Put down Longsword' }).click()
  await expect(panel.getByRole('button', { name: 'Equip Longsword' })).toBeVisible()
  await expect(t.getByRole('checkbox', { name: 'Active Longsword' })).not.toBeChecked()
})

test('R10b e: attuned, requires attunement with its condition, and custom', async ({ page }) => {
  const t = await openInventory(
    page,
    fighter('r10b-e', [
      { ...item('Cloak of Protection', 'XDMG'), attuned: true },
      item('+1 Wand of the War Mage', 'XDMG'),
      item('Amulet of Health', 'XDMG'),
      { name: 'Lucky Pebble', source: 'Custom', quantity: 1, custom: { name: 'Lucky Pebble', kind: 'other' } },
    ]),
  )
  await expect(tabRow(t, 'Cloak of Protection').locator('.inventory-tab__notes')).toContainText('attuned')
  await expect(tabRow(t, 'Wand of the War Mage').locator('.inventory-tab__notes')).toContainText('requires attunement by a spellcaster')
  await expect(tabRow(t, 'Amulet of Health').locator('.inventory-tab__notes')).toHaveText('requires attunement')
  await expect(tabRow(t, 'Lucky Pebble').locator('.inventory-tab__subtitle')).toContainText('custom')
  await expect(tabRow(t, 'Lucky Pebble').locator('.inventory-tab__notes')).toContainText('custom')
})

test('R10b f: ▸ expands and collapses the description', async ({ page }) => {
  const t = await openInventory(page, fighter('r10b-f', [item('Torch')]))
  const toggle = t.getByRole('button', { name: 'Torch description' })
  await expect(t.locator('.inventory-tab__description')).toHaveCount(0)
  await toggle.click()
  await expect(t.locator('.inventory-tab__description')).toContainText('Bright Light in a 20-foot radius')
  await expect(toggle).toHaveText('▾')
  await toggle.click()
  await expect(t.locator('.inventory-tab__description')).toHaveCount(0)
})
