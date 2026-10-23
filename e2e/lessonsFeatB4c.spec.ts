import { expect, test, type Locator, type Page } from '@playwright/test'

/* B-4c (D377). Seeded at schema 62. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const LESSONS = [{ featureType: 'EI', choices: [{ name: 'Lessons of the First Ones', source: XPHB, level: 2 }] }]
const PENDING_LINE = 'Choices not made yet: feat — make them in Manage Feats.'

function warlock(id: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 62,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 2 }],
    levelOrder: [
      { className: 'Warlock', classSource: XPHB },
      { className: 'Warlock', classSource: XPHB },
    ],
    createdAtLevel: 2,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys'].map((name) => ({ name, source: XPHB })) }],
    ...extra,
  }
}

async function open(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
}

async function openFeats(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' }).getByRole('region', { name: 'My Feats' })
}

const featRow = (mine: Locator, name: string): Locator =>
  mine.locator('.manage-spells__row').filter({ has: mine.page().locator('.manage-spells__name').getByText(name, { exact: true }) })
const featsGroup = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
// The Acolyte's Magic Initiate has pending choices of its own.
const pendingLine = (page: Page): Locator => featsGroup(page).locator('.sheet__feat-pending', { hasText: PENDING_LINE })

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function skillStatus(page: Page, skillLabel: string): Promise<string | null> {
  return page.locator('.sheet__skills .sheet__row', { hasText: skillLabel }).locator('.sheet__prof-mark').getAttribute('data-status')
}

async function chooseLessonsFeat(row: Locator, name: string): Promise<void> {
  await row.getByRole('combobox', { name: 'Lessons of the First Ones feat' }).selectOption({ label: name })
}

test('B-4c a: a pending Lessons feat shows in Features & Traits and as an open row; Tough adds 2 HP per level', async ({ page }) => {
  await open(page, warlock('b4c-a', { optionalFeatureChoices: LESSONS }))
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(pendingLine(page)).toHaveCount(1)

  const mine = await openFeats(page)
  const pending = featRow(mine, 'Origin feat')
  await expect(pending).toContainText('From Lessons of the First Ones')
  await expect(pending.getByRole('button', { name: 'Origin feat text' })).toHaveAttribute('aria-expanded', 'true')
  await chooseLessonsFeat(pending, 'Tough')

  await expect(featRow(mine, 'Origin feat')).toHaveCount(0)
  await expect(featRow(mine, 'Tough')).toContainText('From Lessons of the First Ones')
  await expect(mine.getByRole('button', { name: 'Remove Tough' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect.poll(() => maxHp(page)).toBe(before + 4)
  await expect(pendingLine(page)).toHaveCount(0)
})

test('B-4c b: Skilled from Lessons — three skill selects; the picks become proficient', async ({ page }) => {
  await open(page, warlock('b4c-b', { optionalFeatureChoices: LESSONS }))
  const mine = await openFeats(page)
  await chooseLessonsFeat(featRow(mine, 'Origin feat'), 'Skilled')
  const skilled = featRow(mine, 'Skilled')
  await expect(skilled).toContainText('From Lessons of the First Ones')
  for (const [slot, skill] of [
    ['1', 'athletics'],
    ['2', 'history'],
    ['3', 'nature'],
  ] as const) {
    await skilled.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }
  for (const skill of ['Athletics', 'History', 'Nature']) await expect.poll(() => skillStatus(page, skill)).toBe('proficient')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].grantedFeats, STORAGE_KEY)
  expect(stored).toEqual([{ origin: 'invocation', id: expect.any(String), name: 'Skilled', source: XPHB, proficiencies: { skills: ['athletics', 'history', 'nature'] } }])
})

async function grantLessonsByItem(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Inventory' })
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Elder Tome')
  await panel.getByRole('button', { name: '+ Add invocation' }).click()
  const select = panel.getByRole('combobox', { name: 'Custom item invocation 1' })
  const option = select.locator('option', { hasText: /^Lessons of the First Ones( \(|$)/ }).first()
  await expect(option).toBeAttached()
  await select.selectOption((await option.getAttribute('value')) ?? '')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')
}

test('B-4c c: a stored Lessons feat without the invocation sleeps (no row, no Tough HP); an item granting Lessons wakes it', async ({ page }) => {
  await open(page, warlock('b4c-c', { grantedFeats: [{ origin: 'invocation', id: 'lot1', name: 'Tough', source: XPHB }] }))
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)
  const mine = await openFeats(page)
  await expect(featRow(mine, 'Tough')).toHaveCount(0)
  await expect(featRow(mine, 'Origin feat')).toHaveCount(0)
  await page.keyboard.press('Escape')

  await grantLessonsByItem(page)
  await expect.poll(() => maxHp(page)).toBe(before + 4)
  await expect(featRow(await openFeats(page), 'Tough')).toContainText('From Lessons of the First Ones')
})

test('B-4c c2: a sleeping Skilled comes back with its stored skills when an item grants Lessons', async ({ page }) => {
  const skilled = { origin: 'invocation', id: 'lot1', name: 'Skilled', source: XPHB, proficiencies: { skills: ['athletics', 'history', 'nature'] } }
  await open(page, warlock('b4c-c2', { grantedFeats: [skilled] }))
  await expect.poll(() => skillStatus(page, 'Athletics')).not.toBe('proficient')

  await grantLessonsByItem(page)
  for (const skill of ['Athletics', 'History', 'Nature']) await expect.poll(() => skillStatus(page, skill)).toBe('proficient')
  const row = featRow(await openFeats(page), 'Skilled')
  await expect(row).toContainText('From Lessons of the First Ones')
  await row.getByRole('button', { name: 'Skilled text' }).click()
  await expect(row.getByLabel('Skilled skill or tool 1', { exact: true })).toHaveValue('skill:athletics')
})

test('B-4c d: clearing the Lessons feat makes the slot pending again', async ({ page }) => {
  await open(page, warlock('b4c-d', { optionalFeatureChoices: LESSONS, grantedFeats: [{ origin: 'invocation', id: 'lot1', name: 'Tough', source: XPHB }] }))
  const mine = await openFeats(page)
  await featRow(mine, 'Tough').getByRole('button', { name: 'Clear Tough' }).click()
  await expect(featRow(mine, 'Tough')).toHaveCount(0)
  await expect(featRow(mine, 'Origin feat').getByRole('combobox', { name: 'Lessons of the First Ones feat' })).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(pendingLine(page)).toHaveCount(1)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].grantedFeats, STORAGE_KEY)).toBeUndefined()
})
