import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, chooseLevelAsi, expectStep, next, nextButton, wizardNav } from './wizard.ts'

/* F-Q (D408): fixes from review Q. Characters seeded at schema 68. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const BLADE = [
  { name: 'Pact of the Blade', source: XPHB },
  { name: 'Improved Pact Weapon', source: 'XGE' },
  { name: 'Lifedrinker', source: XPHB },
]

function warlock9(id: string, invocations: { name: string; source: string }[], inventory: Record<string, unknown>[]) {
  return {
    schemaVersion: 68,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 9 }],
    abilityScores: { method: 'standardArray', scores: { strength: 16, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 10, charisma: 15 } },
    optionalFeatureChoices: [{ featureType: 'EI', choices: invocations }],
    inventory,
  }
}

/* A complete Warlock 3, so Edit and Level up can save it. */
function warlock3(id: string, subclass: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 68,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass, level: 3 }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { charisma: 2, constitution: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    classSkills: ['arcana', 'deception'],
    hitPointLevels: [
      { level: 2, kind: 'average', dieResult: 5 },
      { level: 3, kind: 'average', dieResult: 5 },
    ],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step']) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces']) }],
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

async function storedFirst(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' }).getByRole('region', { name: 'My Inventory' })
}

function actionRows(page: Page, label: string): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${label} breakdown`, exact: true }) })
}

const spellRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })

test('F-Q a: splitting a marked stack of Daggers leaves the mark on one row; only one attack gets the +1', async ({ page }) => {
  await open(page, warlock9('fq-a', BLADE, [{ name: 'Dagger', source: XPHB, quantity: 2, pactWeapon: true }]))
  const panel = await openManage(page)
  await panel.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  await panel.getByRole('button', { name: 'Equip Dagger', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Put down Dagger', exact: true })).toHaveCount(2)
  const toggles = panel.getByRole('button', { name: 'Pact weapon: Dagger', exact: true })
  await expect(toggles).toHaveCount(2)
  await expect(panel.locator('button[aria-pressed="true"]', { hasText: 'Pact weapon' })).toHaveCount(1)
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Actions' }).click()
  // STR +3, PB +4; Improved Pact Weapon +1 on the marked Dagger only.
  const toHit = actionRows(page, 'Dagger').getByRole('button', { name: 'Roll Dagger to hit' })
  await expect(toHit).toHaveCount(2)
  expect((await toHit.allInnerTexts()).sort()).toEqual(['+7', '+8'])
})

test('F-Q b1: without Improved Pact Weapon a Longbow has no Pact weapon toggle; a melee weapon has', async ({ page }) => {
  await open(page, warlock9('fq-b1', [{ name: 'Pact of the Blade', source: XPHB }], [{ name: 'Longbow', source: XPHB, quantity: 1 }, { name: 'Mace', source: XPHB, quantity: 1 }]))
  const panel = await openManage(page)
  await expect(panel.getByRole('button', { name: 'Pact weapon: Mace', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Pact weapon: Longbow', exact: true })).toHaveCount(0)
})

test('F-Q b2: with Improved Pact Weapon the Longbow has the toggle', async ({ page }) => {
  await open(page, warlock9('fq-b2', BLADE, [{ name: 'Longbow', source: XPHB, quantity: 1 }]))
  const panel = await openManage(page)
  await expect(panel.getByRole('button', { name: 'Pact weapon: Longbow', exact: true })).toBeVisible()
})

test('F-Q c: a Warlock 3 Genie with no kind is asked for it on level up to 4; Efreeti grants its rank 1-2 spells', async ({ page }) => {
  await open(page, warlock3('fq-c', 'The Genie'))
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Burning Hands')).toHaveCount(0)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Warlock 3 → 4', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const current = page.locator('[aria-current="step"]')
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await current.textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) break
    if (/Proficiencies/.test(step)) {
      await expect(nextButton(page)).toBeDisabled()
      await page.getByRole('group', { name: /^Genie Kind/ }).getByRole('radio', { name: 'Efreeti' }).check()
      await expect(nextButton(page)).toBeEnabled()
    }
    if (/Spells/.test(step)) await fillSpells(page)
    if (/ASI \/ Feat/.test(step)) await chooseLevelAsi(page, 4, 'charisma')
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: 'Level 4 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current).not.toHaveText(step)
  }
  expect(seen.some((step) => /Proficiencies/.test(step))).toBe(true)
  await wizardNav(page).getByRole('button', { name: 'Save level 4' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  expect((await storedFirst(page))['genieKind']).toBe('Efreeti')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Burning Hands')).not.toHaveCount(0)
  await expect(spellRow(page, 'Scorching Ray')).not.toHaveCount(0)
})

test('F-Q d: rolling a Lifedrinker weapon’s damage reminds to roll the 1d6 separately', async ({ page }) => {
  await open(page, warlock9('fq-d', BLADE, [{ name: 'Sickle', source: XPHB, quantity: 1, equipped: 'held', pactWeapon: true }]))
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByRole('button', { name: 'Roll Sickle damage', exact: true }).click()
  await expect(page.locator('.roll-toast__note')).toHaveText('+ 1d6 Lifedrinker (roll separately)')
})

test('F-Q e: removing Pact of the Blade in Edit clears the stored pact weapon mark', async ({ page }) => {
  await open(
    page,
    warlock3('fq-e', 'Fiend Patron', {
      optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Pact of the Blade', 'Armor of Shadows', "Devil's Sight"]) }],
      inventory: [{ name: 'Dagger', source: XPHB, quantity: 1, pactWeapon: true }],
    }),
  )
  await page.getByRole('button', { name: 'Edit character' }).click()
  await page.getByRole('navigation', { name: 'Wizard steps' }).getByRole('button', { name: /Eldritch Invocations/ }).click()
  await expectStep(page, 'Eldritch Invocations')
  const toggle = page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
  await chooseButton(page, 'Pact of the Blade').click()
  await chooseButton(page, 'Mask of Many Faces').click()
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  const stored = await storedFirst(page)
  expect(JSON.stringify(stored['optionalFeatureChoices'])).not.toContain('Pact of the Blade')
  expect((stored['inventory'] as Record<string, unknown>[]).some((row) => 'pactWeapon' in row)).toBe(false)
})

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
