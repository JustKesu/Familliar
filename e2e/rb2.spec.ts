import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, nextButton, wizardNav } from './wizard.ts'

/* RB-2: College of Lore / Fey Wanderer skill picks (D393), Barbarian mastery pool (D394), class save advantages (D395). Seeds at schema 65. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const spells = (...names: string[]) => names.map((name) => ({ name, source: XPHB }))
const AVERAGE_HIT_DIE: Record<string, number> = { Barbarian: 7, Fighter: 6, Ranger: 6, Bard: 5 }

async function editMasteries(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await page.getByRole('button', { name: /^Weapon masteries/ }).click()
}

function seeded(id: string, className: string, subclass: string | null, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 65,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    speciesSkills: ['athletics'],
    grantedFeats: [{ origin: 'species', name: 'Tough', source: XPHB }],
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: AVERAGE_HIT_DIE[className] })),
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    ...extra,
  }
}

const BARBARIAN = { classSkills: ['intimidation', 'survival'], masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }] }
const FIGHTER = { classSkills: ['acrobatics', 'perception'], masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }, { name: 'Longsword' }], fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }] }
const LORE_BARD = {
  classSkills: ['deception', 'stealth', 'performance'],
  expertiseSkills: [{ name: 'deception' }, { name: 'stealth' }],
  toolChoices: ['Lute', 'Flute', 'Drum'].map((name) => ({ grantedBy: 'bard', name })),
  spellChoices: [
    {
      className: 'Bard',
      classSource: XPHB,
      spells: spells('Vicious Mockery', 'Minor Illusion', 'Healing Word', 'Charm Person', 'Dissonant Whispers', 'Faerie Fire', 'Sleep', 'Heroism'),
    },
  ],
}
const FEY_RANGER = {
  classSkills: ['survival', 'perception', 'stealth'],
  expertiseSkills: [{ name: 'survival' }],
  masteries: [{ name: 'Longbow' }, { name: 'Shortsword' }],
  fightingStyles: [{ className: 'Ranger', classSource: XPHB, name: 'Archery', source: XPHB }],
  spellChoices: [{ className: 'Ranger', classSource: XPHB, spells: spells('Cure Wounds', 'Goodberry', 'Ensnaring Strike', 'Speak with Animals') }],
  languages: [
    { name: 'Common', source: XPHB, grantedBy: 'automatic' },
    { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
    { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    { name: 'Giant', source: XPHB, grantedBy: 'deftExplorer' },
    { name: 'Gnomish', source: XPHB, grantedBy: 'deftExplorer' },
  ],
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function editTo(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 6 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) await next(page)
  await expectStep(page, label)
}

async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

const offered = (select: Locator): Locator => select.locator('optgroup[label="Skill"] option')
const skillRow = (page: Page, skill: string): Locator => page.locator('.sheet__skills li', { hasText: skill })
const saveLines = (page: Page): Locator => page.locator('.sheet__saving-throws .sheet__save-advantages li')
const lore = (page: Page, slot: number): Locator => page.getByLabel(new RegExp(`^College of Lore skill ${slot}`))
const fey = (page: Page): Locator => page.getByLabel(/^Fey Wanderer skill/)

test('RB-2 a: Bard 3 College of Lore — Next waits for 3 skills; the sheet shows them proficient; Edit keeps them', async ({ page }) => {
  await open(page, seeded('rb2-lore', 'Bard', 'College of Lore', 3, LORE_BARD))
  await editTo(page, 'Proficiencies')
  await expect(nextButton(page)).toBeDisabled()
  await expect(offered(lore(page, 1))).toHaveCount(18 - 6)
  await lore(page, 1).selectOption('skill:arcana')
  await lore(page, 2).selectOption('skill:nature')
  await expect(nextButton(page)).toBeDisabled()
  await lore(page, 3).selectOption('skill:medicine')
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)
  for (const skill of ['Arcana', 'Nature', 'Medicine']) await expect(skillRow(page, skill)).toContainText('●')
  await editTo(page, 'Proficiencies')
  await expect(lore(page, 1)).toHaveValue('skill:arcana')
  await expect(lore(page, 2)).toHaveValue('skill:nature')
  await expect(lore(page, 3)).toHaveValue('skill:medicine')
})

test('RB-2 b: Ranger 3 Fey Wanderer — the pick offers only Deception, Performance, Persuasion and is saved', async ({ page }) => {
  await open(page, seeded('rb2-fey', 'Ranger', 'Fey Wanderer', 3, FEY_RANGER))
  await editTo(page, 'Proficiencies')
  await expect(offered(fey(page))).toHaveText(['Deception', 'Performance', 'Persuasion'])
  await expect(nextButton(page)).toBeDisabled()
  await fey(page).selectOption('skill:persuasion')
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)
  await expect(skillRow(page, 'Persuasion')).toContainText('●')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
  expect(stored.subclassSkills).toEqual([{ grantedBy: 'feyWanderer', name: 'persuasion' }])
})

test('RB-2 c: Barbarian mastery list has Longsword, no Longbow, Pistol or Psychic Blade; a Fighter still sees Longbow', async ({ page }) => {
  await open(page, seeded('rb2-barb-mastery', 'Barbarian', null, 1, BARBARIAN))
  await editMasteries(page)
  await expect(chooseButton(page, 'Longsword')).not.toHaveCount(0)
  for (const weapon of ['Longbow', 'Pistol', 'Psychic Blade', 'Staff', 'Wooden Staff']) await expect(chooseButton(page, weapon)).toHaveCount(0)
})

test('RB-2 c: a Fighter still sees Longbow in the mastery list', async ({ page }) => {
  await open(page, seeded('rb2-fighter-mastery', 'Fighter', null, 1, FIGHTER))
  await editMasteries(page)
  await expect(chooseButton(page, 'Longbow')).not.toHaveCount(0)
  await expect(chooseButton(page, 'Psychic Blade')).toHaveCount(0)
})

const DANGER_SENSE = 'Advantage on Dexterity saves unless Incapacitated (Danger Sense)'
const RAGE = 'Advantage on Strength saves while raging (Rage)'

test('RB-2 d: Barbarian 2 shows Danger Sense under Saving Throws and in the drawer', async ({ page }) => {
  await open(page, seeded('rb2-barb-2', 'Barbarian', null, 2, BARBARIAN))
  await expect(saveLines(page)).toHaveText([RAGE, DANGER_SENSE])
  await page.getByRole('button', { name: 'Saving throws details', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Saving throws', exact: true })
  await expect(drawer.locator('.sheet__save-advantages li')).toHaveText([RAGE, DANGER_SENSE])
})

test('RB-2 d/e: Barbarian 1 has no Danger Sense line, only the conditional Rage line', async ({ page }) => {
  await open(page, seeded('rb2-barb-1', 'Barbarian', null, 1, BARBARIAN))
  await expect(saveLines(page)).toHaveText([RAGE])
})
