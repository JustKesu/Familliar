import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, nextButton, select, takeStartingEquipment, wizardNav } from './wizard.ts'

/* GN-1 (D407): The Genie's kind picks which expanded spells are granted; Wish ("9") never is. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const genieGroup = (page: Page): Locator => page.getByRole('group', { name: /^Genie Kind/ })
const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellRow = (page: Page, name: string): Locator =>
  panel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })

async function storedAll(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)
}

async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    if ((await counter.count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
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

function genieWarlock(id: string, schemaVersion: number, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: 'The Genie', level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Hex']) }],
    ...extra,
  }
}

test('GN-1 a, b: a new Warlock 3 Genie picks Djinni (Thunderwave); Edit switches to Marid (Fog Cloud, no Thunderwave)', async ({ page }) => {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await page.getByLabel('Character name').fill('Genie Warlock')
  await select(page, 'Class').selectOption('Warlock|XPHB')
  await select(page, 'Level').selectOption('3')
  await page.getByRole('checkbox', { name: 'Arcana', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Deception', exact: true }).check()
  await chooseButton(page, 'The Genie', 'TCE').click()
  await next(page)

  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('charisma')
  await select(page, '+1').selectOption('wisdom')
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await expect(nextButton(page)).toBeDisabled()
  await genieGroup(page).getByRole('radio', { name: 'Djinni' }).check()
  await expect(nextButton(page)).toBeEnabled()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '8'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '10'], ['Wisdom', '12'], ['Charisma', '15']] as const) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)
  await expectStep(page, 'Spells')
  await fillSpells(page)
  await next(page)
  await expectStep(page, 'Eldritch Invocations')
  const toggle = page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
  for (const name of ["Devil's Sight", 'Armor of Shadows', 'Mask of Many Faces']) await chooseButton(page, name).click()
  await next(page)
  await expectStep(page, 'Hit points')
  await page.getByRole('button', { name: /Use the average/ }).click()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  expect((await storedAll(page))[0]!['genieKind']).toBe('Djinni')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Thunderwave')).toHaveCount(1)
  await expect(spellRow(page, 'Fog Cloud')).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 6 && !(await page.locator('[aria-current="step"]').textContent())?.includes('Proficiencies'); steps++) await next(page)
  await expectStep(page, 'Proficiencies')
  await expect(genieGroup(page).getByRole('radio', { name: 'Djinni' })).toBeChecked()
  await genieGroup(page).getByRole('radio', { name: 'Marid' }).check()
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  expect((await storedAll(page))[0]!['genieKind']).toBe('Marid')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Fog Cloud')).toHaveCount(1)
  await expect(spellRow(page, 'Thunderwave')).toHaveCount(0)
})

test('GN-1 e: Warlock 2 → 3 taking The Genie asks for the kind on Proficiencies; Efreeti grants Burning Hands', async ({ page }) => {
  const warlock = genieWarlock('gn1-e', 68, 2, {
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 2 }],
    createdAtLevel: 2,
    hitPointLevels: [{ level: 2, kind: 'average', dieResult: 5 }],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Charm Person']) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces']) }],
  })
  await openSheet(page, warlock)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Warlock 2 → 3', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const current = page.locator('[aria-current="step"]')
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await current.textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) break
    if (/Class/.test(step)) await chooseButton(page, 'The Genie', 'TCE').click()
    if (/Proficiencies/.test(step)) {
      await expect(nextButton(page)).toBeDisabled()
      await genieGroup(page).getByRole('radio', { name: 'Efreeti' }).check()
    }
    if (/Spells/.test(step)) await fillSpells(page)
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: 'Level 3 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current).not.toHaveText(step)
  }
  expect(seen.some((step) => /Proficiencies/.test(step))).toBe(true)
  await wizardNav(page).getByRole('button', { name: 'Save level 3' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  expect((await storedAll(page))[0]!['genieKind']).toBe('Efreeti')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Burning Hands')).toHaveCount(1)
})

test('GN-1 f: Remove level 3 lists and drops the Genie kind with the subclass', async ({ page }) => {
  await openSheet(page, genieWarlock('gn1-f', 68, 3, { createdAtLevel: 1, genieKind: 'Efreeti' }))
  await page.getByRole('button', { name: 'Remove level 3', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 3?' })
  await expect(dialog.locator('li', { hasText: 'Genie kind: Efreeti' })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await storedAll(page))[0]!['genieKind']).toBeUndefined()
})

test('GN-1 c: a schema-67 Genie character loads with no kind, no Genie spells and the not-chosen note', async ({ page }) => {
  await openSheet(page, genieWarlock('gn1-c', 67, 3))
  await expect(panel(page)).toContainText('Genie kind not chosen yet')
  await expect(spellRow(page, 'Detect Evil and Good')).toHaveCount(0)
  expect((await storedAll(page))[0]!['genieKind']).toBeUndefined()
})

test('GN-1 d: a Warlock 17 Genie (Efreeti) has its rank 1-5 spells but no Wish', async ({ page }) => {
  await openSheet(page, genieWarlock('gn1-d', 68, 17, { genieKind: 'Efreeti' }))
  await expect(spellRow(page, 'Flame Strike')).toHaveCount(1)
  await expect(spellRow(page, 'Wish')).toHaveCount(0)
  await expect(panel(page)).not.toContainText('Genie kind not chosen yet')
})
