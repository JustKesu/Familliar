import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep, fillUpToBackground, finishFromBackground, next, select, type FighterOptions } from './wizard.ts'

/* F-30: layout guards from the screenshot review — no page wider than the viewport, no cut-off lines. */
const STORAGE_KEY = 'familliar:characters'
const PHONE = { width: 390, height: 844 }

async function expectNoPageOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

async function expectAbilityTableFits(page: Page): Promise<void> {
  const scroll = page.locator('.ability-table__scroll').first()
  await expect(scroll).toBeVisible()
  const { scrollWidth, clientWidth } = await scroll.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  const cha = scroll.getByRole('columnheader', { name: 'CHA', exact: true })
  await expect(cha).toBeInViewport({ ratio: 1 })
  const box = await cha.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width)
}

const LEVEL_1: FighterOptions = { name: 'Phone', level: 1, species: 'Dwarf|XPHB' }

test('F-30 a: the ASI / Feat step is no wider than a 1366 px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await createFighter(page, { name: 'Wide', level: 4, species: 'Dwarf|XPHB', stopAtAsi: true })
  await expectNoPageOverflow(page)
})

test('F-30 b: the Class step at 390 px has no horizontal page overflow', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await expectNoPageOverflow(page)
})

test('F-30 c: a Dwarf sheet wraps its save advantage lines inside the Saving Throws card', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const dwarf = {
    schemaVersion: 61,
    id: 'f30-dwarf',
    name: 'Dwarf',
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
    levelOrder: [{ className: 'Fighter', classSource: 'XPHB' }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Dwarf', source: 'XPHB' },
    background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    classSkills: ['athletics', 'perception'],
    fightingStyle: 'Defense',
    // d10 + CON +1 + Dwarven Toughness 1.
    currentHp: 12,
  }
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([dwarf]) },
  )
  await page.goto(`/#/character/${dwarf.id}`)
  const lines = page.locator('.sheet__saving-throws .sheet__save-advantages li')
  await expect(lines.first()).toBeVisible()
  const card = await page.locator('.sheet__saving-throws').boundingBox()
  for (const line of await lines.all()) {
    const { scrollWidth, clientWidth } = await line.evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
    const box = await line.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(card!.x + card!.width)
  }
})

test('F-30 d: the Ability scores step shows all six columns at 390 px', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await fillUpToBackground(page, LEVEL_1)
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  await expectAbilityTableFits(page)
})

test('F-30 e: the Review step shows all six ability columns at 390 px', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await fillUpToBackground(page, { ...LEVEL_1, stopAtReview: true })
  await finishFromBackground(page, { ...LEVEL_1, stopAtReview: true })
  await expectAbilityTableFits(page)
})
