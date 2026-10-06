import { expect, test, type Locator, type Page } from '@playwright/test'

/* M5a (D325): a chosen spell belongs to the class that chose it — its numbers, its label, its class's own limits. Seeded at schema 59. */
const STORAGE_KEY = 'familliar:characters'
// INT 15 (+2) and WIS 12 (+1): at PB 3 the Wizard DC is 13, the Cleric DC 12.
const SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }

type Picks = Record<string, string[]>

function multiclass(id: string, order: [string, number][], picks: Picks) {
  return {
    schemaVersion: 59,
    id,
    name: id,
    classes: order.map(([className, level]) => ({ className, classSource: 'XPHB', subclass: null, level })),
    levelOrder: order.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: Object.entries(picks).map(([className, names]) => ({ className, classSource: 'XPHB', spells: names.map((name) => ({ name, source: 'XPHB' })) })),
  }
}

async function openSpells(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => panel(page).getByRole('region', { name: label, exact: true })
const rows = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const withClass = (scope: Locator, className: string): Locator =>
  scope.filter({ has: scope.page().locator('.sheet__action-subtitle', { hasText: new RegExp(`^${className}\\b`) }) })
const actionRows = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

const WIZARD_CLERIC: [string, number][] = [
  ['Wizard', 3],
  ['Cleric', 3],
]

test('M5a a: Wizard 3 / Cleric 3 — a Wizard pick has the Wizard DC, a Cleric pick the Cleric DC, each labelled with its class', async ({ page }) => {
  await openSpells(page, multiclass('m5a-a', WIZARD_CLERIC, { Wizard: ['Burning Hands'], Cleric: ['Sacred Flame'] }))
  const burning = rows(section(page, '1st Level'), 'Burning Hands')
  await expect(burning).toHaveCount(1)
  await expect(burning.locator('.sheet__action-subtitle')).toHaveText(/^Wizard/)
  await expect(burning.locator('.sheet__action-to-hit')).toContainText('DC 13 DEX')
  await burning.getByRole('button', { name: 'Burning Hands', exact: true }).click()
  await expect(burning.locator('.sheet__spell-provenance')).toHaveText('player pick (Wizard)')

  const flame = rows(section(page, 'Cantrips'), 'Sacred Flame')
  await expect(flame.locator('.sheet__action-subtitle')).toHaveText(/^Cleric/)
  await expect(flame.locator('.sheet__action-to-hit')).toContainText('DC 12 DEX')
  await flame.getByRole('button', { name: 'Sacred Flame', exact: true }).click()
  await expect(flame.locator('.sheet__spell-provenance')).toHaveText('player pick (Cleric)')
})

test('M5a b: Hold Person chosen by both — two rows with DC 13 and DC 12, on Spells and on Actions', async ({ page }) => {
  await openSpells(page, multiclass('m5a-b', WIZARD_CLERIC, { Wizard: ['Hold Person'], Cleric: ['Hold Person'] }))
  const second = rows(section(page, '2nd Level'), 'Hold Person')
  await expect(second).toHaveCount(2)
  await expect(withClass(second, 'Wizard').locator('.sheet__action-to-hit')).toContainText('DC 13 WIS')
  await expect(withClass(second, 'Cleric').locator('.sheet__action-to-hit')).toContainText('DC 12 WIS')

  await page.getByRole('tab', { name: 'Actions' }).click()
  const actions = actionRows(page, 'Hold Person')
  await expect(actions).toHaveCount(2)
  await expect(actions.filter({ hasText: 'Wizard' })).toContainText('DC 13 WIS')
  await expect(actions.filter({ hasText: 'Cleric' })).toContainText('DC 12 WIS')
})

const WARLOCK_SORCERER: [string, number][] = [
  ['Warlock', 6],
  ['Sorcerer', 3],
]

test('M5a c: Warlock 6 / Sorcerer 3 — the Sorcerer’s Fireball is unavailable, the Warlock’s Counterspell is not; no "cannot tell" text', async ({ page }) => {
  await openSpells(page, multiclass('m5a-c', WARLOCK_SORCERER, { Warlock: ['Counterspell'], Sorcerer: ['Fireball'] }))
  const third = section(page, '3rd Level')
  await expect(rows(third, 'Fireball').locator('.sheet__action-subtitle')).toContainText('Unavailable at this level')
  await expect(rows(third, 'Counterspell').locator('.sheet__action-subtitle')).toHaveText(/^Warlock/)
  await expect(rows(third, 'Counterspell').locator('.sheet__action-subtitle')).not.toContainText('Unavailable')
  await expect(page.getByText('Cannot tell this character', { exact: false })).toHaveCount(0)
  await expect(page.getByText('could belong to more than one casting class', { exact: false })).toHaveCount(0)
})

test('M5a d: the over-limit notice names the class that stores too many cantrips', async ({ page }) => {
  await openSpells(
    page,
    multiclass('m5a-d', WARLOCK_SORCERER, { Sorcerer: ['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation', 'Ray of Frost'], Warlock: ['Eldritch Blast'] }),
  )
  await expect(panel(page).locator('.sheet__spell-count-over')).toHaveText(['Sorcerer cantrips: 5 known, 4 allowed.'])
})

test('M5a e: Manage Spells — the Sorcerer section of Warlock 6 / Sorcerer 3 offers nothing above 2nd level', async ({ page }) => {
  await openSpells(page, multiclass('m5a-e', WARLOCK_SORCERER, {}))
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
  const sorcerer = drawer.locator('summary', { hasText: /^Sorcerer$/ }).locator('..')
  const add = sorcerer.getByRole('region', { name: 'Add Spells' })
  await expect(add.getByRole('group', { name: 'Filter by level' }).getByRole('button')).toHaveText(['Cantrip', '1st', '2nd'])
  await expect(add.locator('.manage-spells__level', { hasText: '3rd Level' })).toHaveCount(0)
})
