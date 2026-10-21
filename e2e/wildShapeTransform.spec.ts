import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-40 (D364): Transform on a Wild Shape row spends a Wild Shape use and grants temporary hit points. Seeded at schema 61 like multiclassEndToEnd.spec.ts's Druid. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const forms = (names: string[]) => [{ className: 'Druid', classSource: XPHB, forms: names.map((name) => ({ name, source: 'XMM' })) }]
const DRUID_PICKS = ['Entangle', 'Faerie Fire', 'Goodberry', 'Healing Word', 'Thunderwave', 'Animal Friendship']

function druid(id: string, level: number, subclass: string | null, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className: 'Druid', classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Druid', classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 13, constitution: 14, intelligence: 10, wisdom: 15, charisma: 12 } },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    classSkills: ['nature', 'perception'],
    classFeatureChoices: [{ className: 'Druid', classSource: XPHB, featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Warden' }],
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 5 })),
    currentHp: 20,
    ...extra,
  }
}

// Druid table: cantrips 3 and prepared 7 at level 4, 6 known forms; Alert for the level 4 feat.
const druid4 = (id: string, extra: Record<string, unknown> = {}) =>
  druid(id, 4, null, {
    spellChoices: [{ className: 'Druid', classSource: XPHB, spells: refs(['Druidcraft', 'Guidance', 'Produce Flame', ...DRUID_PICKS, 'Cure Wounds']) }],
    wildShapeForms: forms(['Badger', 'Boar', 'Cat', 'Rat', 'Riding Horse', 'Wolf']),
    featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: XPHB }],
    ...extra,
  })

// Cantrips 2, prepared 6 at level 3; 4 known forms.
const moon3 = (id: string) =>
  druid(id, 3, 'Circle of the Moon', {
    spellChoices: [{ className: 'Druid', classSource: XPHB, spells: refs(['Druidcraft', 'Guidance', ...DRUID_PICKS]) }],
    wildShapeForms: forms(['Badger', 'Cat', 'Rat', 'Wolf']),
  })

async function openExtras(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Extras' }).click()
}

const transform = (page: Page, form: string): Locator => page.getByRole('tabpanel', { name: 'Extras' }).getByRole('button', { name: `Transform into ${form}`, exact: true })
const temp = (page: Page): Locator => page.locator('.sheet__temporary-hit-points')
const storedUses = (page: Page): Promise<unknown> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.play?.resourceUses, STORAGE_KEY)

async function usedBoxes(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  return page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('group', { name: 'Wild Shape uses' }).first().locator('.sheet__use-box--used')
}

test('F-40 a: Druid 4 — Transform gives 4 temp HP and spends one of 2 Wild Shape uses', async ({ page }) => {
  await openExtras(page, druid4('f40-a'))
  await expect(temp(page)).toHaveText('—')
  await transform(page, 'Badger').click()
  await expect(temp(page)).toHaveText('4')
  await expect.poll(() => storedUses(page)).toEqual({ 'Wild Shape': 1 })
  const boxes = await usedBoxes(page)
  await expect(boxes).toHaveCount(1)
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('group', { name: 'Wild Shape uses' }).first().getByRole('button')).toHaveCount(2)
})

test('F-40 b: Moon Druid 3 — Transform gives 9 temp HP', async ({ page }) => {
  await openExtras(page, moon3('f40-b'))
  await transform(page, 'Wolf').click()
  await expect(temp(page)).toHaveText('9')
})

test('F-40 c: every Wild Shape use spent — Transform is disabled', async ({ page }) => {
  await openExtras(page, druid4('f40-c', { play: { resourceUses: { 'Wild Shape': 2 } } }))
  await expect(transform(page, 'Cat')).toBeDisabled()
})

test('F-40 d: Druid 4 with 10 temp HP — Transform keeps 10 and still spends the use', async ({ page }) => {
  await openExtras(page, druid4('f40-d', { play: { temporaryHitPoints: 10 } }))
  await expect(temp(page)).toHaveText('10')
  await transform(page, 'Rat').click()
  await expect.poll(() => storedUses(page)).toEqual({ 'Wild Shape': 1 })
  await expect(temp(page)).toHaveText('10')
})
