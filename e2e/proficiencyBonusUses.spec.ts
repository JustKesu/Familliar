import { expect, test, type Locator, type Page } from '@playwright/test'

/* PB-1 (D414): uses counted by the Proficiency Bonus, from total character level. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const RUNES = { featureType: 'RN', choices: [{ name: 'Cloud Rune', source: 'TCE' }, { name: 'Stone Rune', source: 'TCE' }] }

function seeded(id: string, classes: [string, string | null, number][], extra: Record<string, unknown> = {}) {
  const total = classes.reduce((sum, [, , level]) => sum + level, 0)
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['athletics', 'perception'],
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    hitPointLevels: Array.from({ length: total - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    ...extra,
  }
}

// TCE writes no action or rest tag, so its features list only on the Features tab (D86); the feat also lists on Actions.
type Tab = 'Features' | 'Actions'

async function openSheet(page: Page, character: { id: string }, tab: Tab): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: tab }).click()
}

const counter = (page: Page, name: string, tab: Tab = 'Features'): Locator => page.getByRole('tabpanel', { name: tab }).getByRole('group', { name: `${name} uses`, exact: true }).first()
const boxes = (page: Page, name: string, tab: Tab = 'Features'): Locator => counter(page, name, tab).getByRole('button')
const used = (page: Page, name: string): Locator => counter(page, name).locator('.sheet__use-box--used')
const GIANTS_MIGHT = "Giant's Might"

test("PB-1 a: Fighter 5 Rune Knight shows 3 Giant's Might boxes per Long Rest; a Long Rest restores a used box", async ({ page }) => {
  await openSheet(page, seeded('pb1-a', [['Fighter', 'Rune Knight', 5]], { optionalFeatureChoices: [RUNES], featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] }), 'Features')
  await expect(boxes(page, GIANTS_MIGHT)).toHaveCount(3)
  await expect(counter(page, GIANTS_MIGHT)).toContainText('/ Long Rest')

  await counter(page, GIANTS_MIGHT).getByRole('button', { name: `Use ${GIANTS_MIGHT}` }).first().click()
  await expect(used(page, GIANTS_MIGHT)).toHaveCount(1)
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page, GIANTS_MIGHT)).toHaveCount(0)
})

test("PB-1 b: Fighter 9 Rune Knight shows 4 Giant's Might boxes", async ({ page }) => {
  await openSheet(
    page,
    seeded('pb1-b', [['Fighter', 'Rune Knight', 9]], {
      optionalFeatureChoices: [{ featureType: 'RN', choices: [...RUNES.choices, { name: 'Fire Rune', source: 'TCE' }] }],
      featAsiChoices: [4, 6, 8].map((level) => ({ level, kind: 'asi', increases: { strength: 1, constitution: 1 } })),
    }),
    'Features',
  )
  await expect(boxes(page, GIANTS_MIGHT)).toHaveCount(4)
})

test("PB-1 c: Fighter 3 Rune Knight / Wizard 2 (character level 5) shows 3 Giant's Might boxes", async ({ page }) => {
  await openSheet(page, seeded('pb1-c', [['Fighter', 'Rune Knight', 3], ['Wizard', null, 2]], { optionalFeatureChoices: [RUNES] }), 'Features')
  await expect(boxes(page, GIANTS_MIGHT)).toHaveCount(3)
})

test('PB-1 d: Fighter 5 who took Fairy Trickster at level 4 shows 3 boxes', async ({ page }) => {
  await openSheet(page, seeded('pb1-d', [['Fighter', null, 5]], { featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fairy Trickster', source: 'FRHoF', chosenAbility: 'charisma' }] }), 'Actions')
  await expect(boxes(page, 'Fairy Trickster', 'Actions')).toHaveCount(3)
  await expect(counter(page, 'Fairy Trickster', 'Actions')).toContainText('/ Long Rest')
  await page.getByRole('tab', { name: 'Features' }).click()
  await expect(boxes(page, 'Fairy Trickster')).toHaveCount(3)
})
