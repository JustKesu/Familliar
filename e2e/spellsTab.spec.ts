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

test('R7b-2 b: a Fighter (no slots) with origin Magic Initiate: its 1st-level spell has a USE row and no CAST row; a filled box returns the use', async ({ page }) => {
  const options: FighterOptions = { name: 'Initiate Fighter', level: 1, species: 'Dwarf|XPHB' }
  await fillUpToBackground(page, options)
  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await originFeat.getByRole('checkbox', { name: 'Sacred Flame', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Guiding Bolt', exact: true }).first().check()
  await select(originFeat, 'Ability').selectOption('wisdom')
  await finishFromBackground(page, options)

  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(panel(page).locator('.sheet__spell-row--cast')).toHaveCount(0)
  const bolt = kindRow(panel(page),'Guiding Bolt', 'use')
  await expect(bolt.locator('.sheet__spell-use')).toHaveText('Use')
  await expect(bolt.locator('.sheet__action-subtitle')).toContainText('Magic Initiate')
  await expect(counterBoxes(bolt)).toHaveCount(1)

  await bolt.getByRole('button', { name: 'Use Guiding Bolt', exact: true }).click()
  await expect(counterBoxes(bolt, true)).toHaveCount(1)
  await expect(bolt.getByRole('button', { name: 'Use Guiding Bolt', exact: true })).toBeDisabled()
  await bolt.getByRole('button', { name: 'Undo a use of Guiding Bolt free cast' }).click()
  await expect(counterBoxes(bolt, true)).toHaveCount(0)
  await expect(bolt.getByRole('button', { name: 'Use Guiding Bolt', exact: true })).toBeEnabled()
})

const kindRow = (scope: Locator, name: string, kind: 'cast' | 'use'): Locator =>
  scope.locator(`.sheet__spell-row--${kind}`, { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const counterBoxes = (scope: Locator, used = false): Locator => scope.locator(`.sheet__spell-notes .sheet__use-box${used ? '--used' : ''}`)

const TIEFLING_WARLOCK = {
  schemaVersion: 48,
  id: 'r7b2-tiefling',
  name: 'Infernal Warlock',
  classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: scores('charisma'),
  species: { name: 'Tiefling; Infernal Legacy', source: 'XPHB' },
  speciesSpellcastingAbility: 'charisma',
  spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: spells('Eldritch Blast', 'Hellish Rebuke') }],
}

test('R7b-2 a: Tiefling Warlock 3 — Hellish Rebuke CAST in the pact section, USE in 1st Level; USE fills its own box and disables; pact boxes untouched; Long Rest restores', async ({ page }) => {
  await openSaved(page, TIEFLING_WARLOCK)
  const pact = section(page, '2nd Level')
  const first = section(page, '1st Level')
  await expect(pact.locator('.sheet__spell-pact-tag')).toHaveText('Pact')
  await expect(kindRow(pact, 'Hellish Rebuke', 'cast')).toHaveCount(1)
  await expect(kindRow(first, 'Hellish Rebuke', 'use')).toHaveCount(1)
  await expect(kindRow(first, 'Hellish Rebuke', 'use').locator('.sheet__action-subtitle')).toContainText('Tiefling')

  const use = kindRow(first, 'Hellish Rebuke', 'use')
  await use.getByRole('button', { name: 'Use Hellish Rebuke', exact: true }).click()
  await expect(counterBoxes(use, true)).toHaveCount(1)
  await expect(use.getByRole('button', { name: 'Use Hellish Rebuke', exact: true })).toBeDisabled()
  await expect(usedBoxes(pact)).toHaveCount(0)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(counterBoxes(use, true)).toHaveCount(0)
  await expect(use.getByRole('button', { name: 'Use Hellish Rebuke', exact: true })).toBeEnabled()
})

const FOREST_GNOME = {
  schemaVersion: 48,
  id: 'r7b2-gnome',
  name: 'Forest Gnome',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: scores('wisdom'),
  species: { name: 'Gnome; Forest Gnome Lineage', source: 'XPHB' },
  speciesSpellcastingAbility: 'wisdom',
}

test('R7b-2 c: Forest Gnome — USE on Speak with Animals fills one box that is the same record as Gnomish Lineage in Features & Traits', async ({ page }) => {
  await openSaved(page, FOREST_GNOME)
  const use = kindRow(panel(page),'Speak with Animals', 'use')
  await use.getByRole('button', { name: 'Use Speak with Animals', exact: true }).click()
  await expect(counterBoxes(use, true)).toHaveCount(1)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const lineage = page
    .getByRole('tabpanel', { name: 'Features & Traits' })
    .locator('.sheet__group-row', { has: page.locator('.sheet__group-row-name', { hasText: /^Gnomish Lineage \(Forest Gnome\)$/ }) })
  await expect(lineage.locator('.sheet__use-box--used')).toHaveCount(1)
  await lineage.getByRole('button', { name: 'Undo a use of Gnomish Lineage (Forest Gnome)' }).click()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(counterBoxes(kindRow(panel(page),'Speak with Animals', 'use'), true)).toHaveCount(0)
})

const MONK = {
  schemaVersion: 48,
  id: 'r7b2-monk',
  name: 'Shadow Monk',
  classes: [{ className: 'Monk', classSource: 'XPHB', subclass: 'Warrior of Shadow', level: 3 }],
  abilityScores: scores('wisdom'),
}

test('R7b-2 d: Monk 3 Warrior of Shadow — USE on Darkness spends a Focus Point (shared with Features & Traits), disabled at none; it also starts concentration (g)', async ({ page }) => {
  await openSaved(page, MONK)
  const use = kindRow(panel(page),'Darkness', 'use')
  await expect(use.locator('.sheet__spell-notes')).toContainText('Focus Point 3 / 3')
  await use.getByRole('button', { name: 'Use Darkness', exact: true }).click()
  await expect(use.locator('.sheet__spell-notes')).toContainText('Focus Point 2 / 3')
  await expect(page.locator('.sheet__status-row .sheet__concentration')).toContainText('Darkness')

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const focus = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('group', { name: 'Focus Point uses' }).first()
  await expect(focus.locator('.sheet__use-box--used')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Spells' }).click()
  await kindRow(panel(page),'Darkness', 'use').getByRole('button', { name: 'Use Darkness', exact: true }).click()
  await kindRow(panel(page),'Darkness', 'use').getByRole('button', { name: 'Use Darkness', exact: true }).click()
  await expect(kindRow(panel(page),'Darkness', 'use').locator('.sheet__spell-notes')).toContainText('Focus Point 0 / 3')
  await expect(kindRow(panel(page),'Darkness', 'use').getByRole('button', { name: 'Use Darkness', exact: true })).toBeDisabled()
})

const CLERIC_FEY = {
  ...CLERIC,
  id: 'r7b2-cleric-fey',
  name: 'Fey Cleric',
  classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
  featAsiChoices: [
    { level: 4, kind: 'feat', name: 'Fey-Touched', source: 'XPHB', chosenAbility: 'wisdom', filterChoiceSpells: { cantrips: [], spells: spells('Command') } },
  ],
}

test('R7b-2 e: Cleric 5 with Fey-Touched — Misty Step has CAST and USE rows in 2nd Level; USE spends no slot, CAST spends no free use', async ({ page }) => {
  await openSaved(page, CLERIC_FEY)
  const second = section(page, '2nd Level')
  const cast = kindRow(second, 'Misty Step', 'cast')
  const use = kindRow(second, 'Misty Step', 'use')
  await expect(cast).toHaveCount(1)
  await expect(use).toHaveCount(1)
  await expect(use.locator('.sheet__action-subtitle')).toContainText('Fey-Touched')

  await use.getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await expect(counterBoxes(use, true)).toHaveCount(1)
  await expect(usedBoxes(second)).toHaveCount(0)

  await cast.getByRole('button', { name: 'Cast Misty Step' }).click()
  await expect(usedBoxes(second)).toHaveCount(1)
  await expect(counterBoxes(use, true)).toHaveCount(1)
})

const FEY_TELEPORTER = {
  schemaVersion: 48,
  id: 'r7b2-teleporter',
  name: 'Fey Teleporter',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
  abilityScores: scores('wisdom'),
  featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey Teleportation', source: 'XGE' }],
}

test('R7b-2 f: a 1/Short Rest free cast (Fey Teleportation, seeded — its High Elf prerequisite is not enforced on load) is restored by Finish Short Rest', async ({ page }) => {
  await openSaved(page, FEY_TELEPORTER)
  const use = kindRow(panel(page),'Misty Step', 'use')
  await expect(use.locator('.sheet__spell-notes')).toContainText('/ Short Rest')
  await use.getByRole('button', { name: 'Use Misty Step', exact: true }).click()
  await expect(counterBoxes(use, true)).toHaveCount(1)
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(counterBoxes(kindRow(panel(page),'Misty Step', 'use'), true)).toHaveCount(0)
})
