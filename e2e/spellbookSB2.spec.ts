import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, chooseLevelAsi, expectStep, next, nextButton, select, stepBar, takeStartingEquipment, wizardNav } from './wizard.ts'

/* SB-2 (D423): the Wizard's book in the creation wizard, level up, Edit and Remove level. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
type Origin = { kind: 'level'; level: number } | { kind: 'copied' } | { kind: 'migrated' }
const entries = (names: string[], origin: Origin) => names.map((name) => ({ name, source: XPHB, origin }))

function wizard(id: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 71,
    id,
    name: id,
    classes: [{ className: 'Wizard', classSource: XPHB, subclass: 'Bladesinger', level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Wizard', classSource: XPHB })),
    createdAtLevel: 1,
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 4 })),
    classSkills: ['arcana', 'history'],
    expertiseSkills: [{ name: 'arcana' }],
    subclassSkills: [{ grantedBy: 'bladesinger', name: 'acrobatics' }],
    ...extra,
  }
}

const WIZARD_3_BOOK_L1 = ['Shield', 'Magic Missile', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands']
const wizard3 = wizard('sb2-c', 3, {
  spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Shield', 'Magic Missile', 'Sleep', 'Detect Magic', 'Mage Armor', 'Misty Step']) }],
  spellbooks: [
    {
      className: 'Wizard',
      classSource: XPHB,
      spells: [
        ...entries(WIZARD_3_BOOK_L1, { kind: 'level', level: 1 }),
        ...entries(['Thunderwave', 'Feather Fall'], { kind: 'level', level: 2 }),
        ...entries(['Misty Step', 'Web'], { kind: 'level', level: 3 }),
        ...entries(['Identify'], { kind: 'copied' }),
      ],
    },
  ],
})

const WIZARD_5_PREPARED = ['Shield', 'Magic Missile', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands', 'Misty Step', 'Web', 'Fireball']
const wizard5 = wizard('sb2-e', 5, {
  featAsiChoices: [{ level: 4, kind: 'asi', increases: { intelligence: 2 } }],
  spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Prestidigitation', ...WIZARD_5_PREPARED]) }],
  spellbooks: [{ className: 'Wizard', classSource: XPHB, spells: entries(WIZARD_5_PREPARED, { kind: 'migrated' }) }],
})

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

type StoredBook = { className: string; spells: { name: string; origin: Origin }[] }[]
const bookOf = (saved: Record<string, unknown>) => (saved['spellbooks'] as StoredBook | undefined)?.[0]?.spells ?? []
const preparedOf = (saved: Record<string, unknown>) => (saved['spellChoices'] as { spells: { name: string }[] }[])[0]!.spells.map((spell) => spell.name)

const addSpells = (page: Page): Locator => page.getByRole('region', { name: 'Add Spells', exact: true })
const book = (page: Page): Locator => page.getByRole('region', { name: 'Spellbook', exact: true })
const counters = (page: Page): Locator => page.locator('.manage-spells__counter')
const addToBook = (page: Page, name: string): Locator => addSpells(page).getByRole('button', { name: `Add ${name} to spellbook`, exact: true })

/** A new character through the creation wizard up to the Spells step. */
async function toSpellsStep(page: Page, className: 'Wizard' | 'Cleric'): Promise<void> {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill(`SB-2 ${className}`)
  await select(page, 'Class').selectOption(`${className}|XPHB`)
  await select(page, 'Level').selectOption('1')
  if (className === 'Wizard') {
    await page.getByRole('checkbox', { name: 'Arcana', exact: true }).check()
    await page.getByRole('checkbox', { name: 'History', exact: true }).check()
  } else {
    await page.getByRole('checkbox', { name: 'History', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Insight', exact: true }).check()
    await chooseButton(page, 'Protector').click()
  }
  await next(page)
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption(className === 'Wizard' ? 'intelligence' : 'wisdom')
  await select(page, '+1').selectOption(className === 'Wizard' ? 'wisdom' : 'intelligence')
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '8'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '15'], ['Wisdom', '12'], ['Charisma', '10']]) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)
  await expectStep(page, 'Spells')
}

async function saveNew(page: Page): Promise<void> {
  await next(page)
  await expectStep(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

test('SB-2 a: a new Wizard 1 writes exactly 6 spells, Next waits for the book and the prepared count, the book saves with origin level 1', async ({ page }) => {
  await toSpellsStep(page, 'Wizard')
  await expect(counters(page)).toHaveText(['Cantrips: 0/3', 'Prepared: 0/4', 'Spellbook: 0/6'])
  for (const name of ['Fire Bolt', 'Light', 'Mage Hand']) await addSpells(page).getByRole('button', { name: `Add ${name}`, exact: true }).click()
  for (const name of WIZARD_3_BOOK_L1.slice(0, 5)) await addToBook(page, name).click()
  await expect(nextButton(page)).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Write exactly 6 spells in the spellbook (5 now).' })).toBeVisible()
  await addToBook(page, 'Burning Hands').click()
  await expect(counters(page).nth(2)).toHaveText('Spellbook: 6/6')
  await expect(addToBook(page, 'Thunderwave')).toBeDisabled()
  // Removing one of this run's spells frees the slot again.
  await book(page).getByRole('button', { name: 'Remove Burning Hands from spellbook', exact: true }).click()
  await expect(counters(page).nth(2)).toHaveText('Spellbook: 5/6')
  await addToBook(page, 'Burning Hands').click()

  for (const name of WIZARD_3_BOOK_L1.slice(0, 3)) await book(page).getByRole('button', { name: `Prepare ${name}`, exact: true }).click()
  await expect(nextButton(page)).toBeDisabled()
  await book(page).getByRole('button', { name: 'Prepare Detect Magic', exact: true }).click()
  await expect(counters(page)).toHaveText(['Cantrips: 3/3', 'Prepared: 4/4', 'Spellbook: 6/6'])
  await expect(nextButton(page)).toBeEnabled()
  await saveNew(page)

  const saved = await stored(page)
  expect(bookOf(saved).map((spell) => spell.name)).toEqual(WIZARD_3_BOOK_L1)
  expect(bookOf(saved).every((spell) => spell.origin.kind === 'level' && spell.origin.level === 1)).toBe(true)
})

test('SB-2 b: in the creation wizard a spell outside the book cannot be prepared', async ({ page }) => {
  await toSpellsStep(page, 'Wizard')
  await expect(addToBook(page, 'Shield')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prepare Shield', exact: true })).toHaveCount(0)
  await addToBook(page, 'Shield').click()
  await expect(addSpells(page).getByRole('button', { name: 'Prepare Shield', exact: true })).toBeEnabled()
  await expect(addSpells(page).getByRole('button', { name: 'Prepare Sleep', exact: true })).toHaveCount(0)
})

test('SB-2 c+d: Wizard 3 → 4 writes exactly 2 spells with origin level 4; Remove level 4 takes them out and unprepares them, the copied one stays', async ({ page }) => {
  await openSheet(page, wizard3)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Wizard 3 → 4', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)

  for (let i = 0; i < 10; i++) {
    const step = (await page.locator('[aria-current="step"]').textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/ASI \/ Feat/.test(step)) await chooseLevelAsi(page, 4, 'intelligence')
    if (/Spells/.test(step)) {
      await expect(counters(page).nth(2)).toHaveText('Spellbook: 0/2')
      // Held entries stay: none of them offers Remove in this run.
      await expect(book(page).getByRole('button', { name: /^Remove .* from spellbook$/ })).toHaveCount(0)
      await expect(addToBook(page, 'Fireball')).toHaveCount(0)
      await addToBook(page, 'Hold Person').click()
      await expect(nextButton(page)).toBeDisabled()
      await addToBook(page, 'Invisibility').click()
      await expect(addToBook(page, 'Darkness')).toBeDisabled()
      await expect(book(page).getByRole('button', { name: /^Remove .* from spellbook$/ })).toHaveCount(2)
      await addSpells(page).getByRole('button', { name: 'Add Prestidigitation', exact: true }).click()
      await book(page).getByRole('button', { name: 'Prepare Hold Person', exact: true }).click()
      await expect(nextButton(page)).toBeEnabled()
    }
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: 'Level 4 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(page.locator('[aria-current="step"]')).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 4' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)

  let saved = await stored(page)
  expect(bookOf(saved).filter((spell) => spell.origin.kind === 'level' && spell.origin.level === 4).map((spell) => spell.name)).toEqual(['Hold Person', 'Invisibility'])
  expect(bookOf(saved)).toHaveLength(13)
  expect(preparedOf(saved)).toContain('Hold Person')

  await page.getByRole('button', { name: 'Remove level 4', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 4?' })
  await expect(dialog.locator('li', { hasText: 'Spellbook: Hold Person' })).toHaveCount(1)
  await expect(dialog.locator('li', { hasText: 'Spellbook: Invisibility' })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  saved = await stored(page)
  expect(bookOf(saved).map((spell) => spell.name)).not.toContain('Hold Person')
  expect(bookOf(saved).map((spell) => spell.name)).not.toContain('Invisibility')
  expect(bookOf(saved).find((spell) => spell.name === 'Identify')?.origin).toEqual({ kind: 'copied' })
  expect(bookOf(saved)).toHaveLength(11)
  expect(preparedOf(saved)).not.toContain('Hold Person')
})

test('SB-2 e: Edit of a migrated Wizard 5 with a short book saves without book count checks', async ({ page }) => {
  await openSheet(page, wizard5)
  await page.locator('.sheet__edit-character').click()
  await stepBar(page).getByRole('button', { name: /Spells/ }).click()
  await expect(counters(page)).toHaveText(['Cantrips: 4/4', 'Prepared: 9/9'])
  await expect(page.getByRole('status').filter({ hasText: /spellbook/ })).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
  await addToBook(page, 'Identify').click()
  await stepBar(page).getByRole('button', { name: /Review/ }).click()
  await wizardNav(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/#\/character\/sb2-e$/)

  const saved = await stored(page)
  expect(bookOf(saved)).toHaveLength(10)
  expect(bookOf(saved).find((spell) => spell.name === 'Identify')?.origin).toEqual({ kind: 'copied' })
  expect(bookOf(saved).filter((spell) => spell.origin.kind === 'migrated')).toHaveLength(9)
})

test('SB-2 f: a new Cleric prepares directly, with no spellbook counter or book', async ({ page }) => {
  await toSpellsStep(page, 'Cleric')
  await expect(counters(page)).toHaveText(['Cantrips: 0/3', 'Prepared: 0/4'])
  await expect(page.getByRole('button', { name: /to spellbook$/ })).toHaveCount(0)
  for (const name of ['Guidance', 'Sacred Flame', 'Thaumaturgy']) await addSpells(page).getByRole('button', { name: `Add ${name}`, exact: true }).click()
  for (const name of ['Bless', 'Command', 'Healing Word', 'Shield of Faith']) await addSpells(page).getByRole('button', { name: `Prepare ${name}`, exact: true }).click()
  await expect(nextButton(page)).toBeEnabled()
  await saveNew(page)
  expect('spellbooks' in (await stored(page))).toBe(false)
})
