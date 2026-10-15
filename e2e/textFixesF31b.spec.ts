import { expect, test, type Page } from '@playwright/test'

/* F-31b: spell-row notes and the Remove level dialog. Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

function seeded(id: string, className: string, subclass: string | null, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
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

test('F-31b b (26/40): Divine Smite CAST row has no usage note, its USE row keeps it', async ({ page }) => {
  await open(page, seeded('f31b-b', 'Paladin', null, 2, { classSkills: ['athletics', 'persuasion'], spellChoices: [] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const row = (kind: 'cast' | 'use') =>
    page.getByRole('tabpanel', { name: 'Spells' }).locator(`.sheet__spell-row--${kind}`, { has: page.locator('.sheet__spell-name', { hasText: /^Divine Smite$/ }) })
  await expect(row('use').locator('.sheet__spell-notes')).toContainText('(no slot)')
  await expect(row('cast')).toHaveCount(1)
  await expect(row('cast').locator('.sheet__spell-notes')).not.toContainText('(no slot)')
})

// Expertise/skill lines cannot appear for a Warlock (no app path stamps either), so only the absence of lower-case lines is asserted here; the spelling is the skillLabel unit test.
test('F-31b c: Remove level that drops Pact of the Tome says other spells are kept', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const choices = [...refs(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]), { name: 'Pact of the Tome', source: XPHB, level: 5 }, { name: 'Mask of Many Faces', source: XPHB, level: 5 }]
  await open(
    page,
    seeded('f31b-c', 'Warlock', 'Fiend Patron', 5, {
      createdAtLevel: 4,
      classSkills: ['arcana', 'deception'],
      spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Spider Climb', 'Counterspell']) }],
      featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
      optionalFeatureChoices: [{ featureType: 'EI', choices, spellChoices: [tome] }],
    }),
  )
  await page.getByRole('button', { name: 'Remove level 5', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 5?' })
  await expect(dialog).toContainText('Other known and prepared spells are kept.')
  await expect(dialog).not.toContainText(/Expertise: [a-z]/)
  await expect(dialog).not.toContainText(/Skill proficiency: [a-z]/)
})
