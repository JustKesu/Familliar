import { expect, test, type Locator, type Page } from '@playwright/test'

/* M8 (D332): Remove level takes the last level of the history; a class at 0 leaves with its records. Seeded at schema 60. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const order = (entries: [string, number][]) => entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))

function seeded(id: string, classes: [string, string | null, number][], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: order(classes.map(([className, , level]) => [className, level])),
    createdAtLevel: 1,
    // CON 13 = +1.
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 14, wisdom: 14, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    ...extra,
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

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

const classes = (page: Page): Locator => page.locator('.sheet__classes')
const removeDialog = (page: Page, level: number): Locator => page.getByRole('alertdialog', { name: `Remove level ${level}?` })
const warning = (dialog: Locator): Locator => dialog.locator('.confirm-dialog__warning')
const skillStatus = (page: Page, skill: string) => page.locator('.sheet__skills .sheet__row', { hasText: skill }).locator('.sheet__prof-mark').getAttribute('data-status')
const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellName = (page: Page, name: string): Locator => spellsPanel(page).locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const concentrationCard = (page: Page): Locator => page.locator('.sheet__status-row .sheet__concentration')

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function openRemove(page: Page, level: number): Promise<Locator> {
  await page.getByRole('button', { name: `Remove level ${level}`, exact: true }).click()
  const dialog = removeDialog(page, level)
  await expect(dialog).toBeVisible()
  return dialog
}

async function confirmRemove(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

test('M8 a: Fighter 4 / Rogue 1, Rogue last — Rogue leaves with its skill pick, the character is Fighter 4 and Level up still works', async ({ page }) => {
  await openSheet(
    page,
    seeded('m8-a', [
      ['Fighter', 'Champion', 4],
      ['Rogue', null, 1],
    ], { multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }] }),
  )
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('proficient')

  const dialog = await openRemove(page, 5)
  await expect(warning(dialog)).toHaveText('Rogue will be removed from this character.')
  await expect(dialog.locator('.confirm-dialog__extra p').first()).toHaveText('Rogue will be removed from this character.')
  await expect(dialog.locator('li', { hasText: 'Skill proficiency: stealth (Rogue multiclass)' })).toHaveCount(1)
  await confirmRemove(dialog)

  await expect(classes(page)).toHaveText('Fighter 4 (Champion)')
  await expect.poll(() => skillStatus(page, 'Stealth')).not.toBe('proficient')
  const after = await stored(page)
  expect(after['multiclassPicks']).toBeUndefined()
  expect(after['levelOrder']).toEqual(order([['Fighter', 4]]))

  await page.locator('.sheet__level-up').click()
  const classWindow = page.getByRole('dialog', { name: 'Level up which class?' })
  await expect(classWindow.locator('.level-up-class__option')).toHaveText(['Fighter 4 → 5'])
  await classWindow.getByRole('button', { name: 'Fighter 4 → 5', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up$/)
})

test('M8 b: Warlock 6 / Sorcerer 3, Sorcerer last — Warlock 6 / Sorcerer 2, fewer slots and max HP, no removal line', async ({ page }) => {
  await openSheet(
    page,
    seeded(
      'm8-b',
      [
        ['Warlock', null, 6],
        ['Sorcerer', null, 3],
      ],
      {
        spellChoices: [
          { className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Hex']) },
          { className: 'Sorcerer', classSource: XPHB, spells: refs(['Fire Bolt', 'Shield', 'Scorching Ray']) },
        ],
      },
    ),
  )
  // M4: d8 max 8 + 5 × 5 + 3 × 4 + CON 1 × 9.
  await expect.poll(() => maxHp(page)).toBe(54)
  await page.getByRole('tab', { name: 'Spells' }).click()
  const ordinary = (level: number) => spellsPanel(page).getByRole('group', { name: `level ${level} spell slots uses`, exact: true }).getByRole('button')
  await expect(ordinary(1)).toHaveCount(4)
  await expect(ordinary(2)).toHaveCount(2)

  const dialog = await openRemove(page, 9)
  await expect(warning(dialog)).toHaveCount(0)
  await confirmRemove(dialog)

  await expect(classes(page)).toHaveText('Warlock 6 / Sorcerer 2')
  // Sorcerer 2 alone gives 1st ×3 and no 2nd; d6 average 4 + CON 1 less.
  await expect(ordinary(1)).toHaveCount(3)
  await expect(ordinary(2)).toHaveCount(0)
  await expect.poll(() => maxHp(page)).toBe(49)
  await expect(spellName(page, 'Scorching Ray')).toHaveCount(1)
})

test('M8 c: Wizard 3 / Cleric 1, Cleric last, concentrating on Bless — concentration ends, Cleric spells go, Wizard spells stay', async ({ page }) => {
  await openSheet(
    page,
    seeded(
      'm8-c',
      [
        ['Wizard', null, 3],
        ['Cleric', null, 1],
      ],
      {
        spellChoices: [
          { className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Magic Missile', 'Shield']) },
          { className: 'Cleric', classSource: XPHB, spells: refs(['Guidance', 'Bless']) },
        ],
        play: { concentratingOn: { name: 'Bless', source: XPHB } },
      },
    ),
  )
  await expect(concentrationCard(page)).toContainText('Bless')

  const dialog = await openRemove(page, 4)
  await expect(warning(dialog)).toHaveText('Cleric will be removed from this character.')
  for (const line of ['Cleric spell: Bless', 'Cleric spell: Guidance', 'Concentration: Bless']) await expect(dialog.locator('li', { hasText: line })).toHaveCount(1)
  await confirmRemove(dialog)

  await expect(classes(page)).toHaveText('Wizard 3')
  await expect(concentrationCard(page)).not.toContainText('Bless')
  expect((await stored(page))['play']).toBeUndefined()
  await page.getByRole('tab', { name: 'Spells' }).click()
  for (const name of ['Bless', 'Guidance']) await expect(spellName(page, name)).toHaveCount(0)
  for (const name of ['Fire Bolt', 'Magic Missile', 'Shield']) await expect(spellName(page, name).first()).toBeVisible()
})

test('M8 d: a multiclass character without a level history — Remove level disabled with the reason', async ({ page }) => {
  const { levelOrder: _levelOrder, ...noHistory } = seeded('m8-d', [
    ['Fighter', null, 4],
    ['Rogue', null, 1],
  ])
  await openSheet(page, noHistory)
  const button = page.locator('.sheet__remove-level')
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('title', 'Remove level unavailable: Cannot tell which class each level came from (no level history).')
})

test('M8 e: a single-class Fighter 5 — Remove level as before', async ({ page }) => {
  await openSheet(page, seeded('m8-e', [['Fighter', 'Champion', 5]]))
  const dialog = await openRemove(page, 5)
  await expect(warning(dialog)).toHaveCount(0)
  await expect(dialog).toContainText('Known and prepared spells are kept.')
  await confirmRemove(dialog)
  await expect(classes(page)).toHaveText('Fighter 4 (Champion)')
  expect((await stored(page))['levelOrder']).toEqual(order([['Fighter', 4]]))
})

test('M8 f: reading a character with a multiclass pick of a class it no longer has keeps its other picks', async ({ page }) => {
  await openSheet(
    page,
    seeded(
      'm8-f',
      [
        ['Fighter', null, 4],
        ['Rogue', null, 1],
      ],
      {
        multiclassPicks: [
          { className: 'Bard', classSource: XPHB, kind: 'skill', name: 'performance' },
          { className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' },
        ],
      },
    ),
  )
  await expect(classes(page)).toHaveText('Fighter 4 / Rogue 1')
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('proficient')
  await expect.poll(() => skillStatus(page, 'Performance')).not.toBe('proficient')
})
