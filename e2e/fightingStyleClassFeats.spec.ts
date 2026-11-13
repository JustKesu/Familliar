import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, nextButton, wizardNav } from './wizard.ts'

/* FS-1 (D419): Paladin 2 also offers Blessed Warrior, Ranger 2 Druidic Warrior, each with two cantrips. Seeds at schema 69. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (...names: string[]) => names.map((name) => ({ name, source: XPHB }))

function seeded(id: string, className: string, level: number, scores: Record<string, number>, extra: Record<string, unknown>) {
  return {
    schemaVersion: 69,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    speciesSkills: ['athletics'],
    grantedFeats: [{ origin: 'species', name: 'Tough', source: XPHB }],
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { charisma: 2, wisdom: 1 },
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    ...extra,
  }
}

// CHA 15 + 2 = 17 (+3), WIS 8 + 1 = 9 (-1): a CHA save DC at PB 2 is 13, a WIS one 9.
const PALADIN_SCORES = { strength: 14, dexterity: 10, constitution: 13, intelligence: 12, wisdom: 8, charisma: 15 }
const paladin1 = (id: string) =>
  seeded(id, 'Paladin', 1, PALADIN_SCORES, {
    classSkills: ['athletics', 'persuasion'],
    masteries: [{ name: 'Longsword' }, { name: 'Warhammer' }],
    spellChoices: [{ className: 'Paladin', classSource: XPHB, spells: refs('Bless', 'Cure Wounds') }],
  })
const fighter1 = (id: string) =>
  seeded(id, 'Fighter', 1, PALADIN_SCORES, {
    classSkills: ['acrobatics', 'perception'],
    masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }, { name: 'Longsword' }],
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
  })
// WIS 15 + 1 = 16 (+3): a WIS spell attack at PB 2 is +5.
const ranger2 = (id: string) =>
  seeded(id, 'Ranger', 2, { strength: 12, dexterity: 15, constitution: 13, intelligence: 10, wisdom: 15, charisma: 8 }, {
    classSkills: ['survival', 'perception', 'stealth'],
    expertiseSkills: [{ name: 'survival' }],
    masteries: [{ name: 'Longbow' }, { name: 'Shortsword' }],
    fightingStyles: [{ className: 'Ranger', classSource: XPHB, name: 'Archery', source: XPHB }],
    spellChoices: [{ className: 'Ranger', classSource: XPHB, spells: refs('Cure Wounds', 'Goodberry', 'Ensnaring Strike') }],
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Giant', source: XPHB, grantedBy: 'deftExplorer' },
      { name: 'Gnomish', source: XPHB, grantedBy: 'deftExplorer' },
    ],
  })

async function open(page: Page, character: { id: string }): Promise<void> {
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

async function openStyleList(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Fighting style/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
}

async function editClassStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await openStyleList(page)
}

async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  const counter = page.locator('.manage-spells__counter', { hasText: /^Prepared:/ })
  if ((await counter.count()) === 0) return
  for (;;) {
    const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
    if (have! >= max!) return
    await addSpells.getByRole('button', { name: /^Prepare /, disabled: false }).first().click()
    await expect(counter).toHaveText(new RegExp(`^Prepared: ${have! + 1}/`))
  }
}

const cantrip = (page: Page, name: string): Locator => page.getByRole('checkbox', { name, exact: true })
const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellRow = (page: Page, name: string): Locator =>
  spellsPanel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })

test('FS-1 a: a Fighter is not offered Blessed Warrior or Druidic Warrior', async ({ page }) => {
  await open(page, fighter1('fs1-fighter'))
  await editClassStep(page)
  await expect(chooseButton(page, 'Archery')).toBeVisible()
  await expect(chooseButton(page, 'Blessed Warrior')).toHaveCount(0)
  await expect(chooseButton(page, 'Druidic Warrior')).toHaveCount(0)
})

test('FS-1 a, b: Paladin 1 → 2 offers Blessed Warrior; Guidance and Sacred Flame land on the Spells tab with CHA', async ({ page }) => {
  await open(page, paladin1('fs1-paladin'))
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Paladin 1 → 2', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  await expectStep(page, 'Class and level')
  await openStyleList(page)
  await expect(chooseButton(page, 'Druidic Warrior')).toHaveCount(0)
  await chooseButton(page, 'Blessed Warrior').click()
  await expect(page.getByText('0 of 2 cantrips chosen.')).toBeVisible()
  // F-HL C (D421): the cantrip list sits in its own titled box.
  const box = page.locator('.fighting-style-picker__cantrips')
  await expect(box).toContainText('Blessed Warrior cantrips')
  await expect(box.getByRole('checkbox', { name: 'Guidance', exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  await cantrip(page, 'Guidance').check()
  await expect(nextButton(page)).toBeDisabled()
  await cantrip(page, 'Sacred Flame').check()
  await expect(nextButton(page)).toBeEnabled()

  for (let i = 0; i < 8; i++) {
    const step = (await page.locator('[aria-current="step"]').textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/Spells/.test(step)) await fillSpells(page)
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: 'Level 2 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(page.locator('[aria-current="step"]')).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 2' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)

  expect((await stored(page))['fightingStyles']).toEqual([
    { className: 'Paladin', classSource: XPHB, name: 'Blessed Warrior', source: XPHB, filterChoiceSpells: { cantrips: refs('Guidance', 'Sacred Flame'), spells: [] } },
  ])
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Guidance')).toHaveCount(1)
  await expect(spellRow(page, 'Sacred Flame')).toContainText('Blessed Warrior')
  await expect(spellRow(page, 'Sacred Flame').locator('.sheet__action-to-hit')).toContainText('DC 13')
})

test('FS-1 c: Ranger 2 Edit swaps Archery for Druidic Warrior with two Druid cantrips (WIS); Edit reopens them', async ({ page }) => {
  await open(page, ranger2('fs1-ranger'))
  await editClassStep(page)
  await expect(chooseButton(page, 'Blessed Warrior')).toHaveCount(0)
  await chooseButton(page, 'Druidic Warrior').click()
  await expect(nextButton(page)).toBeDisabled()
  await cantrip(page, 'Guidance').check()
  await cantrip(page, 'Thorn Whip').check()
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)

  expect((await stored(page))['fightingStyles']).toEqual([
    { className: 'Ranger', classSource: XPHB, name: 'Druidic Warrior', source: XPHB, filterChoiceSpells: { cantrips: refs('Guidance', 'Thorn Whip'), spells: [] } },
  ])
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Guidance')).toContainText('Druidic Warrior')
  await expect(spellRow(page, 'Thorn Whip').locator('.sheet__action-to-hit')).toContainText('+5')

  await editClassStep(page)
  await expect(cantrip(page, 'Guidance')).toBeChecked()
  await expect(cantrip(page, 'Thorn Whip')).toBeChecked()
})
