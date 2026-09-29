import { expect, test, type Locator, type Page } from '@playwright/test'

/* R14c2 (D219). Characters seeded at the current schema, as customItemFeats.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

function character(id: string, className: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `${className} ${id}`,
    classes: [{ className, classSource: 'XPHB', subclass: null, level: 3 }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 12, charisma: 14 } },
    ...extra,
  }
}

const fixed = (over: Record<string, unknown> = {}) => ({ kind: 'fixed', ...over })
const itemSpell = (name: string, uses: Record<string, unknown>, over: Record<string, unknown> = {}) => ({ name, source: 'XPHB', uses, caster: fixed(), ...over })
const customRow = (name: string, definition: Record<string, unknown>) => ({ name, source: 'custom', quantity: 1, custom: { name, kind: 'worn', ...definition } })

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

async function openInventory(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

/** Starts a custom item and adds spell row 1 with `spell` chosen. */
async function startItemWithSpell(page: Page, name: string, spell: string): Promise<Locator> {
  const panel = await openInventory(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill(name)
  await panel.getByRole('button', { name: '+ Add spell' }).click()
  const select = panel.getByRole('combobox', { name: 'Custom item spell 1', exact: true })
  await expect(select.locator(`option[value="${spell}|XPHB"]`)).toBeAttached()
  await select.selectOption(`${spell}|XPHB`)
  return panel
}

async function openSpells(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Spells' }).click()
  return page.getByRole('tabpanel', { name: 'Spells' })
}

const section = (spells: Locator, label: string): Locator => spells.getByRole('region', { name: label, exact: true })
const rows = (scope: Locator, kind: 'cast' | 'use' | 'label', name: string): Locator =>
  scope.locator(`.sheet__spell-row--${kind}`, { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const boxes = (row: Locator, used = false): Locator => row.locator(`.sheet__spell-notes .sheet__use-box${used ? '--used' : ''}`)
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)

async function shortRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
}

test('R14c2 a: Fighter 3 — an item with Misty Step 2/LR is a 2nd Level USE row with 2 boxes; two uses empty it, Long Rest refills, no slot anywhere', async ({ page }) => {
  await open(page, character('r14c2-a', 'Fighter'))
  const panel = await startItemWithSpell(page, 'Cloak of Steps', 'Misty Step')
  await panel.getByRole('combobox', { name: 'Custom item spell 1 uses', exact: true }).selectOption('perLongRest')
  await panel.getByRole('spinbutton', { name: 'Custom item spell 1 uses per rest' }).fill('2')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  const spells = await openSpells(page)
  const use = rows(section(spells, '2nd Level'), 'use', 'Misty Step')
  await expect(use.locator('.sheet__action-subtitle')).toContainText('Cloak of Steps')
  await expect(use.locator('.sheet__spell-use')).toContainText('Use')
  await expect(boxes(use)).toHaveCount(2)
  await use.getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await use.getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await expect(boxes(use, true)).toHaveCount(2)
  await expect(use.getByRole('button', { name: 'Use Misty Step', exact: true })).toBeDisabled()
  expect((await stored(page)).inventory[0].spellUses).toEqual({ 'Misty Step|XPHB': 2 })

  await expect(spells.locator('.sheet__spell-section-heading .sheet__use-box')).toHaveCount(0)
  await expect(spells.getByRole('button', { name: /^Cast / })).toHaveCount(0)
  expect((await stored(page)).play?.spentSpellSlots).toBeUndefined()

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(boxes(use, true)).toHaveCount(0)
  await expect(use.getByRole('button', { name: 'Use Misty Step', exact: true })).toBeEnabled()
})

test('R14c2 b: Fireball 1/SR cast at 5th with fixed DC 15 — 5th Level row badged "3rd", 10d6, DC 15 on Spells and Actions; Short Rest refills', async ({ page }) => {
  const staff = customRow('Staff of Embers', { spells: [itemSpell('Fireball', { kind: 'perShortRest', count: 1 }, { castLevel: 5, caster: fixed({ saveDc: 15 }) })] })
  await open(page, character('r14c2-b', 'Fighter', { inventory: [staff] }))
  const spells = await openSpells(page)
  const use = rows(section(spells, '5th Level'), 'use', 'Fireball')
  await expect(use.locator('.sheet__spell-badge')).toHaveText('3rd')
  await expect(use.locator('.sheet__spell-effect').getByRole('button', { name: 'Roll Fireball damage' })).toHaveText('10d6')
  await expect(use.locator('.sheet__action-to-hit')).toContainText('DC 15 DEX')

  await use.getByRole('button', { name: 'Use Fireball', exact: true }).click()
  await expect(boxes(use, true)).toHaveCount(1)
  await shortRest(page)
  await expect(boxes(use, true)).toHaveCount(0)

  await page.getByRole('tab', { name: 'Actions' }).click()
  const action = actionRow(page, 'Fireball')
  await expect(action).toContainText('DC 15 DEX')
  await expect(action.getByRole('button', { name: 'Roll Fireball damage' })).toHaveText('10d6')
  await expect(action).toContainText('Staff of Embers')
})

test('R14c2 c: "Use my own" — the ability select appears only with it, starts empty for a Fighter and blocks saving; DC = 8 + PB + Cha on Spells and Actions', async ({ page }) => {
  await open(page, character('r14c2-c', 'Fighter'))
  const panel = await startItemWithSpell(page, 'Charm of Holding', 'Hold Person')
  const ability = panel.getByRole('combobox', { name: 'Custom item spell 1 spellcasting ability' })
  await expect(ability).toHaveCount(0)
  await panel.getByRole('combobox', { name: 'Custom item spell 1 DC and attack' }).selectOption('own')
  await expect(ability).toHaveValue('')
  await expect(panel.getByRole('button', { name: 'Add custom item' })).toBeDisabled()
  await ability.selectOption('cha')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  // PB 2 at level 3, Charisma 14 → +2.
  const spells = await openSpells(page)
  await expect(rows(section(spells, '2nd Level'), 'label', 'Hold Person').locator('.sheet__action-to-hit')).toContainText('DC 12 WIS')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionRow(page, 'Hold Person')).toContainText('DC 12 WIS')
})

test('R14c2 c2: for a Cleric the spellcasting ability starts on Wisdom', async ({ page }) => {
  await open(page, character('r14c2-c2', 'Cleric'))
  const panel = await startItemWithSpell(page, 'Holy Charm', 'Hold Person')
  await panel.getByRole('combobox', { name: 'Custom item spell 1 DC and attack' }).selectOption('own')
  await expect(panel.getByRole('combobox', { name: 'Custom item spell 1 spellcasting ability' })).toHaveValue('wis')
})

test('R14c2 d: an unattuned item that requires attunement grants no spell; Attune grants it', async ({ page }) => {
  const wand = customRow('Wand of Steps', { requiresAttunement: true, spells: [itemSpell('Misty Step', { kind: 'atWill' })] })
  await open(page, character('r14c2-d', 'Fighter', { inventory: [wand] }))
  await expect(page.locator('.sheet__spell-name', { hasText: /^Misty Step$/ })).toHaveCount(0)

  const inventory = await openInventory(page)
  await inventory.getByRole('button', { name: 'Attune to Wand of Steps' }).click()
  await page.keyboard.press('Escape')
  const spells = await openSpells(page)
  await expect(rows(section(spells, '2nd Level'), 'label', 'Misty Step')).toContainText('At will')
})

test('R14c2 e: Fire Bolt from an item with a fixed +7 is "At will" in Cantrips with Hit +7; with the field empty the Hit cell gives the reason', async ({ page }) => {
  const rod = customRow('Rod of Sparks', { spells: [itemSpell('Fire Bolt', { kind: 'atWill' }, { caster: fixed({ attackBonus: 7 }) })] })
  const blank = customRow('Blank Rod', { spells: [itemSpell('Fire Bolt', { kind: 'atWill' })] })
  await open(page, character('r14c2-e', 'Fighter', { inventory: [rod, blank] }))
  const spells = await openSpells(page)
  const cantrips = rows(section(spells, 'Cantrips'), 'label', 'Fire Bolt')
  const withBonus = cantrips.filter({ hasText: 'Rod of Sparks' })
  await expect(withBonus.locator('.sheet__spell-use')).toHaveText('At will')
  await expect(withBonus.locator('.sheet__action-to-hit')).toHaveText('+7')
  await expect(cantrips.filter({ hasText: 'Blank Rod' }).locator('.sheet__action-to-hit')).toContainText('The item does not state an attack bonus for Fire Bolt.')
})

test('R14c2 f: a spent use stays with its item when another item is removed, and a removed-then-re-added item starts full', async ({ page }) => {
  const ring = (name: string) => customRow(name, { spells: [itemSpell('Misty Step', { kind: 'perLongRest', count: 2 })] })
  await open(page, character('r14c2-f', 'Fighter', { inventory: [ring('Ring A'), ring('Ring B')] }))
  let spells = await openSpells(page)
  const ringB = () => rows(section(spells, '2nd Level'), 'use', 'Misty Step').filter({ hasText: 'Ring B' })
  await ringB().getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await expect(boxes(ringB(), true)).toHaveCount(1)

  let inventory = await openInventory(page)
  await inventory.getByRole('button', { name: 'Remove Ring A from inventory' }).click()
  await page.keyboard.press('Escape')
  spells = await openSpells(page)
  await expect(rows(spells, 'use', 'Misty Step')).toHaveCount(1)
  await expect(boxes(ringB(), true)).toHaveCount(1)

  inventory = await openInventory(page)
  await inventory.getByRole('button', { name: 'Remove Ring B from inventory' }).click()
  await page.keyboard.press('Escape')
  const panel = await startItemWithSpell(page, 'Ring B', 'Misty Step')
  await panel.getByRole('combobox', { name: 'Custom item spell 1 uses', exact: true }).selectOption('perLongRest')
  await panel.getByRole('spinbutton', { name: 'Custom item spell 1 uses per rest' }).fill('2')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')
  spells = await openSpells(page)
  await expect(boxes(ringB())).toHaveCount(2)
  await expect(boxes(ringB(), true)).toHaveCount(0)
})

test('R14c2 g: a Wizard who knows Misty Step and holds an item with it has a CAST row and a separate item USE row', async ({ page }) => {
  const ring = customRow('Ring of Steps', { spells: [itemSpell('Misty Step', { kind: 'perLongRest', count: 1 })] })
  await open(
    page,
    character('r14c2-g', 'Wizard', {
      inventory: [ring],
      spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Misty Step', source: 'XPHB' }] }],
    }),
  )
  const second = section(await openSpells(page), '2nd Level')
  await expect(rows(second, 'cast', 'Misty Step')).toHaveCount(1)
  const use = rows(second, 'use', 'Misty Step')
  await expect(use).toHaveCount(1)
  await expect(use.locator('.sheet__action-subtitle')).toContainText('Ring of Steps')
  await use.getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await expect(second.locator('.sheet__spell-section-heading .sheet__use-box--used')).toHaveCount(0)
})
