import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, nextButton, stepBar, wizardNav } from './wizard.ts'

/* F-RB (D396): Hellborn slots beside other language grants, ineligible saved masteries, language picks on a subclass switch. Seeds at schema 66. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const lang = (name: string, grantedBy: string) => ({ name, source: XPHB, grantedBy })
const LANGUAGES = [lang('Common', 'automatic'), lang('Dwarvish', 'creation'), lang('Elvish', 'creation')]

// Max HP of the seeded Human with Tough: d12 / d8 averages 8 / 6 with CON +1, plus 2 per level.
const BARBARIAN_HP = (level: number) => 13 + (level - 1) * 8 + level * 2

function seeded(id: string, classes: [className: string, subclass: string | null, level: number][], currentHp: number, extra: Record<string, unknown> = {}) {
  const levelOrder = classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))
  const die: Record<string, number> = { Barbarian: 7, Rogue: 5 }
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder,
    createdAtLevel: 1,
    currentHp,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    speciesSkills: ['athletics'],
    grantedFeats: [{ origin: 'species', name: 'Tough', source: XPHB }],
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    hitPointLevels: levelOrder.slice(1).map((entry, index) => ({ level: index + 2, kind: 'average', dieResult: die[entry.className] })),
    classSkills: ['intimidation', 'perception'],
    masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }],
    languages: LANGUAGES,
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
  for (let steps = 0; steps < 8 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) await next(page)
  await expectStep(page, label)
}

async function edit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
}

async function save(page: Page): Promise<void> {
  const button = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 10 && !(await button.isVisible()); steps++) await next(page)
  await button.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

const primal = (page: Page): Locator => page.getByLabel(/^Primal Knowledge skill/)
const hellborn = (page: Page): Locator => page.getByLabel(/^Hellborn language/)
const skillRow = (page: Page, skill: string): Locator => page.locator('.sheet__skills li', { hasText: skill })

test('RB-F a: Barbarian 3 Infernal / Rogue 3 Mastermind knowing Infernal and Abyssal has no Hellborn slot, Next is enabled', async ({ page }) => {
  await open(
    page,
    seeded(
      'rbf-a',
      [
        ['Barbarian', 'Path of the Infernal', 3],
        ['Rogue', 'Mastermind', 3],
      ],
      13 + 2 * 8 + 3 * 6 + 12,
      {
        subclassSkills: [{ grantedBy: 'primalKnowledge', name: 'survival' }],
        multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
        toolChoices: [{ grantedBy: 'mastermind', name: 'Dice Set' }],
        languages: [...LANGUAGES, lang('Infernal', 'thievesCant'), lang('Abyssal', 'mastermind'), lang('Gnomish', 'mastermind')],
      },
    ),
  )
  await edit(page)
  await stepBar(page).getByRole('button', { name: /Proficiencies/ }).click()
  await expectStep(page, 'Proficiencies')
  await expect(hellborn(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('RB-F b: a saved Longbow on Barbarian 2 shows as "no longer eligible", can be unchecked and swapped for Handaxe', async ({ page }) => {
  await open(page, seeded('rbf-b', [['Barbarian', null, 2]], BARBARIAN_HP(2), { masteries: [{ name: 'Greataxe' }, { name: 'Longbow' }] }))
  await edit(page)
  await page.getByRole('button', { name: /^Weapon masteries/ }).click()
  const longbow = chooseButton(page, 'Longbow')
  await expect(longbow).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('no longer eligible').first()).toBeVisible()
  await expect(chooseButton(page, 'Handaxe')).toBeDisabled()
  await longbow.click()
  await expect(chooseButton(page, 'Longbow')).toHaveCount(0)
  await chooseButton(page, 'Handaxe').click()
  await save(page)
  // The sheet lists no mastery names (only the Weapon Mastery feature), so the saved character is the check.
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].masteries.map((mastery: { name: string }) => mastery.name), STORAGE_KEY)
  expect(stored).toEqual(['Greataxe', 'Handaxe'])
})

test('RB-F c: switching Infernal -> Berserker -> Infernal in Edit empties Hellborn and keeps Primal Knowledge', async ({ page }) => {
  await open(
    page,
    seeded('rbf-c', [['Barbarian', 'Path of the Infernal', 3]], BARBARIAN_HP(3), {
      subclassSkills: [{ grantedBy: 'primalKnowledge', name: 'survival' }],
      languages: [...LANGUAGES, lang('Abyssal', 'hellborn')],
    }),
  )
  await edit(page)
  await page.getByRole('button', { name: /^Subclass/ }).click()
  await chooseButton(page, 'Path of the Berserker').click()
  if (await chooseButton(page, 'Path of the Infernal').count() === 0) await page.getByRole('button', { name: /^Subclass/ }).click()
  await chooseButton(page, 'Path of the Infernal').click()
  await walkTo(page, 'Proficiencies')
  await expect(hellborn(page)).toHaveValue('')
  await expect(primal(page)).toHaveValue('skill:survival')
})

test('RB-F d: Remove level 3 -> 2 on a Barbarian 3 drops the Primal Knowledge skill from the sheet', async ({ page }) => {
  await open(
    page,
    seeded('rbf-d', [['Barbarian', 'Path of the Berserker', 3]], BARBARIAN_HP(3), { subclassSkills: [{ grantedBy: 'primalKnowledge', name: 'survival' }] }),
  )
  await expect(skillRow(page, 'Survival')).toContainText('●')
  await page.getByRole('button', { name: 'Remove level 3', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 3?' })
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(skillRow(page, 'Survival')).not.toContainText('●')
})
