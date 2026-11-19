import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelAsi, next, nextButton, wizardNav } from './wizard.ts'

/* SB-3 (D424): Wizard Savant picks are written into the spellbook, not always prepared. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
type Origin = { kind: 'level'; level: number } | { kind: 'copied' } | { kind: 'migrated' }
const entries = (names: string[], origin: Origin) => names.map((name) => ({ name, source: XPHB, origin }))

function base(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 71,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
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
    ...extra,
  }
}

const SAVANT = ['Shatter', 'Thunderwave']
function evoker3(id: string, prepared: string[]) {
  return base(id, 'Wizard', 'Evoker', 3, {
    subclassSpellChoices: [
      {
        subclassName: 'Evoker',
        subclassSource: XPHB,
        className: 'Wizard',
        classSource: XPHB,
        picks: SAVANT.map((name, slotIndex) => ({ grantedAtLevel: 3, slotIndex, name, source: XPHB })),
      },
    ],
    spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Shield', 'Sleep', 'Detect Magic', ...prepared]) }],
    spellbooks: [
      {
        className: 'Wizard',
        classSource: XPHB,
        spells: [
          ...entries(['Shield', 'Magic Missile', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands'], { kind: 'level', level: 1 }),
          ...entries(['Feather Fall', 'Misty Step'], { kind: 'level', level: 2 }),
          ...entries(['Web', 'Invisibility'], { kind: 'level', level: 3 }),
        ],
      },
    ],
  })
}

const loreBard6 = base('sb3-f', 'Bard', 'College of Lore', 6, {
  classSkills: ['arcana', 'history', 'insight'],
  subclassSpellChoices: [
    {
      subclassName: 'College of Lore',
      subclassSource: XPHB,
      className: 'Bard',
      classSource: XPHB,
      picks: [
        { grantedAtLevel: 6, slotIndex: 0, name: 'Fireball', source: XPHB },
        { grantedAtLevel: 6, slotIndex: 1, name: 'Revivify', source: XPHB },
      ],
    },
  ],
  spellChoices: [{ className: 'Bard', classSource: XPHB, spells: refs(['Vicious Mockery', 'Healing Word']) }],
})

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Spells' })
}

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

type StoredBook = { spells: { name: string; origin: Origin }[] }[]
const bookOf = (saved: Record<string, unknown>) => (saved['spellbooks'] as StoredBook | undefined)?.[0]?.spells ?? []
const preparedOf = (saved: Record<string, unknown>) => (saved['spellChoices'] as { spells: { name: string }[] }[])[0]!.spells.map((spell) => spell.name)

const spellsTab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const onSpellsTab = (page: Page, name: string): Locator => spellsTab(page).locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const region = (scope: Locator | Page, name: string): Locator => scope.getByRole('region', { name, exact: true })
const row = (scope: Locator, name: string): Locator => scope.locator('.manage-spells__row', { has: scope.page().locator('.manage-spells__name', { hasText: new RegExp(`^${name}$`) }) })
const counters = (scope: Locator | Page): Locator => scope.locator('.manage-spells__counter')

test('SB-3 a+b+e: Savant picks sit in the book labelled Savant, unprepared; preparing one counts it and puts it on the Spells tab; no migrated copy after a reload', async ({ page }) => {
  await openSheet(page, evoker3('sb3-a', []))
  for (const name of SAVANT) await expect(onSpellsTab(page, name)).toHaveCount(0)

  let panel = await openManage(page)
  const book = region(panel, 'Spellbook')
  for (const name of SAVANT) {
    await expect(row(book, name).locator('.manage-spells__tag')).toHaveText('Savant')
    await expect(row(book, name).getByRole('button', { name: `Remove ${name} from spellbook`, exact: true })).toHaveCount(0)
    await expect(row(region(panel, 'Prepared Spells'), name)).toHaveCount(0)
  }
  await expect(region(panel, 'Add Spells').getByRole('button', { name: 'Add Shatter to spellbook', exact: true })).toHaveCount(0)
  await expect(counters(panel)).toHaveText(['Cantrips: 3/3', 'Prepared: 3/6'])

  await book.getByRole('button', { name: 'Prepare Shatter', exact: true }).click()
  await expect(counters(panel)).toHaveText(['Cantrips: 3/3', 'Prepared: 4/6'])
  await expect(row(region(panel, 'Prepared Spells'), 'Shatter').getByRole('button', { name: 'Unprepare Shatter', exact: true })).toBeVisible()
  expect(preparedOf(await stored(page))).toContain('Shatter')

  await page.reload()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(onSpellsTab(page, 'Shatter')).toHaveCount(1)
  await expect(onSpellsTab(page, 'Thunderwave')).toHaveCount(0)
  panel = await openManage(page)
  await expect(row(region(panel, 'Spellbook'), 'Shatter').locator('.manage-spells__tag')).toHaveText('Savant')
  const names = bookOf(await stored(page)).map((spell) => spell.name)
  for (const name of SAVANT) expect(names).not.toContain(name)
})

test('SB-3 c: Evoker Wizard 3 → 4 still asks for exactly 2 book spells', async ({ page }) => {
  await openSheet(page, evoker3('sb3-c', []))
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Wizard 3 → 4', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)

  for (let i = 0; i < 10; i++) {
    const step = (await page.locator('[aria-current="step"]').textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/ASI \/ Feat/.test(step)) await chooseLevelAsi(page, 4, 'intelligence')
    if (/Spells/.test(step)) {
      await expect(counters(page).nth(2)).toHaveText('Spellbook: 0/2')
      await expect(row(region(page, 'Spellbook'), 'Shatter').locator('.manage-spells__tag')).toHaveText('Savant')
      const addSpells = region(page, 'Add Spells')
      await addSpells.getByRole('button', { name: 'Add Hold Person to spellbook', exact: true }).click()
      await expect(nextButton(page)).toBeDisabled()
      await addSpells.getByRole('button', { name: 'Add Darkness to spellbook', exact: true }).click()
      await expect(counters(page).nth(2)).toHaveText('Spellbook: 2/2')
      await expect(addSpells.getByRole('button', { name: 'Add Knock to spellbook', exact: true })).toBeDisabled()
      await addSpells.getByRole('button', { name: 'Add Prestidigitation', exact: true }).click()
      for (const name of ['Hold Person', 'Shatter', 'Mage Armor', 'Misty Step']) await region(page, 'Spellbook').getByRole('button', { name: `Prepare ${name}`, exact: true }).click()
      await expect(counters(page)).toHaveText(['Cantrips: 4/4', 'Prepared: 7/7', 'Spellbook: 2/2'])
      await expect(nextButton(page)).toBeEnabled()
    }
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: 'Level 4 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(page.locator('[aria-current="step"]')).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 4' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  const saved = await stored(page)
  expect(bookOf(saved).filter((spell) => spell.origin.kind === 'level' && spell.origin.level === 4).map((spell) => spell.name)).toEqual(['Hold Person', 'Darkness'])
  for (const name of SAVANT) expect(bookOf(saved).map((spell) => spell.name)).not.toContain(name)
})

test('SB-3 d: Remove level 3 of an Evoker takes the Savant spell out of the book and out of prepared, and the dialog names it', async ({ page }) => {
  await openSheet(page, evoker3('sb3-d', ['Shatter']))
  await page.getByRole('button', { name: 'Remove level 3', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 3?' })
  await expect(dialog.locator('li', { hasText: 'Wizard spell: Shatter (no longer prepared)' })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  const saved = await stored(page)
  expect(preparedOf(saved)).not.toContain('Shatter')
  expect(saved['subclassSpellChoices'] ?? []).toEqual([])
  const panel = await openManage(page)
  await expect(row(region(panel, 'Spellbook'), 'Shatter')).toHaveCount(0)
  await expect(onSpellsTab(page, 'Shatter')).toHaveCount(0)
})

test('SB-3 f: College of Lore 6 keeps its Magical Discoveries spells always prepared', async ({ page }) => {
  await openSheet(page, loreBard6)
  for (const name of ['Fireball', 'Revivify']) await expect(onSpellsTab(page, name)).toHaveCount(1)
  const panel = await openManage(page)
  await expect(row(region(panel, 'Prepared Spells'), 'Fireball').locator('.manage-spells__tag')).toHaveText('College of Lore')
  await expect(region(panel, 'Spellbook')).toHaveCount(0)
})
