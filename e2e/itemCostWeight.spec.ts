import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-41 (D368): cost and weight in the expanded item detail on the Inventory tab. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function fighter(id: string, inventory: Record<string, unknown>[]) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className: 'Fighter', classSource: XPHB, subclass: null, level: 1 }],
    levelOrder: [{ className: 'Fighter', classSource: XPHB }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    hitPointLevels: [],
    classSkills: ['athletics', 'perception'],
    masteries: ['Longsword', 'Greatsword', 'Handaxe'].map((name) => ({ name })),
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    inventory,
  }
}

async function openInventory(page: Page, character: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Inventory' }).click()
  return page.getByRole('tabpanel', { name: 'Inventory' })
}

const row = (scope: Locator, name: string): Locator => scope.locator('.sheet__inventory-list > li', { hasText: name })

test('F-41 a: a mundane item without a description expands to its cost and weight, per single item', async ({ page }) => {
  const t = await openInventory(page, fighter('f41-a', [{ name: 'Battleaxe', source: XPHB, quantity: 3 }]))
  await row(t, 'Battleaxe').getByRole('button', { name: 'Battleaxe description' }).click()
  await expect(row(t, 'Battleaxe').locator('.inventory-tab__description')).toHaveText('Cost: 10 gp · Weight: 4 lb.')
})

test('F-41 b: an item with a description shows the line above the description', async ({ page }) => {
  const t = await openInventory(page, fighter('f41-b', [{ name: 'Rope', source: XPHB, quantity: 1 }]))
  await row(t, 'Rope').getByRole('button', { name: 'Rope description' }).click()
  const detail = row(t, 'Rope').locator('.inventory-tab__description')
  await expect(detail.locator('> :first-child')).toHaveText('Cost: 1 gp · Weight: 5 lb.')
  await expect(detail.locator('> :nth-child(2)')).not.toBeEmpty()
})

test('F-41 c: a magic item without a value shows no Cost part', async ({ page }) => {
  const t = await openInventory(page, fighter('f41-c', [{ name: '+1 Wand of the War Mage', source: 'XDMG', quantity: 1 }]))
  await row(t, 'Wand of the War Mage').locator('.manage-spells__expand').click()
  const detail = row(t, 'Wand of the War Mage').locator('.inventory-tab__description')
  await expect(detail.locator('.inventory-tab__cost-weight')).toHaveText('Weight: 1 lb.')
  await expect(detail).not.toContainText('Cost:')
})

test('F-41 d: a custom item with a value shows its Cost', async ({ page }) => {
  const t = await openInventory(page, fighter('f41-d', [{ name: 'Lucky Pebble', source: 'custom', quantity: 2, custom: { name: 'Lucky Pebble', kind: 'other', valueCopper: 150 } }]))
  await row(t, 'Lucky Pebble').getByRole('button', { name: 'Lucky Pebble description' }).click()
  await expect(row(t, 'Lucky Pebble').locator('.inventory-tab__cost-weight')).toHaveText('Cost: 1 gp 5 sp')
})
