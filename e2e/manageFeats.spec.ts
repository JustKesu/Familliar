import { expect, test, type Locator, type Page } from '@playwright/test'

/* R13a (D215). Characters seeded at schema 52 before the app loads, as in manageExtras.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }
const ACOLYTE = { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function fighter(id: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 52,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }],
    abilityScores: ABILITIES,
    ...extra,
  }
}

const withFeatAt4 = (id: string) => fighter(id, 4, { background: ACOLYTE, fightingStyle: 'Archery', featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }] })

async function seed(page: Page, subjects: { id: string }[]): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(subjects) },
  )
}

async function openManage(page: Page, id: string): Promise<Locator> {
  await page.goto(`/#/character/${id}`)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' })
}

const mine = (panel: Locator): Locator => panel.getByRole('region', { name: 'My Feats' })
const add = (panel: Locator): Locator => panel.getByRole('region', { name: 'Add Feats' })
const unavailable = (panel: Locator): Locator => panel.getByRole('region', { name: 'Unavailable' })
const row = (section: Locator, name: string): Locator =>
  section.locator('.manage-spells__row').filter({ has: section.page().locator('.manage-spells__name').getByText(name, { exact: true }) })
const search = (panel: Locator, text: string): Promise<void> => add(panel).getByRole('searchbox', { name: 'Search feats' }).fill(text)

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

test('R13a a: level, background and Fighting Style feats are locked; an ASI level shows as Ability Score Improvement', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-a1'), fighter('r13a-a2', 4, { featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })])
  await page.goto('/#/character/r13a-a1')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  for (const pill of ['Class Features', 'Species Traits', 'Feats', 'All']) {
    await features.getByRole('button', { name: pill, exact: true }).click()
    await expect(features.getByRole('button', { name: 'Manage Feats', exact: true })).toBeVisible()
  }

  const panel = await openManage(page, 'r13a-a1')
  await expect(row(mine(panel), 'Magic Initiate; Cleric')).toContainText('From Background')
  await expect(row(mine(panel), 'Alert')).toContainText('From level 4')
  await expect(row(mine(panel), 'Archery')).toContainText('From Fighter')
  await expect(mine(panel).getByRole('button', { name: /^Remove / })).toHaveCount(0)

  const asiPanel = await openManage(page, 'r13a-a2')
  const asi = row(mine(asiPanel), 'Ability Score Improvement')
  await expect(asi).toContainText('From level 4')
  await asi.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  await expect(asi).toContainText('Strength +2')
  await expect(mine(asiPanel).getByRole('button', { name: /^Remove / })).toHaveCount(0)
})

test('R13a b, c, g: ADD Tough raises max HP by 2 × level, shows "Added manually", survives a reload; REMOVE restores it', async ({ page }) => {
  const level = 4
  await seed(page, [withFeatAt4('r13a-b')])
  await page.goto('/#/character/r13a-b')
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)

  const panel = await openManage(page, 'r13a-b')
  await search(panel, 'Tough')
  await add(panel).getByRole('button', { name: 'Add Tough', exact: true }).click()
  await expect(row(mine(panel), 'Tough').getByRole('button', { name: 'Remove Tough', exact: true })).toBeVisible()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toHaveCount(0)
  await expect.poll(() => maxHp(page)).toBe(before + 2 * level)

  const feats = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('li').filter({ hasText: 'Tough' }).first()).toContainText('Added manually')

  await page.reload()
  await expect.poll(() => maxHp(page)).toBe(before + 2 * level)
  const reloaded = await openManage(page, 'r13a-b')
  await row(mine(reloaded), 'Tough').getByRole('button', { name: 'Remove Tough', exact: true }).click()
  await expect(row(mine(reloaded), 'Tough')).toHaveCount(0)
  await expect.poll(() => maxHp(page)).toBe(before)
})

test('R13a d: a held non-repeatable feat is not offered', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-d')])
  const panel = await openManage(page, 'r13a-d')
  await search(panel, 'Alert')
  await expect(add(panel).getByRole('button', { name: 'Add Alert', exact: true })).toHaveCount(0)
  await expect(add(panel)).toContainText('No feats match.')
})

test('R13a e: at level 1 a General feat is listed under Unavailable with its reason and no ADD', async ({ page }) => {
  await seed(page, [fighter('r13a-e', 1)])
  const panel = await openManage(page, 'r13a-e')
  await expect(add(panel).getByRole('button', { name: 'Add Actor', exact: true })).toHaveCount(0)
  await expect(unavailable(panel)).toBeHidden()
  await panel.getByText('Unavailable — prerequisites not met').click()
  const actor = row(unavailable(panel), 'Actor')
  await expect(actor).toContainText('General')
  await expect(actor).toContainText('Requires character level 4')
  await expect(actor.getByRole('button', { name: /^Add / })).toHaveCount(0)
})

test('R13a f: a category pill filters Add Feats', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-f')])
  const panel = await openManage(page, 'r13a-f')
  const pills = add(panel).getByRole('group', { name: 'Filter by category' })
  await pills.getByRole('button', { name: 'Fighting Style', exact: true }).click()
  await expect(add(panel).getByRole('button', { name: 'Add Defense', exact: true })).toBeVisible()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toHaveCount(0)
  for (const meta of await add(panel).locator('.manage-spells__meta').allInnerTexts()) expect(meta).toBe('Fighting Style')
  await pills.getByRole('button', { name: 'All', exact: true }).click()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toBeVisible()
})

test('R13a h: a character seeded at schema 52 loads with its feats unchanged', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-h')])
  const panel = await openManage(page, 'r13a-h')
  await expect(row(mine(panel), 'Alert')).toContainText('From level 4')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
  expect(stored.featAsiChoices).toEqual([{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }])
  expect(stored.background).toEqual(ACOLYTE)
  expect(stored.grantedFeats).toBeUndefined()
})
