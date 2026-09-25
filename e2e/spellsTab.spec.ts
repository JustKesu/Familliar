import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillUpToBackground, finishFromBackground, select, type FighterOptions } from './wizard.ts'

/*
 * R7a (D189). wizard.ts builds Fighters only, so the two casters are saved
 * characters written into storage before the app loads — the same records the
 * wizard would save (schema 48), read back through the store's validation.
 */
const STORAGE_KEY = 'familliar:characters'

const scores = (key: 'wisdom' | 'charisma') => ({
  method: 'standardArray',
  scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10, [key]: 16 },
})
const spells = (...names: string[]) => names.map((name) => ({ name, source: 'XPHB' }))

const CLERIC = {
  schemaVersion: 48,
  id: 'r7a-cleric',
  name: 'Spell Cleric',
  classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: scores('wisdom'),
  spellChoices: [
    {
      className: 'Cleric',
      classSource: 'XPHB',
      spells: spells('Guidance', 'Sacred Flame', 'Toll the Dead', 'Bless', 'Cure Wounds', 'Guiding Bolt', 'Shield of Faith', 'Aid', 'Spiritual Weapon'),
    },
  ],
}

const WARLOCK = {
  schemaVersion: 48,
  id: 'r7a-warlock',
  name: 'Spell Warlock',
  classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
  abilityScores: scores('charisma'),
  spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: spells('Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Hold Person', 'Counterspell') }],
}

/** Seeds once per test (the init script runs on every load, so a reload keeps what the test did). */
async function openSaved(page: Page, character: { id: string }): Promise<void> {
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
const slotBoxes = (scope: Locator): Locator => scope.locator('.sheet__spell-section-heading .sheet__use-box')
const usedBoxes = (scope: Locator): Locator => scope.locator('.sheet__spell-section-heading .sheet__use-box--used')
const row = (page: Page, name: string): Locator => panel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const shownNames = (page: Page): Locator => panel(page).locator('.sheet__spell-name')

test('R7a a: Cleric 3 — sections with 4 and 2 boxes; CAST fills a box, a filled box returns it, a spent level disables CAST, Long Rest empties', async ({ page }) => {
  await openSaved(page, CLERIC)
  await expect(panel(page).locator('.sheet__spell-section h3')).toHaveText(['Cantrips', '1st Level', '2nd Level'])
  const first = section(page, '1st Level')
  await expect(slotBoxes(first)).toHaveCount(4)
  await expect(slotBoxes(section(page, '2nd Level'))).toHaveCount(2)
  await expect(slotBoxes(section(page, 'Cantrips'))).toHaveCount(0)

  await first.getByRole('button', { name: 'Cast Cure Wounds' }).click()
  await expect(usedBoxes(first)).toHaveCount(1)
  await first.getByRole('button', { name: 'Undo a use of level 1 spell slots' }).click()
  await expect(usedBoxes(first)).toHaveCount(0)

  for (let i = 0; i < 4; i++) await first.getByRole('button', { name: 'Cast Cure Wounds' }).click()
  await expect(usedBoxes(first)).toHaveCount(4)
  for (const name of ['Bless', 'Cure Wounds', 'Guiding Bolt', 'Shield of Faith']) {
    await expect(first.getByRole('button', { name: `Cast ${name}` })).toBeDisabled()
  }
  await expect(section(page, '2nd Level').getByRole('button', { name: 'Cast Aid' })).toBeEnabled()

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(usedBoxes(first)).toHaveCount(0)
  await expect(first.getByRole('button', { name: 'Cast Bless' })).toBeEnabled()
})

test('R7a b: Warlock 5 — one 3rd Level section with PACT and 2 boxes; a 1st-level spell stands there with a "1st" badge; Finish Short Rest empties the box', async ({ page }) => {
  await openSaved(page, WARLOCK)
  await expect(panel(page).locator('.sheet__spell-section h3')).toHaveText(['Cantrips', '3rd Level'])
  const third = section(page, '3rd Level')
  await expect(third.locator('.sheet__spell-pact-tag')).toHaveText('Pact')
  await expect(slotBoxes(third)).toHaveCount(2)
  await expect(third.locator('.sheet__spell-pact')).toContainText('/ Short Rest')
  await expect(row(page, 'Hex').locator('.sheet__spell-badge')).toHaveText('1st')
  await expect(row(page, 'Hold Person').locator('.sheet__spell-badge')).toHaveText('2nd')

  await third.getByRole('button', { name: 'Cast Hex' }).click()
  await expect(usedBoxes(third)).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(usedBoxes(third)).toHaveCount(0)
})

test('R7a c: CAST on a concentration spell names it in the Concentration card; CAST on another replaces it', async ({ page }) => {
  await openSaved(page, CLERIC)
  const card = page.locator('.sheet__status-row .sheet__concentration')
  await section(page, '1st Level').getByRole('button', { name: 'Cast Bless' }).click()
  await expect(card).toContainText('Bless')
  await section(page, '1st Level').getByRole('button', { name: 'Cast Shield of Faith' }).click()
  await expect(card).toContainText('Shield of Faith')
  await expect(card).not.toContainText('Bless')
})

test('R7a d: level and Concentration pills, search, All; typing stores nothing', async ({ page }) => {
  await openSaved(page, CLERIC)
  const pills = panel(page).getByRole('group', { name: 'Filter spells' })
  await expect(pills.getByRole('button')).toHaveText(['All', 'Cantrips', '1st', '2nd', 'Concentration', 'Ritual'])

  await pills.getByRole('button', { name: '1st', exact: true }).click()
  await expect(panel(page).locator('.sheet__spell-section h3')).toHaveText(['1st Level'])
  await expect(shownNames(page)).toHaveText(['Bless', 'Cure Wounds', 'Guiding Bolt', 'Shield of Faith'])

  await pills.getByRole('button', { name: 'Concentration', exact: true }).click()
  await expect(shownNames(page)).toHaveText(['Guidance', 'Bless', 'Shield of Faith', 'Spiritual Weapon'])

  const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  await pills.getByRole('button', { name: 'All', exact: true }).click()
  await panel(page).getByRole('searchbox', { name: 'Search spells' }).fill('BOL')
  await expect(shownNames(page)).toHaveText(['Guiding Bolt'])
  await panel(page).getByRole('searchbox', { name: 'Search spells' }).fill('')
  await expect(shownNames(page)).toHaveCount(9)
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(stored)
})

test('R7a e: a cantrip reads AT WILL with no CAST, and a damage cantrip shows its dice in Effect', async ({ page }) => {
  await openSaved(page, CLERIC)
  const flame = row(page, 'Sacred Flame')
  await expect(flame.locator('.sheet__spell-use')).toHaveText('At will')
  await expect(flame.getByRole('button', { name: /^Cast / })).toHaveCount(0)
  await expect(flame.locator('.sheet__spell-effect').getByRole('button', { name: 'Roll Sacred Flame damage' })).toHaveText('1d8')
})

test('R7a f: SAVE DC is the computed DC (WIS +3, PB +2 → 13), and its value opens the breakdown drawer', async ({ page }) => {
  await openSaved(page, CLERIC)
  const saveDc = panel(page).getByRole('button', { name: 'Cleric save DC breakdown' })
  await expect(saveDc).toHaveText('13')
  await saveDc.click()
  const drawer = page.getByRole('dialog', { name: 'Save DC' })
  await expect(drawer).toContainText('Cleric (Wisdom)')
  await expect(drawer).toContainText(/proficiency bonus/i)
})

test('R7a g: an origin Magic Initiate level-1 spell shows its short usage label and no CAST', async ({ page }) => {
  const options: FighterOptions = { name: 'Initiate Fighter', level: 1, species: 'Dwarf|XPHB' }
  await fillUpToBackground(page, options)
  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await originFeat.getByRole('checkbox', { name: 'Sacred Flame', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guiding Bolt', exact: true }).first().check()
  await select(originFeat, 'Ability').selectOption('wisdom')
  await finishFromBackground(page, options)

  await page.getByRole('tab', { name: 'Spells' }).click()
  const bolt = row(page, 'Guiding Bolt')
  await expect(bolt.locator('.sheet__spell-use')).toHaveText('1/LR')
  await expect(bolt.getByRole('button', { name: /^Cast / })).toHaveCount(0)
  await expect(bolt.locator('.sheet__action-subtitle')).toContainText('Magic Initiate')
})
