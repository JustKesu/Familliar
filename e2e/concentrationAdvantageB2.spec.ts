import { expect, test, type Page } from '@playwright/test'

/* B-2 (D373). Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const ELDRITCH_MIND_LINE = 'Advantage on Constitution saves to maintain Concentration (Eldritch Mind)'
const WAR_CASTER_LINE = 'Advantage on Constitution saves to maintain Concentration (War Caster)'

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
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys']) }],
    ...extra,
  }
}

async function saveLines(page: Page, subject: { id: string }) {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
  await expect(page.locator('.sheet__saving-throws')).toBeVisible()
  return page.locator('.sheet__saving-throws .sheet__save-advantages li')
}

test('B-2 a: Warlock 2 with Eldritch Mind shows the concentration line', async ({ page }) => {
  const lines = await saveLines(page, warlock('b2-a', 2, { optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Eldritch Mind', source: XPHB, level: 2 }] }] }))
  await expect(lines).toHaveText([ELDRITCH_MIND_LINE])
})

test('B-2 b: Warlock 2 without Eldritch Mind shows no concentration line', async ({ page }) => {
  await saveLines(page, warlock('b2-b', 2, { optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Repelling Blast', source: XPHB, level: 2 }] }] }))
  await expect(page.locator('.sheet__saving-throws')).not.toContainText('maintain Concentration')
})

test('B-2 c: Eldritch Mind only from a custom item shows the line', async ({ page }) => {
  const circlet = { name: 'Focus Circlet', source: 'custom', quantity: 1, custom: { name: 'Focus Circlet', kind: 'other', invocations: [{ name: 'Eldritch Mind', source: XPHB }] } }
  const lines = await saveLines(page, warlock('b2-c', 2, { inventory: [circlet] }))
  await expect(lines).toHaveText([ELDRITCH_MIND_LINE])
})

test('B-2 d: War Caster taken at the level 4 ASI shows the War Caster line', async ({ page }) => {
  const lines = await saveLines(
    page,
    warlock('b2-d', 4, { featAsiChoices: [{ level: 4, kind: 'feat', name: 'War Caster', source: XPHB, chosenAbility: 'charisma' }] }),
  )
  await expect(lines).toHaveText([WAR_CASTER_LINE])
})
