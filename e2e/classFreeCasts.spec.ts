import { expect, test, type Locator, type Page } from '@playwright/test'

/* D193 (A-S2): free casts of class always-prepared spells. Saved characters are seeded into storage like classGrants.spec.ts does. */
const STORAGE_KEY = 'familliar:characters'

const scores = (key: 'wisdom' | 'charisma') => ({
  method: 'standardArray',
  scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10, [key]: 16 },
})

function character(id: string, className: string, level: number, ability: 'wisdom' | 'charisma') {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    abilityScores: scores(ability),
    spellChoices: [],
  }
}

async function openSaved(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const kindRow = (page: Page, name: string, kind: 'cast' | 'use'): Locator =>
  panel(page).locator(`.sheet__spell-row--${kind}`, { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const useButton = (page: Page, name: string): Locator => kindRow(page, name, 'use').getByRole('button', { name: `Use ${name}`, exact: true })
const castButton = (page: Page, name: string): Locator => kindRow(page, name, 'cast').getByRole('button', { name: `Cast ${name}`, exact: true })
const counterBoxes = (scope: Locator, used = false): Locator => scope.locator(`.sheet__spell-notes .sheet__use-box${used ? '--used' : ''}`)

/** The named resource's boxes in Features & Traits; leaves the tab on Features & Traits. */
async function featureBoxes(page: Page, resource: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  return page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('group', { name: `${resource} uses` }).first()
}

test('A-S2 a: Ranger 1 — USE Hunter\'s Mark spends a Favored Enemy box; at none USE is disabled, CAST still works; Long Rest restores', async ({ page }) => {
  await openSaved(page, character('as2-ranger', 'Ranger', 1, 'wisdom'))
  await expect(kindRow(page, "Hunter's Mark", 'use').locator('.sheet__spell-notes')).toContainText('Favored Enemy 2 / 2')

  await useButton(page, "Hunter's Mark").click()
  await expect(kindRow(page, "Hunter's Mark", 'use').locator('.sheet__spell-notes')).toContainText('Favored Enemy 1 / 2')
  let boxes = await featureBoxes(page, 'Favored Enemy')
  await expect(boxes.locator('.sheet__use-box--used')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Spells' }).click()
  await useButton(page, "Hunter's Mark").click()
  await expect(useButton(page, "Hunter's Mark")).toBeDisabled()
  await expect(castButton(page, "Hunter's Mark")).toBeEnabled()
  await castButton(page, "Hunter's Mark").click()
  await expect(panel(page).locator('.sheet__spell-section-heading .sheet__use-box--used')).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(useButton(page, "Hunter's Mark")).toBeEnabled()
  boxes = await featureBoxes(page, 'Favored Enemy')
  await expect(boxes.locator('.sheet__use-box--used')).toHaveCount(0)
})

test('A-S2 b: Druid 2 — USE Find Familiar spends a Wild Shape use; disabled at none', async ({ page }) => {
  await openSaved(page, character('as2-druid', 'Druid', 2, 'wisdom'))
  await useButton(page, 'Find Familiar').click()
  await expect(kindRow(page, 'Find Familiar', 'use').locator('.sheet__spell-notes')).toContainText('Wild Shape 1 / 2')
  const boxes = await featureBoxes(page, 'Wild Shape')
  await expect(boxes.locator('.sheet__use-box--used')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Spells' }).click()
  await useButton(page, 'Find Familiar').click()
  await expect(kindRow(page, 'Find Familiar', 'use').locator('.sheet__spell-notes')).toContainText('Wild Shape 0 / 2')
  await expect(useButton(page, 'Find Familiar')).toBeDisabled()
  await expect(castButton(page, 'Find Familiar')).toBeEnabled()
})

const ONCE_PER_LONG_REST: [string, string, number, string, string][] = [
  ['c', 'Divine Smite', 2, 'Paladin', "Paladin's Smite"],
  ['c2', 'Find Steed', 5, 'Paladin', 'Faithful Steed'],
  ['d', 'Contact Other Plane', 9, 'Warlock', 'Contact Patron'],
]

for (const [id, spell, level, className, feature] of ONCE_PER_LONG_REST) {
  test(`A-S2 ${id}: ${className} ${level} — USE ${spell} once per Long Rest, the box is the one next to ${feature}`, async ({ page }) => {
    await openSaved(page, character(`as2-${id}`, className, level, 'charisma'))
    const use = kindRow(page, spell, 'use')
    await expect(use.locator('.sheet__spell-notes')).toContainText('/ Long Rest')
    await useButton(page, spell).click()
    await expect(counterBoxes(kindRow(page, spell, 'use'), true)).toHaveCount(1)
    await expect(useButton(page, spell)).toBeDisabled()
    await expect(castButton(page, spell)).toBeEnabled()

    let boxes = await featureBoxes(page, feature)
    await expect(boxes.locator('.sheet__use-box--used')).toHaveCount(1)

    await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
    boxes = await featureBoxes(page, feature)
    await expect(boxes.locator('.sheet__use-box--used')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Spells' }).click()
    await expect(useButton(page, spell)).toBeEnabled()
  })
}
