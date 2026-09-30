import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, expectStep, next } from './wizard.ts'

/* R14c1 (D218). A Human Fighter 3 seeded at the current schema, as customItemProficiencies.spec.ts: no skill proficiencies. */
const STORAGE_KEY = 'familliar:characters'
const LEVEL = 3

function fighter(id: string, inventory: Record<string, unknown>[] = []) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: LEVEL }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
  }
}

function customRow(name: string, definition: Record<string, unknown>) {
  return { name, source: 'custom', quantity: 1, custom: { name, kind: 'worn', ...definition } }
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

async function openInventory(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

async function startCustomItem(page: Page, name: string): Promise<Locator> {
  const panel = await openInventory(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill(name)
  return panel
}

/** Adds a feat or invocation row and picks the first option whose label starts with `name` (a repeated name carries its source). */
async function addGrant(panel: Locator, noun: 'feat' | 'invocation', n: number, name: string): Promise<void> {
  await panel.getByRole('button', { name: `+ Add ${noun}` }).click()
  const select = panel.getByRole('combobox', { name: `Custom item ${noun} ${n}` })
  const option = select.locator('option', { hasText: new RegExp(`^${name}( \\(|$)`) }).first()
  await expect(option).toBeAttached()
  await select.selectOption((await option.getAttribute('value')) ?? '')
}

async function openFeats(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' }).getByRole('region', { name: 'My Feats' })
}

const featRow = (mine: Locator, name: string): Locator =>
  mine.locator('.manage-spells__row').filter({ has: mine.page().locator('.manage-spells__name').getByText(name, { exact: true }) })
const featsGroup = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function skillStatus(page: Page, skillLabel: string): Promise<string | null> {
  return page.locator('.sheet__skills .sheet__row', { hasText: skillLabel }).locator('.sheet__prof-mark').getAttribute('data-status')
}

test('R14c1 a: an item granting Tough raises max HP by 2 × level and shows locked "From item" in Manage Feats and Features & Traits', async ({ page }) => {
  await open(page, fighter('r14c1-a'))
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)

  const panel = await startCustomItem(page, 'Belt of Stamina')
  await addGrant(panel, 'feat', 1, 'Tough')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => maxHp(page)).toBe(before + 2 * LEVEL)

  const mine = await openFeats(page)
  await expect(featRow(mine, 'Tough')).toContainText('From item (Belt of Stamina)')
  await expect(mine.getByRole('button', { name: /^Remove / })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('button', { name: 'Feats', exact: true }).click()
  await expect(featsGroup(page).locator('li').filter({ hasText: 'Tough' }).first()).toContainText('From item (Belt of Stamina)')
})

test('R14c1 b: Skilled from an item — its three skills chosen in Manage Feats become proficient; removing the item takes feat and skills away', async ({ page }) => {
  await open(page, fighter('r14c1-b', [customRow('Skill Charm', { feats: [{ name: 'Skilled', source: 'XPHB' }] })]))
  const mine = await openFeats(page)
  const skilled = featRow(mine, 'Skilled')
  await expect(skilled).toContainText('From item (Skill Charm)')
  await skilled.getByRole('button', { name: 'Skilled text' }).click()
  for (const [slot, skill] of [
    ['1', 'arcana'],
    ['2', 'history'],
    ['3', 'nature'],
  ] as const) {
    await skilled.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }
  for (const skill of ['Arcana', 'History', 'Nature']) await expect.poll(() => skillStatus(page, skill)).toBe('proficient')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].inventory[0].custom.feats, STORAGE_KEY)
  expect(stored).toEqual([{ name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana', 'history', 'nature'] } }])
  await page.keyboard.press('Escape')

  const inventory = await openInventory(page)
  await inventory.getByRole('button', { name: 'Remove Skill Charm from inventory' }).click()
  await page.keyboard.press('Escape')
  for (const skill of ['Arcana', 'History', 'Nature']) await expect.poll(() => skillStatus(page, skill)).not.toBe('proficient')
  const after = await openFeats(page)
  await expect(featRow(after, 'Skilled')).toHaveCount(0)
})

test('R14c1 c: an unattuned item that requires attunement grants no feat; Attune grants it', async ({ page }) => {
  await open(page, fighter('r14c1-c', [customRow('Heart Amulet', { requiresAttunement: true, feats: [{ name: 'Tough', source: 'XPHB' }] })]))
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)
  const mine = await openFeats(page)
  await expect(featRow(mine, 'Tough')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(featsGroup(page)).not.toContainText('Tough')

  const inventory = await openInventory(page)
  await inventory.getByRole('button', { name: 'Attune to Heart Amulet' }).click()
  await page.keyboard.press('Escape')
  await expect.poll(() => maxHp(page)).toBe(before + 2 * LEVEL)
  await expect(featRow(await openFeats(page), 'Tough')).toContainText('From item (Heart Amulet)')
})

test('R14c1 d: with an item feat Tough active, Edit Character does not offer Tough at the ASI level', async ({ page }) => {
  await createFighter(page, { name: 'Item Tough Test', level: 4, species: 'Dwarf|XPHB' })
  const panel = await startCustomItem(page, 'Belt of Stamina')
  await addGrant(panel, 'feat', 1, 'Tough')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await next(page)
  await expectStep(page, 'Species')
  await next(page)
  await expectStep(page, 'Background')
  await next(page)
  await expectStep(page, 'Proficiencies')
  await next(page)
  await expectStep(page, 'Ability scores')
  await next(page)
  await expectStep(page, 'ASI / Feat')

  const group = page.getByRole('group', { name: 'Level 4' })
  await group.getByRole('radio', { name: 'Feat', exact: true }).check()
  await expect(group.getByRole('radio', { name: 'Tough', exact: true })).toBeDisabled()
  await expect(group.getByText('Already granted by an item.')).toBeVisible()
})

test('R14c1 e: a non-Warlock with an item granting Witch Sight has Truesight 30 ft. and a "From items" group', async ({ page }) => {
  await open(page, fighter('r14c1-e'))
  const panel = await startCustomItem(page, 'Eye Ring')
  await addGrant(panel, 'invocation', 1, 'Witch Sight')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  await expect(page.locator('.sheet__senses-card .sheet__senses')).toContainText('Truesight: 30 ft. — from invocation (Witch Sight — Eye Ring)')

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  const fromItems = features.getByRole('region', { name: 'From items', exact: true })
  await expect(fromItems).toContainText('Witch Sight')
  await expect(fromItems).toContainText('Eye Ring')
  await features.getByRole('button', { name: 'Feats', exact: true }).click()
  await expect(fromItems).toHaveCount(0)
  await features.getByRole('button', { name: 'Class Features', exact: true }).click()
  await expect(fromItems).toContainText('Witch Sight')
})

test('R14c1 g: a feat or invocation used in one row is not offered in another', async ({ page }) => {
  await open(page, fighter('r14c1-g'))
  const panel = await startCustomItem(page, 'Gift')
  await addGrant(panel, 'feat', 1, 'Tough')
  await panel.getByRole('button', { name: '+ Add feat' }).click()
  const toughValue = await panel.getByRole('combobox', { name: 'Custom item feat 1' }).inputValue()
  await expect(panel.getByRole('combobox', { name: 'Custom item feat 2' }).locator(`option[value="${toughValue}"]`)).toHaveCount(0)
  await expect(panel.getByRole('combobox', { name: 'Custom item feat 2' }).locator('option', { hasText: /^Alert/ })).not.toHaveCount(0)

  await addGrant(panel, 'invocation', 1, 'Witch Sight')
  await panel.getByRole('button', { name: '+ Add invocation' }).click()
  const sightValue = await panel.getByRole('combobox', { name: 'Custom item invocation 1' }).inputValue()
  await expect(panel.getByRole('combobox', { name: 'Custom item invocation 2' }).locator(`option[value="${sightValue}"]`)).toHaveCount(0)
})

test.describe('with a Czech browser locale', () => {
  test.use({ locale: 'cs-CZ' })

  test('R14c1 f: the Conditions drawer lists conditions in English alphabetical order', async ({ page }) => {
    await open(page, fighter('r14c1-f'))
    // The scenario only proves something if this browser really sorts "Ch" after "H".
    expect(await page.evaluate(() => 'Charmed'.localeCompare('Grappled'))).toBe(1)
    await page.locator('.sheet__status-conditions').getByRole('button', { name: '+ Add condition' }).click()
    const names = page.getByRole('dialog', { name: 'Conditions' }).locator('.manage-spells__name')
    await expect(names).toHaveCount(15)
    expect((await names.allInnerTexts()).slice(0, 5)).toEqual(['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened'])
  })
})
