import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, next, wizardNav } from './wizard.ts'

/* F-10: fixes from the M5 to M7 review. Seeded at schema 60 with a consistent levelOrder, as an import or the app itself would store them. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

// WIS 14 (+2), CHA 16 (+3); every two-class scenario here is character level 6, proficiency bonus +3.
const CASTER_SCORES = { strength: 10, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 14, charisma: 16 }
// INT 15 (+2) and WIS 12 (+1): Wizard DC 13, Cleric DC 12.
const WIZARD_CLERIC_SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }

interface Held {
  className: string
  subclass: string | null
  level: number
}

function build(id: string, held: Held[], extra: Record<string, unknown> = {}, scores: Record<string, number> = CASTER_SCORES) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: held.map(({ className, subclass, level }) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: held.flatMap(({ className, level }) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    ...extra,
  }
}

async function open(page: Page, character: { id: string }, tab?: string): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  if (tab) await page.getByRole('tab', { name: tab }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => panel(page).getByRole('region', { name: label, exact: true })
const rows = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const withSubtitle = (scope: Locator, text: string): Locator => scope.filter({ has: scope.page().locator('.sheet__action-subtitle', { hasText: new RegExp(`^${text}\\b`) }) })
const actionRows = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })

test('F-10 a (finding 1): Wizard 5 / Fighter 3 Battle Master — the Student of War tool shows on the Proficiencies card, nothing is pending', async ({ page }) => {
  const held: Held[] = [
    { className: 'Wizard', subclass: null, level: 5 },
    { className: 'Fighter', subclass: 'Battle Master', level: 3 },
  ]
  await open(page, build('f10-a', held, { toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }] }))
  const card = page.locator('.sheet__proficiencies')
  await expect(card).toContainText("Smith's Tools")
  await expect(card).not.toContainText('not chosen')
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).toContainText("Smith's Tools — Battle Master")
})

test('F-10 a2 (finding 1): the same character without a stored tool shows the pending line of the second class', async ({ page }) => {
  const held: Held[] = [
    { className: 'Wizard', subclass: null, level: 5 },
    { className: 'Fighter', subclass: 'Battle Master', level: 3 },
  ]
  await open(page, build('f10-a2', held))
  await expect(page.locator('.sheet__proficiencies')).toContainText("1 artisan's tool (Battle Master) — not chosen")
})

test('F-10 b (finding 2): Cleric 3 Light Domain / Warlock 3 Fiend Patron — Burning Hands is two rows with a WIS and a CHA save DC, on Spells and on Actions', async ({ page }) => {
  const held: Held[] = [
    { className: 'Cleric', subclass: 'Light Domain', level: 3 },
    { className: 'Warlock', subclass: 'Fiend Patron', level: 3 },
  ]
  await open(page, build('f10-b', held), 'Spells')
  const burning = rows(section(page, '1st Level'), 'Burning Hands')
  await expect(burning).toHaveCount(2)
  // Cleric: 8 + PB 3 + WIS 2 = 13; Warlock: 8 + PB 3 + CHA 3 = 14.
  await expect(withSubtitle(burning, 'Light Domain').locator('.sheet__action-to-hit')).toContainText('DC 13 DEX')
  await expect(withSubtitle(burning, 'Fiend Patron').locator('.sheet__action-to-hit')).toContainText('DC 14 DEX')
  await expect(page.getByText('could belong to more than one casting class', { exact: false })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Actions' }).click()
  const actions = actionRows(page, 'Burning Hands')
  await expect(actions).toHaveCount(2)
  await expect(actions.filter({ hasText: 'DC 13 DEX' })).toHaveCount(1)
  await expect(actions.filter({ hasText: 'DC 14 DEX' })).toHaveCount(1)
})

const WIZARD_CLERIC: Held[] = [
  { className: 'Wizard', subclass: null, level: 3 },
  { className: 'Cleric', subclass: 'Light Domain', level: 3 },
]
const wizardClericWithPick = () => build('f10-c', WIZARD_CLERIC, { spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(['Burning Hands']) }] }, WIZARD_CLERIC_SCORES)

test('F-10 c (finding 3): Wizard 3 / Cleric 3 Light Domain with Burning Hands picked by the Wizard — two rows with the INT and the WIS DC, the Wizard pick still counts once', async ({ page }) => {
  await open(page, wizardClericWithPick(), 'Spells')
  const burning = rows(section(page, '1st Level'), 'Burning Hands')
  await expect(burning).toHaveCount(2)
  // Wizard 8 + PB 3 + INT 2 = 13, Cleric 8 + 3 + WIS 1 = 12.
  await expect(withSubtitle(burning, 'Wizard').locator('.sheet__action-to-hit')).toContainText('DC 13 DEX')
  await expect(withSubtitle(burning, 'Light Domain').locator('.sheet__action-to-hit')).toContainText('DC 12 DEX')
  await expect(panel(page).locator('.sheet__spell-count-over')).toHaveCount(0)

  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const wizard = page.getByRole('dialog', { name: 'Manage Spells' }).locator('summary', { hasText: /^Wizard$/ }).locator('..')
  await expect(wizard.locator('.manage-spells__counter', { hasText: /^Prepared:/ })).toHaveText(/^Prepared: 1\/\d+$/)
})

test('F-10 d (finding 3): Manage Spells — the Wizard list marks Burning Hands "Already prepared by Cleric"', async ({ page }) => {
  await open(page, wizardClericWithPick(), 'Spells')
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
  const wizard = drawer.locator('summary', { hasText: /^Wizard$/ }).locator('..')
  await wizard.getByRole('searchbox', { name: 'Search Wizard spells' }).fill('Burning Hands')
  const row = wizard.getByRole('region', { name: 'Add Spells' }).locator('.manage-spells__row', { hasText: 'Burning Hands' })
  await expect(row.locator('.manage-spells__note')).toHaveText('Already prepared by Cleric')
  // The Cleric's own list has no such notice for a spell it prepares itself.
  const cleric = drawer.locator('summary', { hasText: /^Cleric$/ }).locator('..')
  await cleric.getByRole('searchbox', { name: 'Search Cleric spells' }).fill('Burning Hands')
  await expect(cleric.getByRole('region', { name: 'Add Spells' }).locator('.manage-spells__note')).toHaveCount(0)
})

const WARLOCK_SORCERER: Held[] = [
  { className: 'Warlock', subclass: 'Fiend Patron', level: 6 },
  { className: 'Sorcerer', subclass: null, level: 3 },
]

test('F-10 e (finding 7): Warlock 6 / Sorcerer 3 — a chosen invocation on Actions carries the Warlock label', async ({ page }) => {
  await open(page, build('f10-e', WARLOCK_SORCERER, { optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows']) }] }), 'Actions')
  const row = page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__group-row', { has: page.locator('.sheet__group-row-name', { hasText: /^Pact of the Blade$/ }) })
  await expect(row.locator('.sheet__group-row-source')).toHaveText('Warlock')
})

test('F-10 e2 (finding 7): an ASI feat of the second class reads "From Sorcerer n" on the Features tab', async ({ page }) => {
  const feats = [{ level: 8, kind: 'feat', name: 'Alert', source: XPHB }]
  await open(page, build('f10-e2', [{ className: 'Warlock', subclass: 'Fiend Patron', level: 3 }, { className: 'Sorcerer', subclass: null, level: 5 }], { featAsiChoices: feats }), 'Features & Traits')
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' }).locator('.sheet__feature-origin', { hasText: 'From Sorcerer 5' })).toHaveCount(1)
})

test('F-10 f (known point a): CAST is disabled on an unavailable row — the Sorcerer 3’s over-cap Fireball', async ({ page }) => {
  // No patron: Fiend Patron would always prepare Fireball too, which is a second, available row.
  const plain: Held[] = [
    { className: 'Warlock', subclass: null, level: 6 },
    { className: 'Sorcerer', subclass: null, level: 3 },
  ]
  await open(page, build('f10-f', plain, { spellChoices: [{ className: 'Sorcerer', classSource: XPHB, spells: refs(['Fireball']) }] }), 'Spells')
  const fireball = rows(section(page, '3rd Level'), 'Fireball')
  await expect(fireball.locator('.sheet__action-subtitle')).toContainText('Unavailable at this level')
  const cast = fireball.getByRole('button', { name: /^Cast Fireball/ })
  await expect(cast.first()).toBeDisabled()
  for (const button of await cast.all()) await expect(button).toBeDisabled()
})

test('F-10 g (finding 8): Warlock 3 invocations and Fighter 4 Battle Master maneuvers each keep their own picks after a Fighter level up', async ({ page }) => {
  const held: Held[] = [
    { className: 'Warlock', subclass: 'Fiend Patron', level: 3 },
    { className: 'Fighter', subclass: 'Battle Master', level: 4 },
  ]
  const character = build('f10-g', held, {
    optionalFeatureChoices: [
      { featureType: 'EI', choices: [{ name: 'Pact of the Blade' }, { name: 'Agonizing Blast' }, { name: 'Armor of Shadows' }] },
      { featureType: 'MV:B', choices: [{ name: 'Parry' }, { name: 'Riposte' }, { name: 'Rally' }] },
    ],
    toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
  })
  await open(page, character)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 4 → 5', exact: true }).click()
  await expectStep(page, 'Hit points')
  await page.getByRole('radiogroup', { name: 'Level 8 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: /^Save level/ }).click()
  await expect(page).toHaveURL(/#\/character\/f10-g$/)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  const invocations = features.locator('.sheet__feature-options').filter({ hasText: 'Agonizing Blast' })
  for (const name of ['Pact of the Blade', 'Armor of Shadows']) await expect(invocations).toContainText(name)
  const maneuvers = features.locator('.sheet__feature-options').filter({ hasText: 'Riposte' })
  for (const name of ['Parry', 'Rally']) await expect(maneuvers).toContainText(name)
  await expect(invocations).not.toContainText('Riposte')
  await expect(maneuvers).not.toContainText('Agonizing Blast')
})
