import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, chooseLevelAsi, createFighter, expectStep, levelCard, next, wizardNav } from './wizard.ts'

/* M7a (D329): Level up of an existing class of a multiclass character. Seeded at schema 59, a state import can produce. */
const STORAGE_KEY = 'familliar:characters'
// CON 13 = +1, CHA 15 (+2 from the Warlock 4 ASI = 17).
const SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 }
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const WARLOCK_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Counterspell', 'Hunger of Hadar', 'Spider Climb']
const SORCERER_SPELLS = ['Fire Bolt', 'Light', 'Mage Hand', 'Ray of Frost', 'Burning Hands', 'Magic Missile', 'Shield', 'Chromatic Orb', 'Scorching Ray', 'Mirror Image']
const INVOCATIONS = ['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows', 'Repelling Blast', 'Mask of Many Faces']

function warlockSorcerer(id: string, withHistory = true) {
  return {
    schemaVersion: 59,
    id,
    name: id,
    classes: [
      { className: 'Warlock', classSource: XPHB, subclass: 'Fiend Patron', level: 6 },
      { className: 'Sorcerer', classSource: XPHB, subclass: 'Wild Magic Sorcery', level: 3 },
    ],
    ...(withHistory
      ? { levelOrder: [...Array.from({ length: 6 }, () => ({ className: 'Warlock', classSource: XPHB })), ...Array.from({ length: 3 }, () => ({ className: 'Sorcerer', classSource: XPHB }))] }
      : {}),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    spellChoices: [
      { className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS) },
      { className: 'Sorcerer', classSource: XPHB, spells: refs(SORCERER_SPELLS) },
    ],
    optionalFeatureChoices: [
      { featureType: 'EI', choices: refs(INVOCATIONS) },
      { featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) },
    ],
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
  }
}

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const levelUpButton = (page: Page): Locator => page.locator('.sheet__level-up')
const classWindow = (page: Page): Locator => page.getByRole('dialog', { name: 'Level up which class?' })
const classes = (page: Page): Locator => page.locator('.sheet__classes')
const score = (page: Page, ability: string): Locator => page.locator(`.ability-card[data-ability="${ability}"] .ability-card__score`)

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

/** Fills the Spells step's counters with the first offered spells. */
async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

/** M4: a level up shows only the new level's row, without "Use the average". */
async function averageHitPoints(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Level 10 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
}

async function chooseClass(page: Page, label: string): Promise<void> {
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: label, exact: true }).click()
}

test('M7a a: Warlock 6 / Sorcerer 3 — Level up opens the class window, Cancel closes it with no change', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-a'))
  await expect(levelUpButton(page)).toHaveText('Level up to 10')
  await levelUpButton(page).click()
  await expect(classWindow(page).locator('.level-up-class__option')).toHaveText(['Warlock 6 → 7', 'Sorcerer 3 → 4'])
  await expect(classWindow(page).getByRole('button', { name: 'Warlock 6 → 7' })).toBeFocused()
  await classWindow(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(classWindow(page)).toHaveCount(0)
  await expect(levelUpButton(page)).toBeFocused()
  await expect(page).toHaveURL(/#\/character\/m7a-a$/)
  await expect(classes(page)).toHaveText('Warlock 6 (Fiend Patron) / Sorcerer 3 (Wild Magic Sorcery)')
})

test('M7a b: choosing Sorcerer — Sorcerer 4, Warlock 6, level 10, the Sorcerer ASI applied, Warlock spells and invocations kept, max HP +d6 average +CON', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-b'))
  await expect(levelUpButton(page)).toHaveText('Level up to 10')
  // M4: d8 max 8 + 5 × 5 + 3 × 4 + CON 1 × 9.
  await expect.poll(() => maxHp(page)).toBe(54)
  const before = 54

  await chooseClass(page, 'Sorcerer 3 → 4')
  await expect(page).toHaveURL(/#\/character\/m7a-b\/level-up\/Sorcerer\/XPHB$/)
  await expectStep(page, 'Spells')
  await expect(page.getByRole('searchbox', { name: 'Search Sorcerer spells' })).toBeVisible()
  await fillSpells(page)
  await next(page)

  await expectStep(page, 'ASI / Feat')
  await expect(levelCard(page, 10)).toBeVisible()
  await chooseLevelAsi(page, 10, 'strength')
  await next(page)

  await expectStep(page, 'Hit points')
  await expect(page.getByRole('cell', { name: 'Level 10 · Sorcerer' })).toBeVisible()
  await averageHitPoints(page)
  await next(page)

  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Save level 10' }).click()
  await expect(page).toHaveURL(/#\/character\/m7a-b$/)

  await expect(classes(page)).toHaveText('Warlock 6 (Fiend Patron) / Sorcerer 4 (Wild Magic Sorcery)')
  await expect(page.locator('.sheet__identity')).toContainText('Level 10')
  await expect(score(page, 'strength')).toHaveText('10')
  // d6 average 4 + CON 1.
  await expect.poll(() => maxHp(page)).toBe(before + 5)

  await page.getByRole('tab', { name: 'Spells' }).click()
  const spells = page.getByRole('tabpanel', { name: 'Spells' })
  for (const name of ['Hex', 'Counterspell', 'Burning Hands']) await expect(spells.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const invocations = page.locator('.sheet__feature-options').filter({ hasText: 'Agonizing Blast' })
  for (const name of ['Pact of the Blade', 'Repelling Blast', 'Mask of Many Faces']) await expect(invocations).toContainText(name)
})

test('M7a c: choosing Warlock — Warlock 7, Sorcerer spells unchanged', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-c'))
  await chooseClass(page, 'Warlock 6 → 7')
  await expect(page).toHaveURL(/\/level-up\/Warlock\/XPHB$/)
  await expectStep(page, 'Spells')
  await expect(page.getByRole('searchbox', { name: 'Search Warlock spells' })).toBeVisible()
  await fillSpells(page)
  await next(page)

  await expectStep(page, 'Eldritch Invocations')
  const toggle = page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
  await expect(chooseButton(page, 'Agonizing Blast')).toHaveText('Chosen')
  await chooseButton(page, "Devil's Sight").click()
  await next(page)

  await expectStep(page, 'Hit points')
  await expect(page.getByRole('cell', { name: 'Level 10 · Warlock' })).toBeVisible()
  await averageHitPoints(page)
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Save level 10' }).click()
  await expect(page).toHaveURL(/#\/character\/m7a-c$/)

  await expect(classes(page)).toHaveText('Warlock 7 (Fiend Patron) / Sorcerer 3 (Wild Magic Sorcery)')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const sorcerer = page.getByRole('dialog', { name: 'Manage Spells' }).locator('summary', { hasText: /^Sorcerer$/ }).locator('..')
  const prepared = sorcerer.getByRole('region', { name: 'Prepared Spells' }).locator('.manage-spells__name')
  await expect(prepared).toHaveCount(SORCERER_SPELLS.length)
  for (const name of SORCERER_SPELLS) await expect(prepared.filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(1)
})

test('M7a d: F5 in the middle of the wizard keeps the chosen class', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-d'))
  await chooseClass(page, 'Sorcerer 3 → 4')
  await expectStep(page, 'Spells')
  await page.reload()
  await expect(page).toHaveURL(/\/level-up\/Sorcerer\/XPHB$/)
  await expectStep(page, 'Spells')
  await expect(page.getByRole('searchbox', { name: 'Search Sorcerer spells' })).toBeVisible()
})

test('M7a e: the same character without a level history — Level up disabled with the reason', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-e', false))
  await expect(levelUpButton(page)).toBeDisabled()
  await expect(levelUpButton(page)).toHaveText('Level up unavailable: Cannot tell which class each level came from (no level history).')
})

test('M7a f (D330): a single-class Fighter level up opens the class window too, and raising the held class keeps the plain route', async ({ page }) => {
  await createFighter(page, { name: 'Solo', level: 1, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 2' }).click()
  await classWindow(page).getByRole('button', { name: 'Fighter 1 → 2', exact: true }).click()
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/level-up$/)
})

test('M7a g: Edit stays blocked for a multiclass character with a level history; Remove level is available (M8, D332)', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m7a-g'))
  await expect(levelUpButton(page)).toBeEnabled()
  await expect(page.locator('.sheet__edit-character')).toBeDisabled()
  await expect(page.locator('.sheet__remove-level')).toBeEnabled()
})
