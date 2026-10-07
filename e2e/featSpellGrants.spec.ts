import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelFeat, createFighter, expectStep, next, nextButton, openLevelCard, takeFighterLevel4Mastery, wizardNav } from './wizard.ts'

/*
 * D204: spells of the Dark Gift feats, Boon of Revelry, Telepathic/Telekinetic, and the marks' spellcasting ability.
 * Non-Fighter characters are seeded into storage (as subclassProseGrants.spec.ts does).
 */
const STORAGE_KEY = 'familliar:characters'

type Scores = Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>
const SCORES: Scores = { strength: 10, dexterity: 14, constitution: 12, intelligence: 13, wisdom: 15, charisma: 8 }

function seeded(id: string, className: string, level: number, feats: Record<string, unknown>[], rest: Record<string, unknown> = {}, scores: Partial<Scores> = {}) {
  return {
    schemaVersion: 49,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    abilityScores: { method: 'standardArray', scores: { ...SCORES, ...scores } },
    spellChoices: [],
    featAsiChoices: feats,
    ...rest,
  }
}

const feat = (level: number, name: string, source: string, chosenAbility?: string) => ({ level, kind: 'feat', name, source, ...(chosenAbility ? { chosenAbility } : {}) })

async function openSaved(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const named = (page: Page, name: string): Locator => page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const spellRow = (page: Page, name: string): Locator => panel(page).locator('.sheet__spell-row', { has: named(page, name) })
const kindRow = (page: Page, name: string, kind: 'cast' | 'use'): Locator => panel(page).locator(`.sheet__spell-row--${kind}`, { has: named(page, name) })
const hitDc = (row: Locator): Locator => row.locator('.sheet__action-to-hit')
const abilitySelect = (scope: Page | Locator): Locator => scope.getByRole('combobox', { name: 'Spellcasting ability', exact: true })

async function expectLongRestUse(page: Page, name: string): Promise<void> {
  await expect(kindRow(page, name, 'use')).toHaveCount(1)
  await expect(kindRow(page, name, 'use').locator('.sheet__spell-notes')).toContainText('/ Long Rest')
}

async function editToLevel(page: Page, level: number): Promise<Locator> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  const group = page.getByRole('group', { name: `Level ${level}` })
  for (let steps = 0; steps < 8 && !(await group.isVisible()); steps++) await next(page)
  return group
}

const CLERIC = {
  subclass: 'Knowledge Domain',
  classSkills: ['medicine', 'persuasion'],
  classFeatureChoices: [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Protector' }],
  subclassSkills: [
    { grantedBy: 'knowledgeDomain', name: 'religion' },
    { grantedBy: 'knowledgeDomain', name: 'arcana' },
  ],
  toolChoices: [{ grantedBy: 'knowledgeDomain', name: "Smith's Tools" }],
  createdAtLevel: 1,
  species: { name: 'Dwarf', source: 'XPHB' },
  background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  abilityBonus: { wisdom: 2, intelligence: 1 },
  languages: [
    { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
    { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
  ],
  spellChoices: [
    {
      className: 'Cleric',
      classSource: 'XPHB',
      spells: ['Guidance', 'Light', 'Sacred Flame', 'Thaumaturgy', 'Bless', 'Cure Wounds', 'Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Sanctuary', 'Inflict Wounds'].map((name) => ({ name, source: 'XPHB' })),
    },
  ],
}

function cleric(id: string, feats: Record<string, unknown>[]) {
  const { subclass, ...rest } = CLERIC
  const character = seeded(id, 'Cleric', 4, feats, rest)
  return { ...character, classes: [{ ...character.classes[0], subclass }] }
}

test('D204 a: Edit Character — Watchers asks for a spellcasting ability (Int/Wis/Cha) and the step waits for it', async ({ page }) => {
  await openSaved(page, cleric('watchers-edit', [{ level: 4, kind: 'asi', increases: { wisdom: 2 } }]))
  const level4 = await editToLevel(page, 4)
  await openLevelCard(page, 4)
  await chooseLevelFeat(page, 4, 'Watchers')
  const select = abilitySelect(level4)
  await expect(select.getByRole('option')).toHaveText(['Choose an ability', 'Intelligence', 'Wisdom', 'Charisma'])
  await expect(nextButton(page)).toBeDisabled()
  await select.selectOption('wisdom')
  await expect(nextButton(page)).toBeEnabled()
})

test('D204 a: Level up — a Dark Gift asks for its spellcasting ability there too', async ({ page }) => {
  await createFighter(page, { name: 'Leveller', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
  await takeFighterLevel4Mastery(page)
  const level4 = page.getByRole('group', { name: 'Level 4' })
  for (let steps = 0; steps < 8 && !(await level4.isVisible()); steps++) await next(page)
  await chooseLevelFeat(page, 4, 'Second Skin')
  await expect(nextButton(page)).toBeDisabled()
  await abilitySelect(level4).selectOption('charisma')
  await expect(nextButton(page)).toBeEnabled()
})

test('D204 a: Cleric 4 with Watchers (Wisdom) — Beast Sense and Speak with Animals each have a 1/LR use row and a cast row', async ({ page }) => {
  await openSaved(page, cleric('watchers-sheet', [feat(4, 'Watchers', 'RHW', 'wisdom')]))
  for (const name of ['Beast Sense', 'Speak with Animals']) {
    await expectLongRestUse(page, name)
    await expect(kindRow(page, name, 'cast')).toHaveCount(1)
  }
})

test('D204 b: Gathered Whispers — Message among the cantrips, Augury with a 1/LR use row', async ({ page }) => {
  await openSaved(page, seeded('whispers', 'Fighter', 4, [feat(4, 'Gathered Whispers', 'RHW', 'wisdom')]))
  await expect(spellRow(page, 'Message')).toHaveCount(1)
  await expectLongRestUse(page, 'Augury')
})

test('D204 c: Fighter 4 with Second Skin — Alter Self has a use row and no cast row', async ({ page }) => {
  await openSaved(page, seeded('second-skin', 'Fighter', 4, [feat(4, 'Second Skin', 'RHW', 'wisdom')]))
  await expectLongRestUse(page, 'Alter Self')
  await expect(kindRow(page, 'Alter Self', 'cast')).toHaveCount(0)
})

test('D204 d: a mark with no ability stored leaves only its own spells unresolved; choosing Charisma in Edit Character resolves them', async ({ page }) => {
  await createFighter(page, {
    name: 'Stormtouched',
    level: 6,
    species: 'Dwarf|XPHB',
    feat: 'Touch of Death',
    onFeatStep: async (p) => {
      await abilitySelect(p.getByRole('group', { name: 'Level 4' })).selectOption('intelligence')
    },
    laterFeat: {
      level: 6,
      feat: 'Mark of Storm',
      onFeatStep: async (p) => {
        await expect(nextButton(p)).toBeDisabled()
        await abilitySelect(p.getByRole('group', { name: 'Level 6' })).selectOption('wisdom')
      },
    },
  })
  // An older save: the mark was taken before it asked for an ability.
  await page.evaluate((key) => {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const choice of list[0].featAsiChoices) if (choice.name === 'Mark of Storm') delete choice.chosenAbility
    localStorage.setItem(key, JSON.stringify(list))
  }, STORAGE_KEY)
  await page.reload()
  await page.getByRole('tab', { name: 'Spells' }).click()
  // Int 12 + 1 (Acolyte) = +1, PB 3.
  await expect(hitDc(spellRow(page, 'Chill Touch'))).toContainText('+4')
  await expect(hitDc(spellRow(page, 'Thunderclap'))).toContainText('spellcasting ability not chosen yet')

  const level6 = await editToLevel(page, 6)
  await expect(nextButton(page)).toBeDisabled()
  await abilitySelect(level6).selectOption('charisma')
  while (!(await wizardNav(page).getByRole('button', { name: 'Save changes' }).isVisible())) await next(page)
  await wizardNav(page).getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('tab', { name: 'Spells' }).click()
  // 8 + PB 3 + Cha mod -1 (Cha 8).
  await expect(hitDc(spellRow(page, 'Thunderclap'))).toContainText('DC 10')
})

test("D204 e: Wizard 19 with Boon of Revelry (+1 Charisma) — Otto's Irresistible Dance has a 1/LR use row, a cast row, and a Charisma DC", async ({ page }) => {
  await openSaved(page, seeded('revelry', 'Wizard', 19, [feat(19, 'Boon of Revelry', 'FRHoF', 'charisma')], {}, { intelligence: 10, charisma: 16 }))
  const name = "Otto's Irresistible Dance"
  await expectLongRestUse(page, name)
  await expect(kindRow(page, name, 'cast')).toHaveCount(1)
  // 8 + PB 6 + Cha mod +3 (16 + 1); the Wizard's own Int 10 would give 14.
  await expect(hitDc(kindRow(page, name, 'use'))).toContainText('DC 17')
})

test('D204 f: Wizard 4 with Telepathic — Detect Thoughts has a 1/LR use row and a cast row', async ({ page }) => {
  await openSaved(page, seeded('telepathic', 'Wizard', 4, [feat(4, 'Telepathic', 'XPHB', 'intelligence')]))
  await expectLongRestUse(page, 'Detect Thoughts')
  await expect(kindRow(page, 'Detect Thoughts', 'cast')).toHaveCount(1)
})

test('D204 f: Telekinetic — Mage Hand among the cantrips', async ({ page }) => {
  await openSaved(page, seeded('telekinetic', 'Fighter', 4, [feat(4, 'Telekinetic', 'XPHB', 'intelligence')]))
  await expect(spellRow(page, 'Mage Hand')).toHaveCount(1)
})
