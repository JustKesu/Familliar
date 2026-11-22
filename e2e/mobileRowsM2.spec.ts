import { expect, test, type Locator, type Page } from '@playwright/test'

/* M-2 (D429): actions, spells and extras rows are two-line blocks at phone width. Seed after chainMasterC1.spec.ts (schema 63). */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const warlock = {
  schemaVersion: 63,
  id: 'm2-warlock',
  name: 'Row Warlock',
  classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 6 }],
  levelOrder: Array.from({ length: 6 }, () => ({ className: 'Warlock', classSource: XPHB })),
  createdAtLevel: 6,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
  species: { name: 'Tiefling; Infernal Legacy', source: XPHB },
  speciesSpellcastingAbility: 'charisma',
  speciesSize: 'M',
  background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  classSkills: ['arcana', 'deception'],
  spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Hold Person']) }],
  optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain', source: XPHB, level: 1 }] }],
  familiar: { name: 'Pseudodragon', source: 'XMM' },
  inventory: [{ name: 'Longsword', source: XPHB, quantity: 1, equipped: 'held' }],
}

async function openSheet(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([warlock]) },
  )
  await page.goto(`/#/character/${warlock.id}`)
}

const nav = (page: Page) => page.getByRole('tablist', { name: 'Sheet views' })
const spellsPanel = (page: Page) => page.locator('#sheet-panel-spells')
const actionsPanel = (page: Page) => page.locator('#sheet-panel-actions')
const spellRow = (page: Page, name: string, kind: string): Locator =>
  spellsPanel(page).locator(`.sheet__spell-row--${kind}`, { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })

async function expectNothingClipped(containers: Locator, buttons: Locator): Promise<void> {
  expect(await containers.count()).toBeGreaterThan(0)
  for (const box of await containers.all()) {
    const { scroll, client } = await box.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }))
    expect(scroll).toBeLessThanOrEqual(client + 1)
  }
  expect(await buttons.count()).toBeGreaterThan(0)
  for (const button of await buttons.all()) {
    const rect = await button.boundingBox()
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(390)
  }
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('M-2 a: actions, spells and extras rows fit 390 px with every hit/DC and damage box on screen', async ({ page }) => {
    await openSheet(page)
    await nav(page).getByRole('tab', { name: 'Actions' }).click()
    await expect(actionsPanel(page).locator('.sheet__actions-table')).toContainText('Longsword')
    await expect(actionsPanel(page).locator('.sheet__actions-table')).toContainText('Eldritch Blast')
    await expectNothingClipped(
      actionsPanel(page).locator('.sheet__actions-table, .sheet__actions-table tr, .sheet__action-group'),
      actionsPanel(page).locator('.sheet__actions-table :is(.roll-value, .sheet__action-dc, .sheet__action-flat)'),
    )

    await nav(page).getByRole('tab', { name: 'Spells' }).click()
    await expect(spellRow(page, 'Hellish Rebuke', 'use')).toHaveCount(1)
    await expect(spellRow(page, 'Eldritch Blast', 'label')).toHaveCount(1)
    await expect(spellsPanel(page)).toContainText('Find Familiar')
    await expectNothingClipped(
      spellsPanel(page).locator('.sheet__spell-table, .sheet__spell-row'),
      spellsPanel(page).locator('.sheet__spell-row :is(.roll-value, .sheet__action-dc, .sheet__spell-cast)'),
    )

    await nav(page).getByRole('tab', { name: 'More' }).click()
    await page.getByRole('group', { name: 'More sections' }).getByRole('button', { name: 'Extras' }).click()
    const extras = page.locator('#sheet-panel-extras')
    await expect(extras.locator('.extras-tab__item').first()).toContainText('Pseudodragon')
    await expectNothingClipped(extras.locator('.extras-tab__table, .extras-tab__row:visible'), extras.locator('.extras-tab__row:visible .extras-tab__cell'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })

  test('M-2 b: hit and damage buttons still roll on a phone', async ({ page }) => {
    await openSheet(page)
    await nav(page).getByRole('tab', { name: 'Actions' }).click()
    const table = actionsPanel(page).locator('.sheet__actions-table')
    await table.getByRole('button', { name: 'Roll Longsword to hit' }).click()
    await expect(page.locator('.roll-toast')).toContainText('Longsword to hit')
    await table.getByRole('button', { name: 'Roll Longsword damage' }).click()
    await expect(page.locator('.roll-toast')).toContainText('Longsword damage')
  })

  test('M-2 c: CAST on a leveled spell spends a pact slot', async ({ page }) => {
    await openSheet(page)
    await nav(page).getByRole('tab', { name: 'Spells' }).click()
    const used = spellsPanel(page).locator('.sheet__spell-section-heading .sheet__use-box--used')
    await expect(used).toHaveCount(0)
    await spellRow(page, 'Hex', 'cast').getByRole('button', { name: 'Cast Hex' }).click()
    await expect(used).toHaveCount(1)
  })

  test('M-2 d: notes show only once a spell row is open', async ({ page }) => {
    await openSheet(page)
    await nav(page).getByRole('tab', { name: 'Spells' }).click()
    const hex = spellRow(page, 'Hex', 'cast')
    await expect(hex).not.toContainText('V, S, M')
    await hex.getByRole('button', { name: /Hex/, expanded: false }).click()
    await expect(hex.locator('.sheet__spell-row-notes')).toContainText('V, S, M')
  })

  test('M-2 e: the AC card reads "AC" on a phone, its breakdown name unchanged', async ({ page }) => {
    await openSheet(page)
    const label = page.locator('.sheet__mobile-header .sheet__armour-class .sheet__card-label')
    await expect(label).toHaveText('AC')
    await expect(label).toHaveAttribute('aria-label', 'Armour Class breakdown')
  })
})

test('M-2 e/f: at 1366 px the AC card reads "Armour Class" and the actions and spell tables keep their desktop columns', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await openSheet(page)
  await expect(page.locator('.sheet__armour-class .sheet__card-label')).toHaveText('Armour Class')
  const tabs = page.getByRole('tablist', { name: 'Sekce listu postavy' })

  await tabs.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionsPanel(page).locator('.sheet__actions-table thead th')).toHaveText(['Attack', 'Range', 'Hit / DC', 'Damage', 'Notes'])
  await expect(actionsPanel(page).locator('.sheet__actions-table thead th').first()).toBeVisible()
  await expect(actionsPanel(page).locator('.sheet__actions-table tbody tr').first()).toHaveCSS('display', 'grid')

  await tabs.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellsPanel(page).locator('.sheet__spell-table-head span')).toHaveText(['', 'Name', 'Time', 'Range', 'Hit / DC', 'Effect', 'Notes'])
  await expect(spellsPanel(page).locator('.sheet__spell-table-head')).toBeVisible()
  await expect(spellRow(page, 'Hex', 'cast')).toHaveCSS('display', 'grid')
  await expect(spellRow(page, 'Hex', 'cast').locator('.sheet__spell-notes')).toContainText('V, S, M')
})
