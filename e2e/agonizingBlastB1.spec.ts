import { expect, test, type Page } from '@playwright/test'

/* B-1 (D372). Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const AGONIZING = [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast', source: XPHB, level: 2 }] }]

function warlock(id: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(level >= 5 ? ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys'] : ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys']) }],
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

async function eldritchBlastCells(page: Page) {
  await page.getByRole('tab', { name: 'Spells' }).click()
  const spellRow = page
    .getByRole('tabpanel', { name: 'Spells' })
    .locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Eldritch Blast$/ }) })
  const spells = { effect: (await spellRow.locator('.sheet__spell-effect').innerText()).trim(), notes: (await spellRow.locator('.sheet__spell-notes').innerText()).trim() }
  await page.getByRole('tab', { name: 'Actions' }).click()
  const actionRow = page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: 'Eldritch Blast breakdown', exact: true }) })
  await expect(actionRow).toContainText('1d10')
  const actions = { damage: (await actionRow.locator('.sheet__action-damage').innerText()).trim(), notes: (await actionRow.locator('.sheet__action-notes').innerText()).trim() }
  return { spells, actions }
}

test('B-1 a: Warlock 5 with Agonizing Blast, CHA 16 — 1d10 + 3, 2 beams', async ({ page }) => {
  await open(page, warlock('b1-a', 5, { optionalFeatureChoices: AGONIZING }))
  const { spells, actions } = await eldritchBlastCells(page)
  expect(spells.effect).toContain('1d10 + 3')
  expect(actions.damage).toContain('1d10 + 3')
  expect(spells.notes).toContain('2 beams')
  expect(actions.notes).toBe('2 beams')
})

test('B-1 b: Warlock 5 without Agonizing Blast — 1d10, 2 beams', async ({ page }) => {
  await open(page, warlock('b1-b', 5, { optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Repelling Blast', source: XPHB, level: 2 }] }] }))
  const { spells, actions } = await eldritchBlastCells(page)
  expect(spells.effect).toContain('1d10')
  expect(spells.effect).not.toContain('+')
  expect(actions.damage).not.toContain('+')
  expect(spells.notes).toContain('2 beams')
  expect(actions.notes).toBe('2 beams')
})

test('B-1 c: Warlock 1 — no beam note', async ({ page }) => {
  await open(page, warlock('b1-c', 1))
  const { spells, actions } = await eldritchBlastCells(page)
  expect(spells.notes).not.toContain('beams')
  expect(actions.notes).not.toContain('beams')
})

test('B-1 d: Agonizing Blast only from a custom item — 1d10 + 3', async ({ page }) => {
  const ring = { name: 'Blast Ring', source: 'custom', quantity: 1, custom: { name: 'Blast Ring', kind: 'other', invocations: [{ name: 'Agonizing Blast', source: XPHB }] } }
  await open(page, warlock('b1-d', 5, { inventory: [ring] }))
  const { spells, actions } = await eldritchBlastCells(page)
  expect(spells.effect).toContain('1d10 + 3')
  expect(actions.damage).toContain('1d10 + 3')
})
