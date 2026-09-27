import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * R8a (D206). Casters seeded into storage before the app loads, as in
 * spellsTab.spec.ts — wizard.ts builds Fighters only.
 */
const STORAGE_KEY = 'familliar:characters'

const scores = (key: 'wisdom' | 'charisma') => ({
  method: 'standardArray',
  scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10, [key]: 16 },
})
const spells = (...names: string[]) => names.map((name) => ({ name, source: 'XPHB' }))

const SORCERER = {
  schemaVersion: 50,
  id: 'r8a-sorcerer',
  name: 'Dice Sorcerer',
  classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 5 }],
  abilityScores: scores('charisma'),
  spellChoices: [{ className: 'Sorcerer', classSource: 'XPHB', spells: spells('Fire Bolt', 'Fireball') }],
}

const WARLOCK = {
  schemaVersion: 50,
  id: 'r8a-warlock',
  name: 'Dice Warlock',
  classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
  abilityScores: scores('charisma'),
  spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: spells('Eldritch Blast', 'Hellish Rebuke') }],
}

const CLERIC = {
  schemaVersion: 50,
  id: 'r8a-cleric',
  name: 'Dice Cleric',
  classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: scores('wisdom'),
  spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: spells('Guidance', 'Cure Wounds') }],
}

async function openSaved(page: Page, character: { id: string }, tab: 'Spells' | 'Actions'): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: tab }).click()
}

const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => spellsPanel(page).getByRole('region', { name: label, exact: true })
const castRow = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row--cast', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

test('R8a a: Sorcerer 5 — Fireball in 3rd Level shows a clickable 8d6 above "Fire"', async ({ page }) => {
  await openSaved(page, SORCERER, 'Spells')
  const effect = castRow(section(page, '3rd Level'), 'Fireball').locator('.sheet__spell-effect')
  const dice = effect.getByRole('button', { name: 'Roll Fireball damage' })
  await expect(dice).toHaveText('8d6')
  await expect(effect).toContainText('Fire')
  await dice.click()
  await expect(page.locator('.roll-toast')).toContainText('Fireball damage')
})

test('R8a b: Warlock 5 — Hellish Rebuke in the 3rd-level pact section with a "1st" badge shows 4d10', async ({ page }) => {
  await openSaved(page, WARLOCK, 'Spells')
  const rebuke = castRow(section(page, '3rd Level'), 'Hellish Rebuke')
  await expect(rebuke.locator('.sheet__spell-badge')).toHaveText('1st')
  await expect(rebuke.locator('.sheet__spell-effect').getByRole('button', { name: 'Roll Hellish Rebuke damage' })).toHaveText('4d10')
})

test('R8a c: Cleric 3 — Cure Wounds shows 2d8 and "Healing"', async ({ page }) => {
  await openSaved(page, CLERIC, 'Spells')
  const effect = castRow(section(page, '1st Level'), 'Cure Wounds').locator('.sheet__spell-effect')
  await expect(effect.getByRole('button', { name: 'Roll Cure Wounds damage' })).toHaveText('2d8')
  await expect(effect).toContainText('Healing')
})

test('R8a d: Sorcerer 5 Actions tab — Fireball at its own level, 8d6', async ({ page }) => {
  await openSaved(page, SORCERER, 'Actions')
  await expect(actionRow(page, 'Fireball').getByRole('button', { name: 'Roll Fireball damage' })).toHaveText('8d6')
})

test('R8a d2: Warlock 5 Actions tab — Hellish Rebuke at its own level, 2d10', async ({ page }) => {
  await openSaved(page, WARLOCK, 'Actions')
  await expect(actionRow(page, 'Hellish Rebuke').getByRole('button', { name: 'Roll Hellish Rebuke damage' })).toHaveText('2d10')
})
