import { expect, test, type Page } from '@playwright/test'

/* F-39 (D363). Seeded at schema 61 as the wizard saves a finished Warlock 5. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

const WARLOCK_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Counterspell', 'Hunger of Hadar']

const bladeWarlock = {
  schemaVersion: 61,
  id: 'f39-blade',
  name: 'f39-blade',
  classes: [{ className: 'Warlock', classSource: XPHB, subclass: 'Fiend Patron', level: 5 }],
  levelOrder: Array.from({ length: 5 }, () => ({ className: 'Warlock', classSource: XPHB })),
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
  species: { name: 'Dwarf', source: XPHB },
  background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
  abilityBonus: { strength: 2, dexterity: 1 },
  languages: [
    { name: 'Common', source: XPHB, grantedBy: 'automatic' },
    { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
    { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
  ],
  hitPointLevels: [2, 3, 4, 5].map((level) => ({ level, kind: 'average', dieResult: 5 })),
  currentHp: 38,
  classSkills: ['arcana', 'deception'],
  spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS) }],
  optionalFeatureChoices: [{ featureType: 'EI', choices: refs(['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows', 'Thirsting Blade', 'Mask of Many Faces']) }],
  featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
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

test('F-39: Warlock 5 with Thirsting Blade — Attacks per Action 2, drawer says pact weapon only', async ({ page }) => {
  await open(page, bladeWarlock)
  await page.getByRole('tab', { name: 'Actions' }).click()
  const summary = page.locator('.sheet__actions-per-action')
  await expect(summary.locator('strong')).toHaveText('2')
  await summary.getByRole('button', { name: 'Attacks per Action breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Attacks per Action' })).toContainText('Thirsting Blade (pact weapon only)')
})
