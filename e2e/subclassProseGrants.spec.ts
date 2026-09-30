import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, expectStep, next, nextButton } from './wizard.ts'

/*
 * D203: prose proficiency grants of RHW/FRHoF subclasses. Characters of other classes than Fighter are seeded into
 * storage (as classGrants.spec.ts does) and opened in Edit Character / Level up, which run the same wizard steps.
 */
const STORAGE_KEY = 'familliar:characters'

interface Seed {
  className: string
  classSource?: string
  subclass: string | null
  level: number
  classSkills: string[]
  [field: string]: unknown
}

function seeded(id: string, { className, classSource = 'XPHB', subclass, level, ...rest }: Seed) {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: [{ className, classSource, subclass, level }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 13, wisdom: 15, charisma: 8 } },
    species: { name: 'Dwarf', source: 'XPHB' },
    background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    languages: [
      { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
      { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
      { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
    ],
    ...rest,
  }
}

async function open(page: Page, id: string, seed: Seed): Promise<void> {
  const payload = JSON.stringify([seeded(id, seed)])
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: payload },
  )
  await page.goto(`/#/character/${id}`)
}

async function editToStep(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 6 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) await next(page)
  await expectStep(page, label)
}

const skillSelect = (page: Page, label: string | RegExp): Locator => page.getByLabel(label)
const offered = (select: Locator): Locator => select.locator('optgroup[label="Skill"] option')
const skillRow = (page: Page, skill: string): Locator => page.locator('.sheet__skills li', { hasText: skill })
const card = (page: Page, category: string): Locator =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Proficiencies' }) }).getByRole('listitem').filter({ hasText: category })
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

const WIZARD_3 = { className: 'Wizard', subclass: 'Bladesinger', level: 3, classSkills: ['arcana', 'history'], expertiseSkills: [{ name: 'arcana' }] }
const CLERIC = { className: 'Cleric', subclass: 'Knowledge Domain', classSkills: ['medicine', 'persuasion'], classFeatureChoices: [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Protector' }] }
const KNOWLEDGE_PICKS = [
  { grantedBy: 'knowledgeDomain', name: 'religion' },
  { grantedBy: 'knowledgeDomain', name: 'arcana' },
]

test('D203 a: Bladesinger — the skill pick offers its 4 skills and is required in Edit Character', async ({ page }) => {
  await open(page, 'blade-edit', WIZARD_3)
  await editToStep(page, 'Languages')
  const select = skillSelect(page, /^Bladesinger skill/)
  await expect(offered(select)).toHaveText(['Acrobatics', 'Athletics', 'Performance', 'Persuasion'])
  await expect(nextButton(page)).toBeDisabled()
  await select.selectOption('skill:athletics')
  await expect(nextButton(page)).toBeEnabled()
})

test('D203 a: Bladesinger — weapon grant on the card; a Rapier attack is proficient, a Greatsword attack is not', async ({ page }) => {
  await open(page, 'blade-sheet', {
    ...WIZARD_3,
    subclassSkills: [{ grantedBy: 'bladesinger', name: 'athletics' }],
    inventory: [
      { name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held' },
      { name: 'Greatsword', source: 'XPHB', quantity: 1, equipped: 'held' },
    ],
  })
  await expect(card(page, 'WEAPONS')).toContainText('Martial melee weapons without the Two-Handed or Heavy property')
  await expect(skillRow(page, 'Athletics')).toContainText('●')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionRow(page, 'Rapier')).toBeVisible()
  await expect(actionRow(page, 'Rapier')).not.toContainText('Not proficient')
  await expect(actionRow(page, 'Greatsword')).toContainText('Not proficient')
})

test('D203 b: Knowledge Domain — a tool and 2 skills, the background Religion offered too; Next waits for all three', async ({ page }) => {
  await open(page, 'knowledge-edit', { ...CLERIC, level: 3 })
  await editToStep(page, 'Languages')
  const first = skillSelect(page, /^Knowledge Domain skill 1 \(with Expertise\)/)
  const second = skillSelect(page, /^Knowledge Domain skill 2 \(with Expertise\)/)
  await expect(offered(first)).toHaveText(['Arcana', 'History', 'Nature', 'Religion'])
  await first.selectOption('skill:religion')
  await expect(offered(second)).toHaveText(['Arcana', 'History', 'Nature'])
  await second.selectOption('skill:arcana')
  await expect(nextButton(page)).toBeDisabled()
  await page.getByLabel(/^Knowledge Domain tool/).selectOption("Smith's Tools")
  await expect(nextButton(page)).toBeEnabled()
})

test('D203 b: Knowledge Domain — both picks show expertise, the tool is on the card', async ({ page }) => {
  await open(page, 'knowledge-sheet', { ...CLERIC, level: 3, subclassSkills: KNOWLEDGE_PICKS, toolChoices: [{ grantedBy: 'knowledgeDomain', name: "Smith's Tools" }] })
  await expect(skillRow(page, 'Religion')).toContainText('★')
  await expect(skillRow(page, 'Arcana')).toContainText('★')
  await expect(card(page, 'TOOLS')).toContainText("Smith's Tools")
})

test('D203 b: Knowledge Domain — a feat expertise picker does not offer the two skills', async ({ page }) => {
  const cantrips = ['Guidance', 'Light', 'Sacred Flame', 'Thaumaturgy']
  const spells = ['Bless', 'Cure Wounds', 'Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Sanctuary', 'Inflict Wounds']
  await open(page, 'knowledge-feat', {
    ...CLERIC,
    level: 4,
    subclassSkills: KNOWLEDGE_PICKS,
    toolChoices: [{ grantedBy: 'knowledgeDomain', name: "Smith's Tools" }],
    spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [...cantrips, ...spells].map((name) => ({ name, source: 'XPHB' })) }],
    featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skill Expert', source: 'XPHB', chosenAbility: 'wisdom' }],
  })
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 8 && !(await page.getByRole('group', { name: 'Level 4' }).isVisible()); steps++) await next(page)
  const expertise = page.getByLabel('Skill Expert expertise', { exact: true })
  await expect(expertise.getByRole('option', { name: 'Medicine', exact: true })).toHaveCount(1)
  await expect(expertise.getByRole('option', { name: 'Religion', exact: true })).toHaveCount(0)
  await expect(expertise.getByRole('option', { name: 'Arcana', exact: true })).toHaveCount(0)
})

test('D203 c: Knowledge Domain 6 — Intelligence saves proficient from Unfettered Mind', async ({ page }) => {
  await open(page, 'unfettered', { ...CLERIC, level: 6, subclassSkills: KNOWLEDGE_PICKS })
  await page.getByRole('button', { name: 'Intelligence saving throw breakdown' }).click()
  await expect(page.getByText('proficiency (subclass (Knowledge Domain))')).toBeVisible()
})

test('D203 c: Knowledge Domain 6 already proficient in Intelligence saves (Resilient) — the note', async ({ page }) => {
  await open(page, 'unfettered-note', {
    ...CLERIC,
    level: 6,
    subclassSkills: KNOWLEDGE_PICKS,
    featAsiChoices: [{ level: 4, kind: 'feat', name: 'Resilient', source: 'XPHB', chosenAbility: 'intelligence' }],
  })
  await page.getByRole('button', { name: 'Intelligence saving throw breakdown' }).click()
  await expect(page.getByText('Unfettered Mind: already proficient in Intelligence saves — choose another save (not tracked)')).toBeVisible()
})

test('D203 d: Banneret — language and skill picks are required and both reach the sheet', async ({ page }) => {
  await createFighter(page, {
    name: 'Banneret',
    level: 3,
    species: 'Dwarf|XPHB',
    subclass: 'Banneret',
    onLanguagesStep: async (p) => {
      const skill = skillSelect(p, /^Banneret skill/)
      await expect(offered(skill)).toHaveText(['Intimidation', 'Performance', 'Persuasion'])
      await expect(nextButton(p)).toBeDisabled()
      await p.getByLabel(/^Knightly Envoy language/).selectOption({ label: 'Giant' })
      await expect(nextButton(p)).toBeDisabled()
      await skill.selectOption('skill:persuasion')
      await expect(nextButton(p)).toBeEnabled()
    },
  })
  await expect(skillRow(page, 'Persuasion')).toContainText('●')
  await expect(card(page, 'LANGUAGES')).toContainText('Giant')
})

test('D203 e: Oath of the Noble Genies offers only its list', async ({ page }) => {
  await open(page, 'genies', { className: 'Paladin', subclass: 'Oath of the Noble Genies', level: 3, classSkills: ['athletics', 'medicine'] })
  await editToStep(page, 'Languages')
  await expect(offered(skillSelect(page, /^Oath of the Noble Genies skill/))).toHaveText(['Acrobatics', 'Intimidation', 'Performance', 'Persuasion'])
})

test('D203 e: College of the Moon offers only its list, minus a skill already held', async ({ page }) => {
  await open(page, 'moon', {
    className: 'Bard',
    subclass: 'College of the Moon',
    level: 3,
    classSkills: ['deception', 'stealth', 'history'],
    expertiseSkills: [{ name: 'deception' }, { name: 'stealth' }],
    toolChoices: ['Lute', 'Flute', 'Drum'].map((name) => ({ grantedBy: 'bard', name })),
  })
  await editToStep(page, 'Languages')
  await expect(offered(skillSelect(page, /^College of the Moon skill/))).toHaveText(['Animal handling', 'Medicine', 'Nature', 'Perception', 'Survival'])
})

test('D203 f: College of Spirits — Playing Cards on the card, not in the inventory', async ({ page }) => {
  await open(page, 'spirits', { className: 'Bard', subclass: 'College of Spirits', level: 3, classSkills: ['deception', 'stealth', 'history'] })
  await expect(card(page, 'TOOLS')).toContainText('Playing Cards')
  // The Inventory tab also lists the item catalogue, so the stored inventory is what is checked.
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
  expect(stored.inventory ?? []).toEqual([])
})

const ARTIFICER = { className: 'Artificer', classSource: 'EFA', subclass: 'Reanimator', level: 3, classSkills: ['arcana', 'history'] }

test("D203 g: Reanimator — Alchemist's Supplies on the card, no replacement owed", async ({ page }) => {
  await open(page, 'reanimator', { ...ARTIFICER, toolChoices: [{ grantedBy: 'artificer', name: "Woodcarver's Tools" }] })
  await expect(card(page, 'TOOLS')).toContainText("Alchemist's Supplies")
  await expect(card(page, 'TOOLS')).not.toContainText('(Reanimator) — not chosen')
})

test("D203 g: Reanimator already holding Alchemist's Supplies gets one replacement artisan's-tool slot", async ({ page }) => {
  await open(page, 'reanimator-dup', { ...ARTIFICER, toolChoices: [{ grantedBy: 'artificer', name: "Alchemist's Supplies" }] })
  await expect(card(page, 'TOOLS')).toContainText("1 artisan's tool (Reanimator) — not chosen")
  await editToStep(page, 'Languages')
  await expect(page.getByLabel(/^Reanimator tool/)).toHaveCount(1)
  await expect(nextButton(page)).toBeDisabled()
})

test('D203 h: removing level 3 deletes the Banneret skill and language picks', async ({ page }) => {
  await open(page, 'banneret-down', {
    className: 'Fighter',
    subclass: 'Banneret',
    level: 3,
    classSkills: ['athletics', 'perception'],
    subclassSkills: [{ grantedBy: 'banneret', name: 'persuasion' }],
    languages: [
      { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
      { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
      { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
      { name: 'Giant', source: 'XPHB', grantedBy: 'banneret' },
    ],
  })
  await page.getByRole('button', { name: 'Remove level 3' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 3?' })
  await expect(dialog).toContainText('Skill proficiency: persuasion')
  await expect(dialog).toContainText('Language: Giant')
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(skillRow(page, 'Persuasion')).not.toContainText('●')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
  expect(stored.subclassSkills ?? []).toEqual([])
  expect(stored.languages.map((language: { name: string }) => language.name)).not.toContain('Giant')
})

const ABERRANT_ROGUE = {
  className: 'Rogue',
  subclass: 'Swashbuckler',
  level: 5,
  classSkills: ['perception', 'stealth', 'acrobatics', 'deception'],
  expertiseSkills: [{ name: 'stealth' }, { name: 'acrobatics' }],
  featAsiChoices: [{ level: 4, kind: 'feat', name: 'Aberrant Anatomy', source: 'RHW' }],
}

test("D203 i: Level up — the class expertise picker does not offer Aberrant Anatomy's Perception", async ({ page }) => {
  await open(page, 'aberrant-up', ABERRANT_ROGUE)
  await page.getByRole('button', { name: 'Level up to 6' }).click()
  await expectStep(page, 'Expertise')
  await expect(page.getByRole('checkbox', { name: /^Deception/ })).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: /^Perception/ })).toHaveCount(0)
})

test("D203 i: Edit Character — the class expertise picker does not offer Aberrant Anatomy's Perception", async ({ page }) => {
  await open(page, 'aberrant-edit', ABERRANT_ROGUE)
  await editToStep(page, 'Expertise')
  await expect(page.getByRole('checkbox', { name: /^Deception/ })).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: /^Perception/ })).toHaveCount(0)
})
