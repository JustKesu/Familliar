import { expect, test, type Locator, type Page } from '@playwright/test'

/* M5b (D326, D327): in a section with both pools CAST becomes Slot and Pact; lower spells upcast into the pact section. Seeded at schema 59. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 }

function character(id: string, order: [string, number][], picks: Record<string, string[]>) {
  return {
    schemaVersion: 59,
    id,
    name: id,
    classes: order.map(([className, level]) => ({ className, classSource: 'XPHB', subclass: null, level })),
    levelOrder: order.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: Object.entries(picks).map(([className, names]) => ({ className, classSource: 'XPHB', spells: names.map((name) => ({ name, source: 'XPHB' })) })),
  }
}

async function openSpells(page: Page, seeded: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([seeded]) },
  )
  await page.goto(`/#/character/${seeded.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const section = (page: Page, label: string): Locator => panel(page).getByRole('region', { name: label, exact: true })
const rows = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const usedBoxes = (scope: Locator, group: string): Locator => scope.getByRole('group', { name: `${group} uses`, exact: true }).locator('.sheet__use-box--used')

// Caster level 3 (Sorcerer): ordinary 1st ×4, 2nd ×2; Warlock 3: Pact Magic 2 slots at 2nd.
const WARLOCK_SORCERER = character(
  'm5b',
  [
    ['Warlock', 3],
    ['Sorcerer', 3],
  ],
  { Warlock: ['Hold Person'], Sorcerer: ['Burning Hands'] },
)

test('M5b a: Warlock 3 / Sorcerer 3 — Pact spends a pact box only, Slot an ordinary 2nd box only', async ({ page }) => {
  await openSpells(page, WARLOCK_SORCERER)
  const second = section(page, '2nd Level')
  const hold = rows(second, 'Hold Person')
  await expect(hold.getByRole('button', { name: 'Cast Hold Person', exact: true })).toHaveCount(0)

  await hold.getByRole('button', { name: 'Cast Hold Person with a Pact Magic slot', exact: true }).click()
  await expect(usedBoxes(second, 'Pact Magic slots')).toHaveCount(1)
  await expect(usedBoxes(second, 'level 2 spell slots')).toHaveCount(0)

  await hold.getByRole('button', { name: 'Cast Hold Person with a spell slot', exact: true }).click()
  await expect(usedBoxes(second, 'level 2 spell slots')).toHaveCount(1)
  await expect(usedBoxes(second, 'Pact Magic slots')).toHaveCount(1)
})

test('M5b b: with every pact slot spent Pact is disabled and Slot still casts', async ({ page }) => {
  await openSpells(page, WARLOCK_SORCERER)
  const second = section(page, '2nd Level')
  const hold = rows(second, 'Hold Person')
  const pact = hold.getByRole('button', { name: 'Cast Hold Person with a Pact Magic slot', exact: true })
  await pact.click()
  await pact.click()
  await expect(pact).toBeDisabled()
  await expect(pact).toHaveAttribute('title', 'No Pact Magic slots left')
  const slot = hold.getByRole('button', { name: 'Cast Hold Person with a spell slot', exact: true })
  await expect(slot).toBeEnabled()
  await slot.click()
  await expect(usedBoxes(second, 'level 2 spell slots')).toHaveCount(1)
})

test('M5b c: the Sorcerer’s Burning Hands upcasts into the 2nd section with a "1st" badge and both buttons', async ({ page }) => {
  await openSpells(page, WARLOCK_SORCERER)
  const upcast = rows(section(page, '2nd Level'), 'Burning Hands')
  await expect(upcast).toHaveCount(1)
  await expect(upcast.locator('.sheet__spell-badge')).toHaveText('1st')
  await expect(upcast.getByRole('button', { name: 'Cast Burning Hands with a spell slot', exact: true })).toBeEnabled()
  await expect(upcast.getByRole('button', { name: 'Cast Burning Hands with a Pact Magic slot', exact: true })).toBeEnabled()
  const own = rows(section(page, '1st Level'), 'Burning Hands')
  await expect(own.getByRole('button', { name: 'Cast Burning Hands', exact: true })).toHaveCount(1)
})

// D327: Sorcerer 1 gives ordinary 1st slots only, Warlock 5 Pact Magic 2 slots at 3rd — no slot at 2nd.
test('M5b e: Warlock 5 / Sorcerer 1 — Misty Step gets a "2nd" pact row in the 3rd section whose CAST spends a pact box', async ({ page }) => {
  await openSpells(page, character('m5b-e', [['Warlock', 5], ['Sorcerer', 1]], { Warlock: ['Misty Step'] }))
  const third = section(page, '3rd Level')
  const pactRow = rows(third, 'Misty Step')
  await expect(pactRow).toHaveCount(1)
  await expect(pactRow.locator('.sheet__spell-badge')).toHaveText('2nd')
  await pactRow.getByRole('button', { name: 'Cast Misty Step', exact: true }).click()
  await expect(usedBoxes(third, 'Pact Magic slots')).toHaveCount(1)
})

test('M5b d1: a single-class Warlock keeps one CAST button per row', async ({ page }) => {
  await openSpells(page, character('m5b-warlock', [['Warlock', 3]], { Warlock: ['Hold Person', 'Hex'] }))
  for (const name of ['Hold Person', 'Hex']) await expect(rows(panel(page), name).getByRole('button', { name: `Cast ${name}`, exact: true })).toHaveCount(1)
  await expect(panel(page).getByRole('button', { name: /with a (spell|Pact Magic) slot$/ })).toHaveCount(0)
})

test('M5b d2: a single-class Sorcerer keeps one CAST button per row, upcast rows included', async ({ page }) => {
  await openSpells(page, character('m5b-sorcerer', [['Sorcerer', 3]], { Sorcerer: ['Burning Hands', 'Hold Person'] }))
  await expect(rows(panel(page), 'Hold Person').getByRole('button', { name: 'Cast Hold Person', exact: true })).toHaveCount(1)
  await expect(panel(page).getByRole('button', { name: /with a (spell|Pact Magic) slot$/ })).toHaveCount(0)
  await expect(rows(panel(page), 'Burning Hands')).toHaveCount(2)
  for (const row of await rows(panel(page), 'Burning Hands').all()) await expect(row.getByRole('button', { name: 'Cast Burning Hands', exact: true })).toHaveCount(1)
})
