import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, next, select, takeStartingEquipment, wizardNav } from './wizard.ts'

/* SB-1 (D422): the Wizard's spellbook — filled on the sheet, kept in Manage Spells. */
const STORAGE_KEY = 'familliar:characters'

const spells = (...names: string[]) => names.map((name) => ({ name, source: 'XPHB' }))

function caster(id: string, className: string, picks: string[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 70,
    id,
    name: `${className} ${id}`,
    classes: [{ className, classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: {
      method: 'standardArray',
      scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 16, wisdom: 16, charisma: 10 },
    },
    spellChoices: [{ className, classSource: 'XPHB', spells: spells(...picks) }],
    ...extra,
  }
}

const WIZARD = caster('sb1-a', 'Wizard', ['Fire Bolt', 'Shield', 'Magic Missile'])

async function openManage(page: Page, character: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  return reopenManage(page)
}

async function reopenManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Spells' }).click()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Spells' })
}

async function stored(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)
}

const book = (scope: Locator): Locator => scope.getByRole('region', { name: 'Spellbook', exact: true })
const prepared = (scope: Locator): Locator => scope.getByRole('region', { name: 'Prepared Spells', exact: true })
const addSpells = (scope: Locator): Locator => scope.getByRole('region', { name: 'Add Spells', exact: true })
const names = (scope: Locator): Promise<string[]> => scope.locator('.manage-spells__name').allTextContents()
const counters = (scope: Locator): Locator => scope.locator('.manage-spells__counter')

test('SB-1 a: a schema-70 Wizard 3 gets its leveled picks in the book, prepared, and they stay after a reload', async ({ page }) => {
  let panel = await openManage(page, WIZARD)
  await expect(panel.locator('summary', { hasText: 'Spellbook (2)' })).toHaveCount(1)
  expect((await names(book(panel))).sort()).toEqual(['Magic Missile', 'Shield'])
  await expect(book(panel).getByRole('button', { name: 'Unprepare Shield', exact: true })).toBeVisible()
  await expect(book(panel).getByRole('button', { name: 'Unprepare Magic Missile', exact: true })).toBeVisible()

  await page.reload()
  panel = await reopenManage(page)
  expect((await names(book(panel))).sort()).toEqual(['Magic Missile', 'Shield'])
  await expect(book(panel).getByRole('button', { name: 'Unprepare Shield', exact: true })).toBeVisible()
  const [saved] = await stored(page)
  expect(saved!['schemaVersion']).toBe(73)
  expect(saved!['spellbooks']).toEqual([
    {
      className: 'Wizard',
      classSource: 'XPHB',
      spells: [
        { name: 'Shield', source: 'XPHB', origin: { kind: 'migrated' } },
        { name: 'Magic Missile', source: 'XPHB', origin: { kind: 'migrated' } },
      ],
    },
  ])
})

test('SB-1 b+c: a spell outside the book offers only Add to spellbook; once added it can be prepared and the counter goes up', async ({ page }) => {
  const panel = await openManage(page, caster('sb1-b', 'Wizard', ['Fire Bolt', 'Shield', 'Magic Missile']))
  await expect(counters(panel)).toHaveText(['Cantrips: 1/3', 'Prepared: 2/6'])
  await expect(addSpells(panel).getByRole('button', { name: 'Prepare Sleep', exact: true })).toHaveCount(0)
  await addSpells(panel).getByRole('button', { name: 'Add Sleep to spellbook', exact: true }).click()
  await expect(panel.locator('summary', { hasText: 'Spellbook (3)' })).toHaveCount(1)
  await expect(addSpells(panel).getByRole('button', { name: 'Add Sleep to spellbook', exact: true })).toHaveCount(0)
  await book(panel).getByRole('button', { name: 'Prepare Sleep', exact: true }).click()
  await expect(counters(panel)).toHaveText(['Cantrips: 1/3', 'Prepared: 3/6'])
  expect(await names(prepared(panel))).toContain('Sleep')
  const [saved] = await stored(page)
  const entry = (saved!['spellbooks'] as { spells: { name: string; origin: { kind: string } }[] }[])[0]!.spells.find((spell) => spell.name === 'Sleep')
  expect(entry?.origin).toEqual({ kind: 'copied' })
})

test('SB-1 d: Remove from spellbook on a copied prepared spell takes it out of the book and out of prepared', async ({ page }) => {
  const character = caster('sb1-d', 'Wizard', ['Fire Bolt', 'Shield', 'Sleep'], {
    schemaVersion: 71,
    spellbooks: [
      {
        className: 'Wizard',
        classSource: 'XPHB',
        spells: [
          { name: 'Shield', source: 'XPHB', origin: { kind: 'migrated' } },
          { name: 'Sleep', source: 'XPHB', origin: { kind: 'copied' } },
        ],
      },
    ],
  })
  const panel = await openManage(page, character)
  await book(panel).getByRole('button', { name: 'Remove Sleep from spellbook', exact: true }).click()
  expect(await names(book(panel))).toEqual(['Shield'])
  await expect(prepared(panel).locator('.manage-spells__name', { hasText: /^Sleep$/ })).toHaveCount(0)
  await expect(counters(panel)).toHaveText(['Cantrips: 1/3', 'Prepared: 1/6'])
  const [saved] = await stored(page)
  expect((saved!['spellChoices'] as { spells: { name: string }[] }[])[0]!.spells.map((spell) => spell.name)).toEqual(['Fire Bolt', 'Shield'])
})

test('SB-1 e: Unprepare keeps the spell in the book', async ({ page }) => {
  const panel = await openManage(page, caster('sb1-e', 'Wizard', ['Fire Bolt', 'Shield', 'Magic Missile']))
  await book(panel).getByRole('button', { name: 'Unprepare Shield', exact: true }).click()
  await expect(book(panel).getByRole('button', { name: 'Prepare Shield', exact: true })).toBeVisible()
  expect((await names(book(panel))).sort()).toEqual(['Magic Missile', 'Shield'])
  await expect(prepared(panel).locator('.manage-spells__name', { hasText: /^Shield$/ })).toHaveCount(0)
  await expect(counters(panel)).toHaveText(['Cantrips: 1/3', 'Prepared: 1/6'])
})

test('SB-1 f: a Wizard 1 made in the creation wizard has its leveled picks in the book', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Book Wizard')
  await select(page, 'Class').selectOption('Wizard|XPHB')
  await select(page, 'Level').selectOption('1')
  await page.getByRole('checkbox', { name: 'Arcana', exact: true }).check()
  await page.getByRole('checkbox', { name: 'History', exact: true }).check()
  await next(page)
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('intelligence')
  await select(page, '+1').selectOption('wisdom')
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
  const add = addSpells(page.locator('body'))
  for (const name of ['Fire Bolt', 'Light', 'Mage Hand']) await add.getByRole('button', { name: `Add ${name}`, exact: true }).click()
  // D423: a new Wizard writes six spells in the book before it prepares from it.
  for (const name of ['Shield', 'Magic Missile', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands']) await add.getByRole('button', { name: `Add ${name} to spellbook`, exact: true }).click()
  for (const name of ['Shield', 'Magic Missile', 'Sleep', 'Detect Magic']) await add.getByRole('button', { name: `Prepare ${name}`, exact: true }).click()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  const panel = await reopenManage(page)
  await expect(panel.locator('summary', { hasText: 'Spellbook (6)' })).toHaveCount(1)
  expect((await names(book(panel))).sort()).toEqual(['Burning Hands', 'Detect Magic', 'Mage Armor', 'Magic Missile', 'Shield', 'Sleep'])
  const [saved] = await stored(page)
  expect((saved!['spellbooks'] as { spells: unknown[] }[])[0]!.spells).toHaveLength(6)
})

test('SB-1 g: a Cleric still prepares directly and has no spellbook', async ({ page }) => {
  const panel = await openManage(page, caster('sb1-g', 'Cleric', ['Guidance', 'Bless']))
  await expect(panel.locator('summary', { hasText: /^Spellbook/ })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: /to spellbook$/ })).toHaveCount(0)
  await addSpells(panel).getByRole('button', { name: 'Prepare Shield of Faith', exact: true }).click()
  await expect(addSpells(panel).getByRole('button', { name: 'Unprepare Shield of Faith', exact: true })).toBeVisible()
  const [saved] = await stored(page)
  expect('spellbooks' in saved!).toBe(false)
})
