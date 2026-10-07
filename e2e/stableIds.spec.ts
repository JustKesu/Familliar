import { expect, test, type Locator, type Page } from '@playwright/test'

/* M1c (D319): concentration keeps its source, manual feats keep their key. Characters seeded at schema 58, as in sheetCalculations.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }

function seeded(id: string, className: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 58,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: 'XPHB' })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: [],
    ...extra,
  }
}

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

async function stored(page: Page): Promise<{ schemaVersion: number; play?: Record<string, unknown>; grantedFeats?: { origin: string; name: string; id?: string }[] }> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellName = (page: Page, name: string): Locator => page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const useRow = (page: Page, name: string): Locator => spellsPanel(page).locator('.sheet__spell-row--use', { has: spellName(page, name) })
const concentrationCard = (page: Page): Locator => page.locator('.sheet__status-row .sheet__concentration')
const initiate = (className: string, cantrips: string[], spell: string) => ({
  className,
  classSource: 'XPHB',
  cantrips: cantrips.map((name) => ({ name, source: 'XPHB' })),
  spell: { name: spell, source: 'XPHB' },
})

test('M1c a: removing the first of two manual Magic Initiates leaves the second one’s spent free cast spent', async ({ page }) => {
  await open(
    page,
    seeded('m1c-feats', 'Fighter', 4, {
      grantedFeats: [
        { origin: 'manual', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Wizard', ['Fire Bolt', 'Light'], 'Sleep') },
        { origin: 'manual', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'wisdom', magicInitiate: initiate('Cleric', ['Guidance', 'Sacred Flame'], 'Bless') },
      ],
    }),
  )
  await page.getByRole('tab', { name: 'Spells' }).click()
  await useRow(page, 'Bless').getByRole('button', { name: 'Use Bless', exact: true }).click()
  await expect(useRow(page, 'Bless').locator('.sheet__use-box--used')).toHaveCount(1)
  await expect(useRow(page, 'Sleep').locator('.sheet__use-box--used')).toHaveCount(0)
  const spentKeys = Object.keys(((await stored(page)).play?.resourceUses ?? {}) as Record<string, number>)
  expect(spentKeys).toEqual(['spell:feat:Magic Initiate#manual:1:bless|XPHB'])

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Feats' })
  await panel.getByRole('region', { name: 'My Feats' }).getByRole('button', { name: 'Remove Magic Initiate', exact: true }).first().click()
  await expect(panel.getByRole('region', { name: 'My Feats' }).getByRole('button', { name: 'Remove Magic Initiate', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(useRow(page, 'Sleep')).toHaveCount(0)
  await expect(useRow(page, 'Bless').locator('.sheet__use-box--used')).toHaveCount(1)
  await expect(useRow(page, 'Bless').getByRole('button', { name: 'Use Bless', exact: true })).toBeDisabled()
  const after = await stored(page)
  expect(after.grantedFeats?.map((entry) => entry.id)).toEqual(['1'])
  expect(after.play?.resourceUses).toEqual({ 'spell:feat:Magic Initiate#manual:1:bless|XPHB': 1 })
})

test('M1c b: concentration started on the Spells tab is stored with its source, survives a reload and ends on a Long Rest', async ({ page }) => {
  await open(page, seeded('m1c-conc', 'Cleric', 1, { currentHp: 5, spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }] }))
  await expect(concentrationCard(page)).not.toContainText('Bless')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await spellsPanel(page).locator('.sheet__group-row-toggle', { has: spellName(page, 'Bless') }).first().click()
  await spellsPanel(page).getByRole('button', { name: 'Concentrate on Bless', exact: true }).click()

  await expect(concentrationCard(page)).toContainText('Bless')
  await expect.poll(async () => (await stored(page)).play?.concentratingOn).toEqual({ name: 'Bless', source: 'XPHB' })
  expect((await stored(page)).schemaVersion).toBe(60)

  await page.reload()
  await expect(concentrationCard(page)).toContainText('Bless')

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(concentrationCard(page)).not.toContainText('Bless')
  await expect.poll(async () => (await stored(page)).play?.concentratingOn).toBeUndefined()
})

test('M1c c: a schema-58 character concentrating on "Bless" shows Bless in the header as before', async ({ page }) => {
  await open(
    page,
    seeded('m1c-old', 'Cleric', 1, {
      currentHp: 5,
      spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }],
      play: { concentratingOn: 'Bless' },
    }),
  )
  await expect(concentrationCard(page)).toContainText('Bless')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await spellsPanel(page).locator('.sheet__group-row-toggle', { has: spellName(page, 'Bless') }).first().click()
  await expect(spellsPanel(page).getByRole('button', { name: 'Concentrate on Bless', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
