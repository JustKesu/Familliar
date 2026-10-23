import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, featOption, levelCard, next, openLevelCard } from './wizard.ts'

/* F-B1 (D379). Seeded at schema 62. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const LESSONS = { featureType: 'EI', choices: [{ name: 'Lessons of the First Ones', source: XPHB, level: 2 }] }

function warlock(id: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 62,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: level >= 3 ? 'Fiend Patron' : null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Darkness']) }],
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

const featRow = (mine: Locator, name: string): Locator =>
  mine.locator('.manage-spells__row').filter({ has: mine.page().locator('.manage-spells__name').getByText(name, { exact: true }) })

test('F-B1 a: a Warlock whose Lessons feat is Alert is not offered Alert again at the ASI level of Edit Character', async ({ page }) => {
  await open(
    page,
    warlock('fb1-a', 4, {
      optionalFeatureChoices: [{ featureType: 'EI', choices: [...LESSONS.choices, { name: 'Agonizing Blast', source: XPHB, level: 2 }, { name: 'Armor of Shadows', source: XPHB, level: 2 }] }],
      grantedFeats: [{ origin: 'invocation', id: 'lot1', name: 'Alert', source: XPHB }],
    }),
  )
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  for (let steps = 0; steps < 12 && !(await levelCard(page, 4).isVisible()); steps++) await next(page)
  await openLevelCard(page, 4)
  const alert = featOption(page, 4, 'Alert')
  await expect(alert).toHaveJSProperty('disabled', true)
  await expect(alert).toHaveText('Alert · XPHB (already taken)')
})

test('F-B1 b: clearing the Lessons feat removes the sleeping one too — the slot is pending, nothing comes back', async ({ page }) => {
  await open(
    page,
    warlock('fb1-b', 2, {
      optionalFeatureChoices: [LESSONS],
      grantedFeats: [
        { origin: 'invocation', id: 'lot1', name: 'Tough', source: XPHB },
        { origin: 'invocation', id: 'lot2', name: 'Alert', source: XPHB },
      ],
    }),
  )
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const mine = page.getByRole('dialog', { name: 'Manage Feats' }).getByRole('region', { name: 'My Feats' })
  await featRow(mine, 'Tough').getByRole('button', { name: 'Clear Tough' }).click()
  await expect(featRow(mine, 'Tough')).toHaveCount(0)
  await expect(featRow(mine, 'Alert')).toHaveCount(0)
  await expect(featRow(mine, 'Origin feat').getByRole('combobox', { name: 'Lessons of the First Ones feat' })).toHaveValue('')
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].grantedFeats, STORAGE_KEY)).toBeUndefined()
})

test('F-B1 c: Thirsting Blade only from a custom item on a Pact of the Blade Warlock — Attacks per Action 2', async ({ page }) => {
  const ring = { name: 'Blade Ring', source: 'custom', quantity: 1, custom: { name: 'Blade Ring', kind: 'other', invocations: [{ name: 'Thirsting Blade', source: XPHB }] } }
  await open(
    page,
    warlock('fb1-c', 5, {
      optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows', 'Mask of Many Faces', 'Eldritch Mind']) }],
      inventory: [ring],
    }),
  )
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.locator('.sheet__actions-per-action').locator('strong')).toHaveText('2')
})

async function blastEffect(page: Page): Promise<string> {
  await page.getByRole('tab', { name: 'Spells' }).click()
  const row = page
    .getByRole('tabpanel', { name: 'Spells' })
    .locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Eldritch Blast$/ }) })
  return (await row.locator('.sheet__spell-effect').innerText()).trim()
}

test('F-B1 d: Agonizing Blast adds the modifier on the Warlock row only, not on a Wizard-learned Eldritch Blast', async ({ page }) => {
  const ring = { name: 'Blast Ring', source: 'custom', quantity: 1, custom: { name: 'Blast Ring', kind: 'other', invocations: [{ name: 'Agonizing Blast', source: XPHB }] } }
  const wizard = {
    ...warlock('fb1-d', 5),
    classes: [{ className: 'Wizard', classSource: XPHB, subclass: null, level: 5 }],
    levelOrder: Array.from({ length: 5 }, () => ({ className: 'Wizard', classSource: XPHB })),
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 } },
    classSkills: ['arcana', 'history'],
    spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Eldritch Blast', 'Fire Bolt', 'Mage Hand']) }],
    inventory: [ring],
  }
  await open(page, wizard)
  const effect = await blastEffect(page)
  expect(effect).toContain('1d10')
  expect(effect).not.toContain('+')
})

test('F-B1 d2: the Warlock row keeps 1d10 + 3', async ({ page }) => {
  await open(page, warlock('fb1-d2', 5, { optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast', source: XPHB, level: 2 }] }] }))
  expect(await blastEffect(page)).toContain('1d10 + 3')
})
