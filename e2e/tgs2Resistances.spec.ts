import { expect, test, type Page } from '@playwright/test'

/* TGS2-5a (D369): Infernal Warrior (fire) and Windswept (cold) from the hand table. Subclass source GriffonsSaddlebag2; seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function seeded(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    featAsiChoices: level >= 4 ? [{ level: 4, kind: 'asi', increases: { strength: 2 } }] : [],
    spellChoices: [],
    ...extra,
  }
}

const barbarian = (id: string, level: number) =>
  seeded(id, 'Barbarian', 'Path of the Infernal', level, {
    classSkills: ['athletics', 'intimidation'],
    masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }, { name: 'Javelin' }].slice(0, level >= 4 ? 3 : 2),
  })

const ranger = (id: string, level: number) =>
  seeded(id, 'Ranger', 'Rocborne', level, {
    classSkills: ['perception', 'stealth', 'survival'],
    expertiseSkills: [{ name: 'perception' }],
    masteries: [{ name: 'Longbow' }, { name: 'Shortsword' }],
    fightingStyles: [{ className: 'Ranger', classSource: XPHB, name: 'Archery', source: XPHB }],
  })

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

test('TGS2-5a a: Barbarian 6 Path of the Infernal shows Fire resistance on the card and its origin in the details', async ({ page }) => {
  await openSheet(page, barbarian('tgs2-5a-a', 6))
  await expect(page.locator('.sheet__defenses')).toContainText('Resistant: Fire')
  await page.getByRole('button', { name: 'Defenses details' }).click()
  await expect(page.getByRole('dialog', { name: 'Defenses', exact: true })).toContainText('Fire — resistance (Infernal Warrior (Barbarian (Path of the Infernal)))')
})

test('TGS2-5a b: Ranger 7 Rocborne shows Cold resistance on the card and its origin in the details', async ({ page }) => {
  await openSheet(page, ranger('tgs2-5a-b', 7))
  await expect(page.locator('.sheet__defenses')).toContainText('Resistant: Cold')
  await page.getByRole('button', { name: 'Defenses details' }).click()
  await expect(page.getByRole('dialog', { name: 'Defenses', exact: true })).toContainText('Cold — resistance (Windswept (Ranger (Rocborne)))')
})

test('TGS2-5a c: Barbarian 5 Path of the Infernal shows no Fire resistance', async ({ page }) => {
  await openSheet(page, barbarian('tgs2-5a-c', 5))
  await expect(page.locator('.sheet__defenses')).toBeVisible()
  await expect(page.locator('.sheet__defenses')).not.toContainText('Fire')
  await page.getByRole('button', { name: 'Defenses details' }).click()
  await expect(page.getByRole('dialog', { name: 'Defenses', exact: true })).not.toContainText('Infernal Warrior')
})
