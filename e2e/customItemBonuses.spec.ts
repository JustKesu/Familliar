import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * R14a1 (D216). A Fighter 3 seeded at schema 53 (so every load also walks the
 * 53 → 54 migration), as in manageInventory.spec.ts. STR 15, DEX 14, CON 13,
 * WIS 12, PB +2, no skill proficiencies: Initiative +2, Stealth +2, Longsword
 * +4 / 1d8 + 2, max HP 10 + 6 + 6 + 3 = 25, AC 12 unarmoured.
 */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, inventory: Record<string, unknown>[] = []) {
  return {
    schemaVersion: 53,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
  }
}

const longsword = { name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }

function customRow(name: string, definition: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { name, source: 'custom', quantity: 1, custom: { name, kind: 'other', ...definition }, ...extra }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

const initiative = (page: Page): Locator => page.getByRole('button', { name: 'Roll initiative' })
const skill = (page: Page, name: string): Locator => page.getByRole('button', { name: `Roll ${name} check` })
const passive = (page: Page, name: string): Locator => page.locator('.sheet__senses-card li', { hasText: `Passive ${name}` }).locator('.sheet__sense-number')
const save = (page: Page, ability: string): Locator => page.getByRole('button', { name: `Roll ${ability} saving throw` })
const target = (panel: Locator, n: number): Locator => panel.getByRole('combobox', { name: `Custom item bonus ${n} target` })
const amount = (panel: Locator, n: number): Locator => panel.getByRole('spinbutton', { name: `Custom item bonus ${n} amount` })

/** Opens a breakdown drawer by its button, checks it names the item, and closes it. */
async function expectBreakdown(page: Page, button: string, dialog: string, text: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: button, exact: true }).click()
  await expect(page.getByRole('dialog', { name: dialog, exact: true })).toContainText(text)
  await page.keyboard.press('Escape')
}

test('R14a1 a: Add Custom Item with six bonuses moves Initiative, Stealth, passive Perception, the weapon row and max HP, each named in its breakdown', async ({ page }) => {
  // The feather's Perception skill bonus raises the passive value too (PHB: 10 + every modifier to the check).
  await open(page, fighter('r14a1-a', [longsword, customRow('Owl Feather', { bonuses: [{ target: 'skill', skill: 'perception', amount: 1 }] })]))
  await expect(passive(page, 'Perception')).toHaveText('12')
  await expect.poll(() => maxHp(page)).toBe(25)

  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Lucky Pin')
  const bonuses: [string, string][] = [
    ['Initiative', '2'],
    ['Stealth', '3'],
    ['Passive Perception', '5'],
    ['Weapon attack rolls', '1'],
    ['Weapon damage rolls', '1'],
    ['Max HP', '1'],
  ]
  for (const [index, [label, value]] of bonuses.entries()) {
    await panel.getByRole('button', { name: '+ Add bonus' }).click()
    await target(panel, index + 1).selectOption({ label })
    await amount(panel, index + 1).fill(value)
  }
  await panel.getByRole('checkbox', { name: 'Custom item bonus 6 per level' }).check()
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  await expect(initiative(page)).toHaveText('+4')
  await expect(skill(page, 'Stealth')).toHaveText('+5')
  await expect(passive(page, 'Perception')).toHaveText('17')
  // The passive target never reaches the roll: WIS +1, feather +1.
  await expect(skill(page, 'Perception')).toHaveText('+2')
  await expect.poll(() => maxHp(page)).toBe(28)

  await expectBreakdown(page, 'Initiative breakdown', 'Initiative', 'Lucky Pin: +2')
  await expectBreakdown(page, 'Stealth breakdown', 'Stealth', 'Lucky Pin: +3')
  await expectBreakdown(page, 'Senses details', 'Senses', 'Lucky Pin: +5')
  await expectBreakdown(page, 'Hit points details', 'Hit Points', 'Lucky Pin (+1 per level × 3): +3')

  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+5')
  await expect(page.getByRole('button', { name: 'Roll Longsword damage' })).toContainText('1d8 + 3')
  await page.getByRole('button', { name: 'Longsword breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Longsword' })).toContainText('Lucky Pin: +1')
})

test('R14a1 b: an unattuned item that requires attunement changes nothing and says so; Attune applies it', async ({ page }) => {
  const pin = customRow('Lucky Pin', {
    requiresAttunement: true,
    bonuses: [
      { target: 'initiative', amount: 2 },
      { target: 'maxHitPoints', amount: 1, perLevel: true },
    ],
  })
  await open(page, fighter('r14a1-b', [pin]))
  await expect(initiative(page)).toHaveText('+2')
  await expect.poll(() => maxHp(page)).toBe(25)
  await expectBreakdown(page, 'Initiative breakdown', 'Initiative', 'Lucky Pin: considered (+2) — not applied: requires attunement and you are not attuned to it')
  await expectBreakdown(page, 'Hit points details', 'Hit Points', 'considered (+3) — not applied')

  const panel = await openManage(page)
  await panel.getByRole('button', { name: 'Attune to Lucky Pin' }).click()
  await page.keyboard.press('Escape')
  await expect(initiative(page)).toHaveText('+4')
  await expect.poll(() => maxHp(page)).toBe(28)
})

test('R14a1 c: a Wisdom save bonus changes only the Wisdom save, and stacks with All saving throws on a second item', async ({ page }) => {
  const amulet = customRow('Owl Amulet', { bonuses: [{ target: 'savingThrow', ability: 'wisdom', amount: 2 }] })
  await open(page, fighter('r14a1-c', [amulet]))
  // WIS +1 +2; DEX +2 alone; STR +2 proficient +2.
  await expect(save(page, 'Wisdom')).toHaveText('+3')
  await expect(save(page, 'Dexterity')).toHaveText('+2')
  await expect(save(page, 'Strength')).toHaveText('+4')

  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Ward Ring')
  await panel.getByRole('button', { name: '+ Add bonus' }).click()
  await target(panel, 1).selectOption({ label: 'All saving throws' })
  await amount(panel, 1).fill('1')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  await expect(save(page, 'Wisdom')).toHaveText('+4')
  await expect(save(page, 'Dexterity')).toHaveText('+3')
  await expectBreakdown(page, 'Wisdom saving throw breakdown', 'Wisdom saving throw', /Owl Amulet: \+2[\s\S]*Ward Ring: \+1|Ward Ring: \+1[\s\S]*Owl Amulet: \+2/)
})

test('R14a1 d: removing a bonus row in Edit puts the number back', async ({ page }) => {
  const pin = customRow('Lucky Pin', {
    bonuses: [
      { target: 'initiative', amount: 2 },
      { target: 'skill', skill: 'stealth', amount: 3 },
    ],
  })
  await open(page, fighter('r14a1-d', [pin]))
  await expect(initiative(page)).toHaveText('+4')

  const panel = await openManage(page)
  await panel.getByRole('region', { name: 'My Inventory' }).getByRole('button', { name: 'Edit Lucky Pin' }).click()
  await expect(target(panel, 1)).toHaveValue('initiative')
  await panel.getByRole('button', { name: 'Remove custom item bonus 1' }).click()
  await expect(target(panel, 1)).toHaveValue('skill:stealth')
  await panel.getByRole('button', { name: 'Save changes' }).click()
  await page.keyboard.press('Escape')

  await expect(initiative(page)).toHaveText('+2')
  await expect(skill(page, 'Stealth')).toHaveText('+5')
})

test('R14a1 e: a target used in one row is not offered in another; per level appears only for Max HP', async ({ page }) => {
  await open(page, fighter('r14a1-e'))
  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByRole('button', { name: '+ Add bonus' }).click()
  await panel.getByRole('button', { name: '+ Add bonus' }).click()

  await expect(target(panel, 1).locator('optgroup')).toHaveCount(5)
  expect(await target(panel, 1).locator('optgroup').evaluateAll((groups) => groups.map((group) => group.getAttribute('label')))).toEqual([
    'General',
    'Saving throws',
    'Ability checks & skills',
    'Passive',
    'Familiar',
  ])
  await target(panel, 1).selectOption({ label: 'Initiative' })
  await expect(target(panel, 2).locator('option[value="initiative"]')).toHaveCount(0)
  await expect(target(panel, 1).locator('option[value="initiative"]')).toHaveCount(1)
  await expect(panel.getByRole('checkbox', { name: /per level/ })).toHaveCount(0)

  await target(panel, 2).selectOption({ label: 'Max HP' })
  await expect(panel.getByRole('checkbox', { name: 'Custom item bonus 2 per level' })).toBeVisible()
  await expect(panel.getByRole('checkbox', { name: 'Custom item bonus 1 per level' })).toHaveCount(0)
  await expect(target(panel, 1).locator('option[value="maxHitPoints"]')).toHaveCount(0)
})

test('R14a1 f: a schema-53 custom item with bonusArmourClass 1 loads, still adds to AC, and Edit shows an Armor Class +1 row', async ({ page }) => {
  await open(page, fighter('r14a1-f', [customRow('Old Cloak', { kind: 'worn', bonusArmourClass: 1 })]))
  // 10 + DEX 2 + cloak 1.
  await expect(page.locator('.sheet__armour-class-value')).toHaveText('13')

  const panel = await openManage(page)
  await panel.getByRole('region', { name: 'My Inventory' }).getByRole('button', { name: 'Edit Old Cloak' }).click()
  await expect(target(panel, 1)).toHaveValue('armourClass')
  await expect(target(panel, 1).locator('option:checked')).toHaveText('Armor Class')
  await expect(amount(panel, 1)).toHaveValue('1')
})
