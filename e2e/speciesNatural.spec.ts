import { expect, test, type Locator, type Page } from '@playwright/test'

/* S5 (D357, D358): species natural armour and natural weapons. Characters seeded into storage, as in sheetCalculations.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
// DEX 16 (+3), STR 15 (+2), CON 13 (+1).
const SCORES = { strength: 15, dexterity: 16, constitution: 13, intelligence: 10, wisdom: 10, charisma: 8 }

function seeded(id: string, className: string, level: number, species: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: species, source: 'MPMM' },
    speciesSize: 'M',
    spellChoices: [],
    ...extra,
  }
}

const item = (name: string, equipped?: 'worn' | 'held') => ({ name, source: 'XPHB', quantity: 1, ...(equipped ? { equipped } : {}) })

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

async function breakdown(page: Page, button: string): Promise<Locator> {
  await page.getByRole('button', { name: button, exact: true }).click()
  return page.getByRole('dialog')
}

const armourClass = (page: Page): Locator => page.locator('.sheet__armour-class-value')
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

test('S5 a: Tortle without armour — AC 17, the breakdown names Natural Armor', async ({ page }) => {
  await open(page, seeded('s5-tortle', 'Fighter', 1, 'Tortle', { currentHp: 11 }))
  await expect(armourClass(page)).toHaveText('17')
  await expect(await breakdown(page, 'Armour Class breakdown')).toContainText('Natural Armor (Tortle)')
})

test('S5 b: Lizardfolk, DEX 16, no armour — AC 16; equipping Leather Armor keeps 16 and lists both', async ({ page }) => {
  await open(page, seeded('s5-lizard', 'Fighter', 1, 'Lizardfolk', { currentHp: 11, inventory: [item('Leather Armor')] }))
  await expect(armourClass(page)).toHaveText('16')
  await expect(await breakdown(page, 'Armour Class breakdown')).toContainText('Natural Armor (Lizardfolk)')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  await page.getByRole('dialog', { name: 'Manage Inventory' }).getByRole('button', { name: 'Equip Leather Armor' }).click()
  await page.keyboard.press('Escape')
  await expect(armourClass(page)).toHaveText('16')
  const dialog = await breakdown(page, 'Armour Class breakdown')
  await expect(dialog).toContainText('Natural Armor (Lizardfolk)')
  await expect(dialog).toContainText('Leather Armor')
  await expect(dialog).toContainText('not applied')
})

test('S5 c: natural armour plus a Shield — the shield adds as the species text says', async ({ page }) => {
  await open(page, seeded('s5-shield', 'Fighter', 1, 'Tortle', { currentHp: 11, inventory: [item('Shield', 'held')] }))
  await expect(armourClass(page)).toHaveText('19')
})

test('S5 d: a Tortle wearing armour is allowed, with a warning line in the breakdown', async ({ page }) => {
  await open(page, seeded('s5-tortle-armour', 'Fighter', 1, 'Tortle', { currentHp: 11, inventory: [item('Leather Armor', 'worn')] }))
  await expect(armourClass(page)).toHaveText('17')
  await expect(await breakdown(page, 'Armour Class breakdown')).toContainText('cannot wear armor')
})

test('S5 e: Aarakocra gets a Talons row — 1d6 + STR slashing, to hit STR + PB', async ({ page }) => {
  await open(page, seeded('s5-talons', 'Fighter', 1, 'Aarakocra', { currentHp: 11 }))
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Roll Talons to hit' })).toHaveText('+4')
  await expect(actionRow(page, 'Talons')).toContainText('1d6 + 2 slashing')
  await expect(actionRow(page, 'Unarmed Strike')).toBeVisible()
})

test('S5 f: Monk 5 Centaur — Hooves use the larger Martial Arts die and Dexterity', async ({ page }) => {
  await open(page, seeded('s5-monk', 'Monk', 5, 'Centaur', { currentHp: 33 }))
  await page.getByRole('tab', { name: 'Actions' }).click()
  // DEX +3, PB +3; the d8 replaces the species d6.
  await expect(page.getByRole('button', { name: 'Roll Hooves to hit' })).toHaveText('+6')
  await expect(actionRow(page, 'Hooves')).toContainText('1d8 + 3 bludgeoning')
})
