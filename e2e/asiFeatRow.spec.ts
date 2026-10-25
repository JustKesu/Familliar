import { expect, test, type Locator, type Page } from '@playwright/test'

/* A-1 (D397): a level taken as Ability Score Improvement is a row of the Feats section. Seeds at schema 66. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const lang = (name: string, grantedBy: string) => ({ name, source: XPHB, grantedBy })

function seeded(id: string, className: string, subclass: string, featAsiChoices: unknown[], extra: Record<string, unknown> = {}) {
  const levelOrder = Array.from({ length: 4 }, () => ({ className, classSource: XPHB }))
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level: 4 }],
    levelOrder,
    createdAtLevel: 1,
    currentHp: 20,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Dwarf', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Farmer', source: XPHB, skillProficiencies: ['animalHandling', 'nature'], toolProficiency: "Carpenter's Tools" },
    abilityBonus: { strength: 2, constitution: 1 },
    hitPointLevels: levelOrder.slice(1).map((_, index) => ({ level: index + 2, kind: 'average', dieResult: className === 'Barbarian' ? 7 : 6 })),
    classSkills: ['intimidation', 'perception'],
    masteries: [{ name: 'Greataxe' }, { name: 'Handaxe' }, { name: 'Javelin' }],
    languages: [lang('Common', 'automatic'), lang('Dwarvish', 'automatic'), lang('Elvish', 'creation')],
    featAsiChoices,
    ...extra,
  }
}

async function openFeats(page: Page, character: { id: string }): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  return page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
}

const barbarian = () => seeded('asi-barb', 'Barbarian', 'Path of the Berserker', [{ level: 4, kind: 'asi', increases: { strength: 2 } }])

test('A-1 a: Barbarian 4 with an ASI shows the row beside the background feat Tough', async ({ page }) => {
  const feats = await openFeats(page, barbarian())
  const asi = feats.locator('li', { hasText: 'Ability Score Improvement' })
  await expect(asi).toContainText('From level 4')
  await expect(asi).toContainText('STR +2')
  await expect(feats.locator('li', { hasText: 'Tough' })).toBeVisible()
  await expect(feats).not.toContainText('No feats chosen yet.')
})

test('A-1 b: the Feats filter keeps the ASI row', async ({ page }) => {
  const feats = await openFeats(page, barbarian())
  await page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('button', { name: 'Feats', exact: true }).click()
  await expect(feats.locator('li', { hasText: 'Ability Score Improvement' })).toContainText('STR +2')
})

test('A-1 c: Fighter 4 that took a feat at level 4 has no ASI row', async ({ page }) => {
  const fighter = seeded('asi-fighter', 'Fighter', 'Champion', [{ level: 4, kind: 'feat', name: 'Alert', source: XPHB }], {
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense' }],
  })
  const feats = await openFeats(page, fighter)
  await expect(feats.locator('li', { hasText: 'Alert' })).toBeVisible()
  await expect(feats).not.toContainText('Ability Score Improvement')
})
