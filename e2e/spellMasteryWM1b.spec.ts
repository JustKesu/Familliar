import { expect, test, type Locator, type Page } from '@playwright/test'

/* WM-1b (D425): Spell Mastery and Signature Spells are picked only in Manage Spells' Spellbook section. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
type Origin = { kind: 'level'; level: number } | { kind: 'copied' }
const entries = (names: string[], origin: Origin) => names.map((name) => ({ name, source: XPHB, origin }))

function wizard(id: string, level: number, picks: Record<string, unknown> = {}) {
  return {
    schemaVersion: 72,
    id,
    name: id,
    classes: [{ className: 'Wizard', classSource: XPHB, subclass: null, level }],
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
    spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Shield', 'Magic Missile', 'Fireball']) }],
    spellbooks: [
      {
        className: 'Wizard',
        classSource: XPHB,
        spells: [
          ...entries(['Shield', 'Magic Missile', 'Detect Magic'], { kind: 'level', level: 1 }),
          ...entries(['Sleep'], { kind: 'copied' }),
          ...entries(['Misty Step', 'Web', 'Shatter'], { kind: 'level', level: 3 }),
          ...entries(['Fireball', 'Counterspell', 'Fly'], { kind: 'level', level: 5 }),
        ],
        ...picks,
      },
    ],
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
  await page.getByRole('tab', { name: 'Spells' }).click()
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Spells' })
}

type StoredBook = { mastery?: { name: string }[]; signature?: { name: string }[] }[]
const storedBook = async (page: Page) =>
  (await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY))['spellbooks'] as StoredBook
const region = (scope: Locator | Page, name: string): Locator => scope.getByRole('region', { name, exact: true })
const spellsTab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellRows = (page: Page, name: string, kind: 'cast' | 'use' | 'label'): Locator =>
  spellsTab(page).locator(`.sheet__spell-row--${kind}`, { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const boxes = (row: Locator, used = false): Locator => row.locator(`.sheet__spell-notes .sheet__use-box${used ? '--used' : ''}`)
const counter = (scope: Locator, text: string): Locator => scope.locator('.manage-spells__counter', { hasText: text })

test('WM-1b a: Wizard 18 — Mastery on a level 1 and a level 2 book spell, at will on the Spells tab and not counted in Prepared; Shield has no toggle', async ({ page }) => {
  await openSheet(page, wizard('wm1b-a', 18))
  const panel = await openManage(page)
  const book = region(panel, 'Spellbook')
  await expect(counter(book, 'Spell Mastery')).toHaveText('Spell Mastery: 0/2 chosen')
  await expect(counter(book, 'Signature Spells')).toHaveCount(0)
  const prepared = counter(region(panel, 'Add Spells'), 'Prepared')
  const preparedBefore = await prepared.textContent()

  await expect(book.getByRole('button', { name: 'Mastery Shield', exact: true })).toHaveCount(0)
  await expect(book.getByRole('button', { name: 'Mastery Misty Step', exact: true })).toHaveCount(0)
  await expect(book.getByRole('button', { name: /^Signature / })).toHaveCount(0)
  await book.getByRole('button', { name: 'Mastery Sleep', exact: true }).click()
  await expect(book.getByRole('button', { name: 'Mastery Magic Missile', exact: true })).toBeDisabled()
  await book.getByRole('button', { name: 'Mastery Web', exact: true }).click()
  await expect(counter(book, 'Spell Mastery')).toHaveText('Spell Mastery: 2/2 chosen')
  await expect(book.getByRole('button', { name: 'Mastery Web', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(prepared).toHaveText(preparedBefore!)
  for (const name of ['Sleep', 'Web']) await expect(region(panel, 'Prepared Spells').locator('.manage-spells__row', { hasText: name }).locator('.manage-spells__tag')).toHaveText('Always prepared')
  expect((await storedBook(page))[0].mastery?.map((spell) => spell.name)).toEqual(['Sleep', 'Web'])

  await page.keyboard.press('Escape')
  for (const name of ['Sleep', 'Web']) await expect(spellsTab(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) }).first()).toContainText(/at will/i)
})

test('WM-1b b: Wizard 20 — two Signature spells with one use box each; using one empties it, Short Rest restores it', async ({ page }) => {
  await openSheet(page, wizard('wm1b-b', 20))
  const book = region(await openManage(page), 'Spellbook')
  await expect(counter(book, 'Signature Spells')).toHaveText('Signature Spells: 0/2 chosen')
  await book.getByRole('button', { name: 'Signature Fireball', exact: true }).click()
  await book.getByRole('button', { name: 'Signature Counterspell', exact: true }).click()
  await expect(book.getByRole('button', { name: 'Signature Fly', exact: true })).toBeDisabled()
  await expect(counter(book, 'Signature Spells')).toHaveText('Signature Spells: 2/2 chosen')
  await page.keyboard.press('Escape')

  for (const name of ['Fireball', 'Counterspell']) await expect(boxes(spellRows(page, name, 'use'))).toHaveCount(1)
  await spellRows(page, 'Fireball', 'use').getByRole('button', { name: 'Use Fireball', exact: true }).click()
  await expect(boxes(spellRows(page, 'Fireball', 'use'), true)).toHaveCount(1)
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(boxes(spellRows(page, 'Fireball', 'use'), true)).toHaveCount(0)

  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Actions' }).getByRole('button', { name: 'Fireball breakdown', exact: true }).first()).toBeVisible()
})

test('WM-1b c: Wizard 17 — no Mastery or Signature toggles and no status line', async ({ page }) => {
  await openSheet(page, wizard('wm1b-c', 17))
  const book = region(await openManage(page), 'Spellbook')
  await expect(book.getByRole('button', { name: 'Remove Sleep from spellbook', exact: true })).toBeVisible()
  await expect(book.getByRole('button', { name: /^(Mastery|Signature) / })).toHaveCount(0)
  await expect(counter(book, 'Spell Mastery')).toHaveCount(0)
})

test('WM-1b d: Remove from spellbook of a copied Mastery spell drops the mark', async ({ page }) => {
  await openSheet(page, wizard('wm1b-d', 18, { mastery: refs(['Sleep', 'Web']) }))
  const book = region(await openManage(page), 'Spellbook')
  await expect(counter(book, 'Spell Mastery')).toHaveText('Spell Mastery: 2/2 chosen')
  await book.getByRole('button', { name: 'Remove Sleep from spellbook', exact: true }).click()
  await expect(counter(book, 'Spell Mastery')).toHaveText('Spell Mastery: 1/2 chosen')
  expect((await storedBook(page))[0].mastery?.map((spell) => spell.name)).toEqual(['Web'])
})

test('WM-1b e: Remove level of Wizard 18 drops both Mastery picks and the dialog names them', async ({ page }) => {
  await openSheet(page, wizard('wm1b-e', 18, { mastery: refs(['Sleep', 'Web']) }))
  await page.getByRole('button', { name: 'Remove level 18', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 18?' })
  for (const name of ['Sleep', 'Web']) await expect(dialog.locator('li', { hasText: `Spell Mastery: ${name}` })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await storedBook(page))[0].mastery).toBeUndefined()
})
