import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, select, takeStartingEquipment, wizardNav } from './wizard.ts'

/* B-5 (D378): the Review step's Class options card and the What's new "Options added" row. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const classOptionsCard = (page: Page): Locator => page.getByRole('region', { name: 'Review' }).locator('section[aria-label="Class options"]')

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

async function openInvocationList(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
}

test('B-5 a: a new Warlock 2 shows its chosen invocations in the Review Class options card', async ({ page }) => {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await page.getByLabel('Character name').fill('Review Warlock')
  await select(page, 'Class').selectOption('Warlock|XPHB')
  await select(page, 'Level').selectOption('2')
  await page.getByRole('checkbox', { name: 'Arcana', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Deception', exact: true }).check()
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
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '8'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '10'], ['Wisdom', '12'], ['Charisma', '15']] as const) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)
  await expectStep(page, 'Spells')
  await fillSpells(page)
  await next(page)

  // EI progression: 3 invocations at Warlock 2 (classes.json).
  await expectStep(page, 'Eldritch Invocations')
  await openInvocationList(page)
  for (const name of ["Devil's Sight", 'Armor of Shadows', 'Mask of Many Faces']) await chooseButton(page, name).click()
  await next(page)
  await expectStep(page, 'Hit points')
  await page.getByRole('button', { name: /Use the average/ }).click()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)

  await expectStep(page, 'Review and save')
  const card = classOptionsCard(page)
  await expect(card.locator('.review__row')).toHaveCount(1)
  await expect(card.locator('.review__label')).toHaveText('Eldritch Invocations')
  await expect(card.locator('.review__text')).toHaveText("Armor of Shadows, Devil's Sight, Mask of Many Faces")
  await card.getByRole('button', { name: 'Class options' }).click()
  await expectStep(page, 'Eldritch Invocations')
})

test('B-5 b: Warlock 4 → 5 lists the two new invocations under Options added', async ({ page }) => {
  const id = 'b5-levelup'
  const warlock = {
    schemaVersion: 62,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: 'Fiend Patron', level: 4 }],
    levelOrder: Array.from({ length: 4 }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: 4,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Spider Climb']) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]) }],
  }
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([warlock]) },
  )
  await page.goto(`/#/character/${id}`)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Warlock 4 → 5', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)

  for (let i = 0; i < 12; i++) {
    const step = (await currentStep(page).textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/Spells/.test(step)) await fillSpells(page)
    if (/Eldritch Invocations/.test(step)) {
      await openInvocationList(page)
      await chooseButton(page, 'Pact of the Blade').click()
      await chooseButton(page, 'Mask of Many Faces').click()
    }
    if (/Hit points/.test(step)) {
      await page.getByRole('radiogroup', { name: 'Level 5 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await wizardNav(page).getByRole('button', { name: 'Next', exact: true }).click()
    await expect(currentStep(page)).not.toHaveText(step)
  }

  await expectStep(page, 'Review and save')
  const added = page.getByRole('region', { name: 'Review' }).locator('section[aria-label="Level 5 — What\'s new"] .review__row', { hasText: 'Options added' })
  await expect(added.locator('.review__text')).toHaveText('Mask of Many Faces, Pact of the Blade')
  await expect(classOptionsCard(page).locator('.review__text')).toHaveText("Agonizing Blast, Armor of Shadows, Devil's Sight, Mask of Many Faces, Pact of the Blade")
})

test('B-5 c: a Fighter without class options has no Class options card', async ({ page }) => {
  await createFighter(page, { name: 'No Options', level: 1, species: 'Dwarf|XPHB', stopAtReview: true })
  await expect(page.getByRole('region', { name: 'Review' }).locator('section[aria-label="Ability scores"]')).toBeVisible()
  await expect(classOptionsCard(page)).toHaveCount(0)
})
