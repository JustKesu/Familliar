import { expect, test, type Locator, type Page } from '@playwright/test'
import { next, wizardNav } from './wizard.ts'

/* F-HLSB: fixes from review R-HLSB and the Savant notice (D426). */
const STORAGE_KEY = 'familliar:characters'
const SETTINGS_KEY = 'familliar:settings'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
type Origin = { kind: 'level'; level: number } | { kind: 'copied' } | { kind: 'migrated' }
const entries = (names: string[], origin: Origin) => names.map((name) => ({ name, source: XPHB, origin }))
const MM = { name: 'Magic Missile', source: XPHB }

function base(id: string, classes: { className: string; subclass: string | null; level: number }[], extra: Record<string, unknown>) {
  const total = classes.reduce((sum, entry) => sum + entry.level, 0)
  return {
    schemaVersion: 72,
    id,
    name: id,
    classes: classes.map((entry) => ({ ...entry, classSource: XPHB })),
    levelOrder: classes.flatMap((entry) => Array.from({ length: entry.level }, () => ({ className: entry.className, classSource: XPHB }))),
    createdAtLevel: 1,
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    abilityScores: { method: 'standardArray', scores: { strength: 13, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    hitPointLevels: Array.from({ length: total - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 4 })),
    classSkills: ['arcana', 'history'],
    ...extra,
  }
}

const SAVANT = ['Shatter', 'Thunderwave']
const evokerSavant = (picks: string[]) => [
  { subclassName: 'Evoker', subclassSource: XPHB, className: 'Wizard', classSource: XPHB, picks: picks.map((name, slotIndex) => ({ grantedAtLevel: 3, slotIndex, name, source: XPHB })) },
]
const book = (extra: Record<string, unknown> = {}) => [
  {
    className: 'Wizard',
    classSource: XPHB,
    spells: [
      ...entries(['Shield', 'Sleep', 'Detect Magic', 'Mage Armor', 'Burning Hands', 'Feather Fall'], { kind: 'level', level: 1 }),
      ...entries(['Misty Step', 'Web'], { kind: 'level', level: 2 }),
    ],
    ...extra,
  },
]
const evoker3 = (id: string) =>
  base(id, [{ className: 'Wizard', subclass: 'Evoker', level: 3 }], {
    subclassSpellChoices: evokerSavant(SAVANT),
    spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Shield', 'Sleep', 'Detect Magic']) }],
    spellbooks: book(),
  })

async function open(page: Page, characters: { id: string }[], hash = `/#/character/${characters[0]!.id}`): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(characters) },
  )
  await page.goto(hash)
}

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

const notice = (page: Page): Locator => page.getByRole('status', { name: 'Savant spells notice' })
const spellsTab = async (page: Page): Promise<void> => page.getByRole('tab', { name: 'Spells' }).click()

test('F-HLSB a: Wizard 18 Evoker / Fighter 1 levels Fighter to 2 and keeps the Spell Mastery on a Savant spell', async ({ page }) => {
  const character = base(
    'hlsb-a',
    [
      { className: 'Wizard', subclass: 'Evoker', level: 18 },
      { className: 'Fighter', subclass: null, level: 1 },
    ],
    {
      subclassSpellChoices: evokerSavant(['Magic Missile', 'Shatter']),
      spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Fire Bolt', 'Shield']) }],
      spellbooks: book({ mastery: [MM] }),
      fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
      masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }, { name: 'Longsword' }],
    },
  )
  await open(page, [character])
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 1 → 2', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  for (let i = 0; i < 10; i++) {
    const step = (await page.locator('[aria-current="step"]').textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: /hit points method/ }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(page.locator('[aria-current="step"]')).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 20' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  const saved = await stored(page)
  expect((saved['classes'] as { className: string; level: number }[]).map((entry) => `${entry.className} ${entry.level}`)).toEqual(['Wizard 18', 'Fighter 2'])
  expect((saved['spellbooks'] as { mastery?: unknown[] }[])[0]!.mastery).toEqual([MM])
})

test('F-HLSB b: Remove level 2 of a Paladin with Blessed Warrior names both of its cantrips', async ({ page }) => {
  const paladin = base('hlsb-b', [{ className: 'Paladin', subclass: null, level: 2 }], {
    abilityScores: { method: 'standardArray', scores: { strength: 14, dexterity: 10, constitution: 13, intelligence: 12, wisdom: 8, charisma: 15 } },
    classSkills: ['athletics', 'persuasion'],
    masteries: [{ name: 'Longsword' }, { name: 'Warhammer' }],
    spellChoices: [{ className: 'Paladin', classSource: XPHB, spells: refs(['Bless', 'Cure Wounds']) }],
    fightingStyles: [{ className: 'Paladin', classSource: XPHB, name: 'Blessed Warrior', source: XPHB, filterChoiceSpells: { cantrips: refs(['Guidance', 'Sacred Flame']), spells: [] } }],
  })
  await open(page, [paladin])
  await page.getByRole('button', { name: 'Remove level 2', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 2?' })
  for (const line of ['Fighting style: Blessed Warrior', 'Fighting style cantrip: Guidance', 'Fighting style cantrip: Sacred Flame']) {
    await expect(dialog.locator('li', { hasText: line })).toHaveCount(1)
  }
})

test('F-HLSB c: a file with two Wizard spellbooks is refused on import, and a stored one shows the Damaged card', async ({ page }) => {
  const twoBooks = { ...evoker3('hlsb-c'), spellbooks: [...book(), ...book()] }
  await page.goto('/#/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([twoBooks])) })
  await expect(page.locator('.error')).toContainText('more than one entry for Wizard')
  await expect(page.locator('.char-grid .char-card')).toHaveCount(0)

  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: STORAGE_KEY, payload: JSON.stringify([twoBooks]) })
  await page.reload()
  await expect(page.locator('.char-grid .char-card').filter({ hasText: 'hlsb-c' })).toContainText('Damaged')
})

test('F-HLSB d: an Evoker 3 with unprepared Savant spells sees the notice; Manage Spells opens the drawer; preparing both removes it', async ({ page }) => {
  await open(page, [evoker3('hlsb-d')])
  await spellsTab(page)
  await expect(notice(page)).toContainText(
    'Savant spells are not prepared: Shatter, Thunderwave. Since the 2024 rules they are only written into your spellbook. Prepare them in Manage Spells.',
  )
  await notice(page).getByRole('button', { name: 'Manage Spells for Savant spells', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
  await expect(drawer).toBeVisible()
  const spellbook = drawer.getByRole('region', { name: 'Spellbook', exact: true })
  await spellbook.getByRole('button', { name: 'Prepare Shatter', exact: true }).click()
  await expect(notice(page)).toContainText('Savant spells are not prepared: Thunderwave.')
  await spellbook.getByRole('button', { name: 'Prepare Thunderwave', exact: true }).click()
  await expect(notice(page)).toHaveCount(0)
})

test('F-HLSB e: Dismiss hides the notice for that character, also after a reload', async ({ page }) => {
  await open(page, [evoker3('hlsb-e')])
  await spellsTab(page)
  await expect(notice(page)).toBeVisible()
  await notice(page).getByRole('button', { name: 'Dismiss', exact: true }).click()
  await expect(notice(page)).toHaveCount(0)
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').dismissedSavantNotices, SETTINGS_KEY)).toEqual(['hlsb-e'])
  await page.reload()
  await spellsTab(page)
  await expect(page.locator('.sheet__spell-name', { hasText: /^Fire Bolt$/ })).toHaveCount(1)
  await expect(notice(page)).toHaveCount(0)
})

test('F-HLSB f: a Wizard 3 without a Savant subclass shows no notice', async ({ page }) => {
  const bladesinger = { ...evoker3('hlsb-f'), classes: [{ className: 'Wizard', classSource: XPHB, subclass: 'Bladesinger', level: 3 }], subclassSpellChoices: undefined }
  await open(page, [bladesinger])
  await spellsTab(page)
  await expect(page.locator('.sheet__spell-name', { hasText: /^Fire Bolt$/ })).toHaveCount(1)
  await expect(notice(page)).toHaveCount(0)
})
