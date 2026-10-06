import { expect, test, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, finishFromBackground, next, nextButton, select, takeStartingEquipment, wizardNav } from './wizard.ts'

/* F-1: fixes from the W-1 to W-4 code review (D251, D252). */

const STORAGE_KEY = 'familliar:characters'

async function storedCharacter(page: Page): Promise<Record<string, unknown> & { classes: { subclass?: string | null }[] }> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

async function speciesAndBackground(page: Page): Promise<void> {
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('wisdom')
  await select(page, '+1').selectOption('intelligence')
}

test('F-1 a (D251): a new Fighter 3 Battle Master lowered to level 1 saves without subclass or maneuvers', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Lowered Master')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('3')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await chooseButton(page, 'Battle Master').click()
  for (const maneuver of ['Trip Attack', 'Riposte', 'Parry']) await chooseButton(page, maneuver).first().click()
  await expect(nextButton(page)).toBeEnabled()

  await select(page, 'Level').selectOption('1')
  await expect(nextButton(page)).toBeEnabled()
  await expect(chooseButton(page, 'Battle Master')).toHaveCount(0)
  await next(page)
  await speciesAndBackground(page)
  await finishFromBackground(page, { name: 'Lowered Master', level: 1, species: 'Dwarf|XPHB' })

  const stored = await storedCharacter(page)
  expect(stored.classes[0]!.subclass ?? null).toBeNull()
  expect((stored.optionalFeatureChoices as unknown[] | undefined) ?? []).toEqual([])
  expect(stored.fightingStyles).toEqual([{ className: 'Fighter', classSource: 'XPHB', name: 'Defense', source: expect.any(String) }])
})

test('F-1 b (D251): a new Paladin 2 with a fighting style lowered to level 1 saves without it', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Lowered Paladin')
  await select(page, 'Class').selectOption('Paladin|XPHB')
  await select(page, 'Level').selectOption('2')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Persuasion', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await expect(nextButton(page)).toBeEnabled()

  await select(page, 'Level').selectOption('1')
  await expect(nextButton(page)).toBeEnabled()
  await expect(chooseButton(page, 'Defense')).toHaveCount(0)
  await next(page)
  await speciesAndBackground(page)
  await next(page)

  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '15'], ['Dexterity', '8'], ['Constitution', '13'], ['Intelligence', '10'], ['Wisdom', '12'], ['Charisma', '14']]) {
    await select(page, ability!).selectOption({ label: score! })
  }
  await next(page)
  await expectStep(page, 'Spells')
  const prepare = page.getByRole('region', { name: 'Add Spells' }).getByRole('button', { name: /^Prepare / })
  await prepare.first().click()
  await prepare.first().click()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  expect((await storedCharacter(page)).fightingStyles ?? null).toBeNull()
})

test('F-1 d: Esc in the Remove level dialog closes only the dialog, not an open drawer', async ({ page }) => {
  await createFighter(page, { name: 'Drawer Esc', level: 1, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 2' }).click()
  await page.getByRole('radio', { name: /^Average/ }).check()
  await next(page)
  await wizardNav(page).getByRole('button', { name: 'Save level 2' }).click()

  await page.locator('.sheet__status-conditions').getByRole('button', { name: '+ Add condition' }).click()
  const drawer = page.getByRole('dialog', { name: 'Conditions' })
  await expect(drawer).toBeVisible()

  await page.getByRole('button', { name: 'Remove level 2' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 2?' })
  const focusInDialog = page.locator('[role="alertdialog"]:focus, [role="alertdialog"] :focus')
  await dialog.getByText('Choices made at this level will be lost.').click()
  await expect(focusInDialog).toHaveCount(1)
  await page.keyboard.press('Tab')
  await expect(focusInDialog).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove level 2' })).toBeVisible()
})

test('F-1 finding 2: a failed optional-features load still demands the class skills', async ({ page }) => {
  await page.route('**/data/optional-features.json', (route) => route.abort())
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Half Loaded')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('3')
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
  await chooseButton(page, 'Battle Master').click()
  await expect(page.getByText(/Could not load options/)).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  await expect(nextButton(page)).toBeEnabled()
})

test('F-1 finding 6: of two same-named subclasses only the chosen book reads CHOSEN', async ({ page }) => {
  await page.goto('/#/new')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('3')
  await chooseButton(page, 'Champion').click()
  await expect(page.locator('.subclass-picker [aria-pressed="true"]')).toHaveCount(1)
  await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'true')
})

const WARLOCK_BASE = {
  schemaVersion: 48,
  classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Fiend Patron', level: 3 }],
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
  species: { name: 'Dwarf', source: 'XPHB' },
  background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  abilityBonus: { charisma: 2, constitution: 1 },
  languages: [
    { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
    { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
  ],
  classSkills: ['arcana', 'deception'],
}

async function openInvocations(page: Page, id: string, cantrips: string[], invocations: string[]): Promise<void> {
  const warlock = {
    ...WARLOCK_BASE,
    id,
    name: id,
    spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: [...cantrips, 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step'].map((name) => ({ name, source: 'XPHB' })) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: invocations.map((name) => ({ name })) }],
  }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([warlock]) },
  )
  await page.goto(`/#/character/${id}`)
  await page.getByRole('button', { name: 'Edit character' }).click()
  await page.getByRole('navigation', { name: 'Wizard steps' }).getByRole('button', { name: /Eldritch Invocations/ }).click()
  await expectStep(page, 'Eldritch Invocations')
}

test('F-1 finding 5: a CHOSEN invocation that no longer qualifies shows why', async ({ page }) => {
  await openInvocations(page, 'f1-reason', ['Mage Hand', 'Minor Illusion'], ['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows'])
  await page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false }).click()
  const row = page.locator('.choice-row', { has: chooseButton(page, 'Agonizing Blast') })
  await expect(chooseButton(page, 'Agonizing Blast')).toHaveText('Chosen')
  await expect(row.locator('.choice-row__reason')).toBeVisible()
})

test('F-1 finding 7: a full, collapsed invocation list still shows the Pact of the Tome spell pick', async ({ page }) => {
  await openInvocations(page, 'f1-tome', ['Eldritch Blast', 'Minor Illusion'], ['Pact of the Tome', 'Agonizing Blast', 'Armor of Shadows'])
  await expect(page.getByRole('button', { name: /^Eldritch Invocations/ })).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText(/^0 of \d+ cantrips chosen\.$/)).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
})

test('F-1 e (finding 9): Edit Character and level up — Cancel without changes leaves without a dialog', async ({ page }) => {
  await createFighter(page, { name: 'Quiet Cancel', level: 1, species: 'Dwarf|XPHB' })

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await expect(page.getByText('Fighting style chosen.')).toBeVisible()
  await expect(nextButton(page)).toBeEnabled()
  await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Quiet Cancel' })).toBeVisible()

  await page.getByRole('button', { name: 'Level up to 2' }).click()
  await expectStep(page, 'Hit points')
  await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Level up to 2' })).toBeVisible()
})
