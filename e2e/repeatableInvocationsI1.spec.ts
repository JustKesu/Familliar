import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, wizardNav } from './wizard.ts'

/* I-1 (D382): repeatable invocations, count only. Seeded at schema 63. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const LESSONS = 'Lessons of the First Ones'

function warlock(id: string, level: number, invocations: { name: string; source: string; level?: number }[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 63,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: level >= 3 ? 'Fiend Patron' : null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    ...(level >= 4 ? { featAsiChoices: [{ level: 4, kind: 'asi', increases: { dexterity: 2 } }] } : {}),
    classSkills: ['arcana', 'deception'],
    spellChoices: [
      {
        className: 'Warlock',
        classSource: XPHB,
        spells: refs(level >= 4 ? ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Spider Climb'] : ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys']),
      },
    ],
    optionalFeatureChoices: [{ featureType: 'EI', choices: invocations }],
    ...extra,
  }
}

async function open(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
}

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const review = (page: Page): Locator => page.getByRole('region', { name: 'Review' })
const classOptionsText = (page: Page): Locator => review(page).locator('section[aria-label="Class options"] .review__text')
const takeAgain = (page: Page, name: string): Locator => page.getByRole('button', { name: `Take ${name} again`, exact: true })

async function openInvocationList(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
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

async function openFeats(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' }).getByRole('region', { name: 'My Feats' })
}

const featRow = (mine: Locator, name: string): Locator =>
  mine.locator('.manage-spells__row').filter({ has: mine.page().locator('.manage-spells__name').getByText(name, { exact: true }) })

const storedInvocations = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].optionalFeatureChoices.find((entry: { featureType: string }) => entry.featureType === 'EI').choices, STORAGE_KEY)

/** Levels the Warlock up by one and walks to Review; `onInvocations` runs on the Eldritch Invocations step, and returning true stops the walk there. */
async function levelUpTo(page: Page, from: number, onInvocations: () => Promise<boolean | void>): Promise<void> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: `Warlock ${from} → ${from + 1}`, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  for (let i = 0; i < 12; i++) {
    const step = (await currentStep(page).textContent()) ?? ''
    if (/Review and save/.test(step)) break
    if (/Spells/.test(step)) await fillSpells(page)
    if (/Eldritch Invocations/.test(step)) {
      await openInvocationList(page)
      if ((await onInvocations()) === true) return
    }
    if (/Hit points/.test(step)) {
      await page.getByRole('radiogroup', { name: `Level ${from + 1} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await wizardNav(page).getByRole('button', { name: 'Next', exact: true }).click()
    await expect(currentStep(page)).not.toHaveText(step)
  }
  await expectStep(page, 'Review and save')
}

test('I-1 a: Warlock 4 → 5 takes Lessons of the First Ones a second time; Manage Feats holds two Lessons feats', async ({ page }) => {
  const held = [{ name: LESSONS, source: XPHB, level: 2 }, ...refs(['Armor of Shadows', "Devil's Sight"])]
  await open(page, warlock('i1-a', 4, held, { grantedFeats: [{ origin: 'invocation', id: 'lot1', name: 'Alert', source: XPHB }] }))
  await levelUpTo(page, 4, async () => {
    await takeAgain(page, LESSONS).click()
    await chooseButton(page, 'Mask of Many Faces').click()
    await expect(page.getByText('5 / 5 · FULL')).toBeVisible()
    await expect(takeAgain(page, LESSONS)).toBeDisabled()
  })

  const added = review(page).locator('section[aria-label="Level 5 — What\'s new"] .review__row', { hasText: 'Options added' })
  await expect(added.locator('.review__text')).toHaveText(`${LESSONS}, Mask of Many Faces`)
  await expect(classOptionsText(page)).toHaveText(`Armor of Shadows, Devil's Sight, ${LESSONS} (x2), Mask of Many Faces`)
  await wizardNav(page).getByRole('button', { name: 'Save level 5' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  const lessons = (await storedInvocations(page)).filter((choice: { name: string }) => choice.name === LESSONS)
  expect(lessons).toEqual([{ name: LESSONS, source: XPHB, level: 2 }, { name: LESSONS, source: XPHB, level: 5 }])

  const mine = await openFeats(page)
  await expect(featRow(mine, 'Alert')).toContainText('From Lessons of the First Ones')
  const pending = featRow(mine, 'Origin feat')
  await expect(pending).toContainText('From Lessons of the First Ones')
  await pending.getByRole('combobox', { name: 'Lessons of the First Ones feat' }).selectOption({ label: 'Tough' })
  await expect(featRow(mine, 'Tough')).toContainText('From Lessons of the First Ones')
  await expect(featRow(mine, 'Alert')).toContainText('From Lessons of the First Ones')
  await expect(featRow(mine, 'Origin feat')).toHaveCount(0)
  await expect(mine.getByRole('button', { name: /^Remove (Alert|Tough)$/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' })).toContainText(`${LESSONS} (x2)`)
})

test('I-1 b: Agonizing Blast held twice still adds Charisma to Eldritch Blast once', async ({ page }) => {
  const twice = [{ name: 'Agonizing Blast', source: XPHB, level: 2 }, { name: 'Agonizing Blast', source: XPHB, level: 5 }, ...refs(['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces'])]
  await open(page, warlock('i1-b', 5, twice))
  await page.getByRole('tab', { name: 'Actions' }).click()
  const actionRow = page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: 'Eldritch Blast breakdown', exact: true }) })
  await expect(actionRow.locator('.sheet__action-damage')).toHaveText(/^1d10 \+ 3\b/)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' })).toContainText('Agonizing Blast (x2)')
})

test('I-1 c: a non-repeatable invocation offers no second copy; a repeatable one does until the slots are full', async ({ page }) => {
  await open(page, warlock('i1-c', 4, refs(['Eldritch Mind', 'Agonizing Blast', 'Armor of Shadows'])))
  await levelUpTo(page, 4, async () => {
    await expect(chooseButton(page, 'Eldritch Mind')).toHaveAttribute('aria-pressed', 'true')
    await expect(chooseButton(page, 'Eldritch Mind')).toBeDisabled()
    await expect(takeAgain(page, 'Eldritch Mind')).toHaveCount(0)
    await expect(page.getByText('3 / 5')).toBeVisible()

    await takeAgain(page, 'Agonizing Blast').click()
    await expect(page.getByText('4 / 5')).toBeVisible()
    await expect(page.locator('.choice-row', { has: chooseButton(page, 'Agonizing Blast') })).toContainText('Agonizing Blast (x2)')
    await page.getByRole('button', { name: 'Remove one Agonizing Blast', exact: true }).click()
    await expect(page.getByText('3 / 5')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove one Agonizing Blast', exact: true })).toHaveCount(0)
    return true
  })
})

test('I-1 d: Warlock 1 → 2 takes Lessons twice in one walk; the wizard Review lists Lessons of the First Ones (x2)', async ({ page }) => {
  await open(page, warlock('i1-d', 1, refs(['Armor of Shadows'])))
  await levelUpTo(page, 1, async () => {
    await chooseButton(page, LESSONS).click()
    await takeAgain(page, LESSONS).click()
    await expect(page.getByText('3 / 3 · FULL')).toBeVisible()
  })
  await expect(classOptionsText(page)).toHaveText(`Armor of Shadows, ${LESSONS} (x2)`)
  await wizardNav(page).getByRole('button', { name: 'Save level 2' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  const lessons = (await storedInvocations(page)).filter((choice: { name: string }) => choice.name === LESSONS)
  expect(lessons).toEqual([{ name: LESSONS, source: XPHB, level: 2 }, { name: LESSONS, source: XPHB, level: 2 }])
})
