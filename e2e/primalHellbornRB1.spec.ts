import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, nextButton, wizardNav } from './wizard.ts'

/* RB-1 (D392): Primal Knowledge (Barbarian 3) skill pick and Hellborn (Path of the Infernal 3, TGS2) language pick. Seeds at schema 64. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const CREATION_LANGUAGES = [
  { name: 'Common', source: XPHB, grantedBy: 'automatic' },
  { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
  { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
]

function seeded(id: string, subclass: string | null, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 64,
    id,
    name: id,
    classes: [{ className: 'Barbarian', classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Barbarian', classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 7 })),
    classSkills: ['athletics', 'intimidation'],
    masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }],
    languages: CREATION_LANGUAGES,
    ...extra,
  }
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

async function walkTo(page: Page, label: string): Promise<void> {
  for (let steps = 0; steps < 6 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) await next(page)
  await expectStep(page, label)
}

async function editToProficiencies(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await walkTo(page, 'Proficiencies')
}

const primal = (page: Page): Locator => page.getByLabel(/^Primal Knowledge skill/)
const hellborn = (page: Page): Locator => page.getByLabel(/^Hellborn language/)
const languageOptions = (select: Locator): Locator => select.locator('option:not([value=""])')
const skillRow = (page: Page, skill: string): Locator => page.locator('.sheet__skills li', { hasText: skill })
const languagesCard = (page: Page): Locator =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Proficiencies' }) }).getByRole('listitem').filter({ hasText: 'LANGUAGES' })

async function createInfernalBarbarian(page: Page, onLanguagesStep?: (page: Page) => Promise<void>): Promise<void> {
  await createFighter(page, {
    name: 'Infernal',
    level: 4,
    species: 'Dwarf|XPHB',
    subclass: 'Path of the Infernal',
    classStep: {
      className: 'Barbarian|XPHB',
      pick: async (p) => {
        await p.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
        await p.getByRole('checkbox', { name: 'Intimidation', exact: true }).check()
        for (const weapon of ['Greataxe', 'Handaxe', 'Battleaxe']) await chooseButton(p, weapon).first().click()
      },
    },
    onLanguagesStep: async (p) => {
      await onLanguagesStep?.(p)
      await expect(nextButton(p)).toBeDisabled()
      await primal(p).selectOption('skill:survival')
      await expect(nextButton(p)).toBeDisabled()
      await hellborn(p).selectOption({ label: 'Infernal' })
      await expect(nextButton(p)).toBeEnabled()
    },
  })
}

test('RB-1 a: wizard Barbarian 4 Path of the Infernal — Next waits for both picks; the sheet has Survival and Infernal', async ({ page }) => {
  await createInfernalBarbarian(page)
  await expect(skillRow(page, 'Survival')).toContainText('●')
  await expect(languagesCard(page)).toContainText('Infernal')
})

test('RB-1 b: Hellborn offers only Abyssal and Infernal; Primal Knowledge offers the Barbarian list minus held skills', async ({ page }) => {
  await createInfernalBarbarian(page, async (p) => {
    await expect(languageOptions(hellborn(p))).toHaveText(['Abyssal', 'Infernal'])
    await expect(primal(p).locator('optgroup[label="Skill"] option')).toHaveText(['Animal Handling', 'Nature', 'Perception', 'Survival'])
  })
})

const knowing = (names: string[]) => ({
  languages: [CREATION_LANGUAGES[0], ...names.map((name) => ({ name, source: XPHB, grantedBy: 'creation' }))],
  subclassSkills: [{ grantedBy: 'primalKnowledge', name: 'survival' }],
})

test('RB-1 b: Hellborn offers only the language not already known', async ({ page }) => {
  await open(page, seeded('hellborn-one', 'Path of the Infernal', 3, knowing(['Infernal', 'Elvish'])))
  await editToProficiencies(page)
  await expect(languageOptions(hellborn(page))).toHaveText(['Abyssal'])
})

test('RB-1 b: Hellborn has no slot when Abyssal and Infernal are both known', async ({ page }) => {
  await open(page, seeded('hellborn-none', 'Path of the Infernal', 3, knowing(['Infernal', 'Abyssal'])))
  await editToProficiencies(page)
  await expect(hellborn(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('RB-1 c: Barbarian 2 levelled to 3 with Path of the Infernal gets both picks in level up', async ({ page }) => {
  await open(page, seeded('rb1-up', null, 2))
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Barbarian 2 → 3', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  await chooseButton(page, 'Path of the Infernal').click()
  await walkTo(page, 'Proficiencies')
  await expect(nextButton(page)).toBeDisabled()
  await primal(page).selectOption('skill:perception')
  await hellborn(page).selectOption({ label: 'Abyssal' })
  await expect(nextButton(page)).toBeEnabled()
})

test('RB-1 d: Edit of the wizard character keeps both picks', async ({ page }) => {
  await createInfernalBarbarian(page)
  await editToProficiencies(page)
  await expect(primal(page)).toHaveValue('skill:survival')
  await expect(hellborn(page).locator('option:checked')).toHaveText('Infernal')
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expect(skillRow(page, 'Survival')).toContainText('●')
  await expect(languagesCard(page)).toContainText('Infernal')
})

test('RB-1 e: Barbarian 2 has no Primal Knowledge pick and no Hellborn slot', async ({ page }) => {
  await open(page, seeded('rb1-two', null, 2))
  await editToProficiencies(page)
  await expect(primal(page)).toHaveCount(0)
  await expect(hellborn(page)).toHaveCount(0)
})

test('RB-1 e: Barbarian 3 Path of the Berserker has Primal Knowledge but no Hellborn', async ({ page }) => {
  await open(page, seeded('rb1-berserker', 'Path of the Berserker', 3))
  await editToProficiencies(page)
  await expect(primal(page)).toHaveCount(1)
  await expect(hellborn(page)).toHaveCount(0)
})
