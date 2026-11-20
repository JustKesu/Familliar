import { expect, test, type Locator, type Page } from '@playwright/test'

/* LH-2 (D427): a pool over 10 spends and returns a typed amount. Seeds at schema 61, copied from layOnHands and poolGrantorTracker. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const NAME = 'Lay on Hands'

function seeded(id: string, classes: [string, string | null, number][]) {
  const total = classes.reduce((sum, [, , level]) => sum + level, 0)
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['athletics', 'perception'],
    hitPointLevels: Array.from({ length: total - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
  }
}

function sorcerer(id: string, level: number) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className: 'Sorcerer', classSource: XPHB, subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Sorcerer', classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  }
}

async function openActions(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Actions' }).click()
}

const big = (id: string) => seeded(id, [['Paladin', 'Oath of Devotion', 7], ['Warlock', 'Fiend Patron', 5]])
const counter = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: `${NAME} uses`, exact: true }).first()
const amount = (page: Page): Locator => counter(page).getByRole('spinbutton', { name: `${NAME} amount` })
const plus = (page: Page): Locator => counter(page).getByRole('button', { name: `Use ${NAME}` })
const minus = (page: Page): Locator => counter(page).getByRole('button', { name: `Undo a use of ${NAME}` })

test('LH-2 a: amount 5 spends and returns 5 at a time', async ({ page }) => {
  await openActions(page, big('lh2-a'))
  await expect(amount(page)).toHaveValue('1')
  await amount(page).fill('5')
  await plus(page).click()
  await expect(counter(page)).toContainText('5 / 35')
  await plus(page).click()
  await expect(counter(page)).toContainText('10 / 35')
  await expect(amount(page)).toHaveValue('5')
  await minus(page).click()
  await expect(counter(page)).toContainText('5 / 35')
})

test('LH-2 b: an empty field spends 1', async ({ page }) => {
  await openActions(page, big('lh2-b'))
  await amount(page).fill('')
  await plus(page).click()
  await expect(counter(page)).toContainText('1 / 35')
})

test('LH-2 c: spending past the pool stops at the maximum and disables +', async ({ page }) => {
  await openActions(page, big('lh2-c'))
  await amount(page).fill('33')
  await plus(page).click()
  await expect(counter(page)).toContainText('33 / 35')
  await amount(page).fill('5')
  await plus(page).click()
  await expect(counter(page)).toContainText('35 / 35')
  await expect(plus(page)).toBeDisabled()
})

test('LH-2 d: a reload keeps the spent value and resets the field to 1', async ({ page }) => {
  await openActions(page, big('lh2-d'))
  await amount(page).fill('7')
  await plus(page).click()
  await expect(counter(page)).toContainText('7 / 35')
  await page.reload()
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(counter(page)).toContainText('7 / 35')
  await expect(amount(page)).toHaveValue('1')
})

test('LH-2 e: a Long Rest resets the pool to 0 / 35', async ({ page }) => {
  await openActions(page, big('lh2-e'))
  await amount(page).fill('12')
  await plus(page).click()
  await expect(counter(page)).toContainText('12 / 35')
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(counter(page)).toContainText('0 / 35')
})

test('LH-2 f: Paladin 1 keeps 5 boxes and has no amount field', async ({ page }) => {
  await openActions(page, seeded('lh2-f', [['Paladin', null, 1]]))
  await expect(counter(page).getByRole('button')).toHaveCount(5)
  await expect(counter(page).getByRole('spinbutton')).toHaveCount(0)
})

test('LH-2 g: Sorcerer 12 spends a typed amount of its 12 Sorcery Points on Font of Magic', async ({ page }) => {
  await openActions(page, sorcerer('lh2-g', 12))
  const row = page
    .getByRole('tabpanel', { name: 'Actions' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: 'Font of Magic', exact: true }) })
  const pool = row.getByRole('group', { name: 'Sorcery Point uses', exact: true })
  await expect(pool).toContainText('0 / 12')
  await pool.getByRole('spinbutton', { name: 'Sorcery Point amount' }).fill('4')
  await pool.getByRole('button', { name: 'Use Sorcery Point' }).click()
  await expect(pool).toContainText('4 / 12')
  await pool.getByRole('button', { name: 'Undo a use of Sorcery Point' }).click()
  await expect(pool).toContainText('0 / 12')
})
