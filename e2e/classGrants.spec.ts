import { expect, test, type Locator, type Page } from '@playwright/test'

/* D192 (A-S1): class-record additionalSpells. Saved characters are seeded into storage like spellsTab.spec.ts does. */
const STORAGE_KEY = 'familliar:characters'

const scores = (key: 'wisdom' | 'charisma' | 'intelligence') => ({
  method: 'standardArray',
  scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10, [key]: 16 },
})

function character(id: string, classes: { className: string; classSource?: string; level: number }[], ability: 'wisdom' | 'charisma' | 'intelligence', spellChoices: unknown[] = []) {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: classes.map((c) => ({ className: c.className, classSource: c.classSource ?? 'XPHB', subclass: null, level: c.level })),
    abilityScores: scores(ability),
    spellChoices,
  }
}

async function openSaved(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => panel(page).getByRole('region', { name: label, exact: true })
const row = (page: Page, name: string): Locator =>
  panel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const usedBoxes = (scope: Locator): Locator => scope.locator('.sheet__spell-section-heading .sheet__use-box--used')

test('A-S1 a: Ranger 1 — Hunter\'s Mark is there, labelled "always prepared (Ranger)"; CAST spends a level-1 slot', async ({ page }) => {
  await openSaved(page, character('as1-ranger', [{ className: 'Ranger', level: 1 }], 'wisdom'))
  const mark = row(page, "Hunter's Mark")
  await expect(mark).toHaveCount(1)
  await mark.getByRole('button', { name: "Hunter's Mark", exact: true }).click()
  await expect(mark.locator('.sheet__spell-provenance')).toContainText('always prepared (Ranger)')

  const first = section(page, '1st Level')
  await first.getByRole('button', { name: "Cast Hunter's Mark" }).click()
  await expect(usedBoxes(first)).toHaveCount(1)
})

test('A-S1 b: Paladin 2 has Divine Smite and no Find Steed; Paladin 5 has both', async ({ page }) => {
  await openSaved(page, character('as1-paladin2', [{ className: 'Paladin', level: 2 }], 'charisma'))
  await expect(row(page, 'Divine Smite')).toHaveCount(1)
  await expect(row(page, 'Find Steed')).toHaveCount(0)
})

test('A-S1 b: Paladin 5 has Divine Smite and Find Steed', async ({ page }) => {
  await openSaved(page, character('as1-paladin5', [{ className: 'Paladin', level: 5 }], 'charisma'))
  await expect(row(page, 'Divine Smite')).toHaveCount(1)
  await expect(row(page, 'Find Steed')).toHaveCount(1)
})

test('A-S1 c: Druid 2 — Speak with Animals and Find Familiar, and the Familiar section', async ({ page }) => {
  await openSaved(page, character('as1-druid', [{ className: 'Druid', level: 2 }], 'wisdom'))
  await expect(row(page, 'Speak with Animals')).toHaveCount(1)
  await expect(row(page, 'Find Familiar')).toHaveCount(1)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('heading', { name: 'Familiar' })).toBeVisible()
})

test('A-S1 d: Artificer (EFA) 1 — Mending among the cantrips', async ({ page }) => {
  await openSaved(page, character('as1-artificer', [{ className: 'Artificer', classSource: 'EFA', level: 1 }], 'intelligence'))
  await expect(section(page, 'Cantrips').locator('.sheet__spell-name', { hasText: /^Mending$/ })).toHaveCount(1)
})

test('A-S1 e: Warlock 9 — Contact Other Plane stands in the pact (5th Level) section', async ({ page }) => {
  await openSaved(page, character('as1-warlock', [{ className: 'Warlock', level: 9 }], 'charisma'))
  const pact = section(page, '5th Level')
  await expect(pact.locator('.sheet__spell-pact-tag')).toHaveText('Pact')
  await expect(pact.locator('.sheet__spell-name', { hasText: /^Contact Other Plane$/ })).toHaveCount(1)
})

test('A-S1 f: a Ranger 1 who also prepared Hunter\'s Mark has one row and no over-limit warning; stored picks are untouched', async ({ page }) => {
  const picks = [{ className: 'Ranger', classSource: 'XPHB', spells: [{ name: "Hunter's Mark", source: 'XPHB' }, { name: 'Cure Wounds', source: 'XPHB' }] }]
  await openSaved(page, character('as1-ranger-count', [{ className: 'Ranger', level: 1 }], 'wisdom', picks))
  await expect(row(page, "Hunter's Mark")).toHaveCount(1)
  await expect(page.getByText(/allowed\./)).toHaveCount(0)
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].spellChoices, STORAGE_KEY)
  expect(stored).toEqual(picks)
})
