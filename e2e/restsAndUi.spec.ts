import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-7b: play-state and UI fixes from the sheet review (B, B2). Characters seeded into storage, as in sheetCalculations.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 15, dexterity: 16, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 }

function seeded(id: string, className: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 56,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: [],
    ...extra,
  }
}

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

const longRest = (page: Page): Locator => page.getByRole('button', { name: 'Long Rest', exact: true })
const chips = (page: Page, text: string): Locator => page.locator('.sheet__status-conditions .sheet__chip').filter({ hasText: text })

test('F-7b a: a double click on Long Rest lowers Exhaustion by one, not two', async ({ page }) => {
  await open(page, seeded('f7b-double', 'Fighter', 3, { currentHp: 10, play: { exhaustion: 2 } }))
  await expect(chips(page, 'Exhaustion 2')).toHaveCount(1)
  await expect(longRest(page)).toBeEnabled()

  await longRest(page).dblclick()

  await expect(chips(page, 'Exhaustion 1')).toHaveCount(1)
  await expect(chips(page, 'Exhaustion 0')).toHaveCount(0)
})

test('F-7b b: at 0 HP Long Rest and the hit die are disabled with a reason, and HP stays 0', async ({ page }) => {
  await open(page, seeded('f7b-dying', 'Fighter', 3, { currentHp: 0, play: { deathSaves: { successes: 0, failures: 2 } } }))
  // At 0 HP the HP card is the Death saves panel.
  const deathSaves = page.getByRole('group', { name: 'Death saving throws' })
  await expect(deathSaves.getByRole('img', { name: 'Failures: 2 / 3' })).toBeVisible()
  await expect(longRest(page)).toBeDisabled()
  await expect(longRest(page)).toHaveAttribute('title', 'Needs at least 1 Hit Point')

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const dieButton = page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Roll Fighter hit die' })
  await expect(dieButton).toBeDisabled()
  await expect(dieButton).toHaveAttribute('title', 'Needs at least 1 Hit Point')
  await expect(page.getByRole('dialog', { name: 'Short Rest' })).toContainText('Needs at least 1 Hit Point to spend a Hit Die.')
  await dieButton.click({ force: true })

  await expect(deathSaves.getByRole('img', { name: 'Failures: 2 / 3' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Short Rest' }).locator('.sheet__hit-dice > ul > li')).toContainText('3 / 3 remaining')
})

test('F-7b c: a Long Rest ends Concentration', async ({ page }) => {
  await open(
    page,
    seeded('f7b-conc', 'Cleric', 1, {
      currentHp: 5,
      spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }],
      play: { concentratingOn: 'Bless' },
    }),
  )
  const card = page.locator('.sheet__status-row .sheet__concentration')
  await expect(card).toContainText('Bless')
  await expect(longRest(page)).toBeEnabled()

  await longRest(page).click()

  await expect(card).not.toContainText('Bless')
})

test('F-7b e: text typed in Notes survives the first click on Remove level, and confirming keeps it', async ({ page }) => {
  await open(page, seeded('f7b-remove', 'Fighter', 2))
  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByText('Poznámky', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Poznámky' }).fill('written just before')

  const remove = page.getByRole('button', { name: 'Remove level 2' })
  await expect(remove).toBeEnabled()
  await remove.click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 2?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await page.reload()
  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByText('Poznámky', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Poznámky' })).toHaveValue('written just before')
})

test('F-7b f: Manage Spells takes focus on open and gives it back to its button on close', async ({ page }) => {
  await open(page, seeded('f7b-focus', 'Cleric', 1))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const opener = page.getByRole('button', { name: 'Manage Spells', exact: true })
  await opener.click()
  const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
  await expect(drawer.getByRole('button', { name: 'Close' })).toBeFocused()

  await drawer.getByRole('button', { name: 'Close' }).click()

  await expect(drawer).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('F-7b g: two Magic Initiates give two spellcasting cards titled with their spell lists', async ({ page }) => {
  const initiate = (className: string, cantrips: string[], spell: string) => ({
    className,
    classSource: 'XPHB',
    cantrips: cantrips.map((name) => ({ name, source: 'XPHB' })),
    spell: { name: spell, source: 'XPHB' },
  })
  await open(
    page,
    seeded('f7b-initiates', 'Fighter', 4, {
      background: { name: 'Sage', source: 'XPHB', skillProficiencies: ['arcana', 'history'], toolProficiency: "Calligrapher's Supplies" },
      grantedFeats: [
        { origin: 'species', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'wisdom', magicInitiate: initiate('Cleric', ['Guidance', 'Sacred Flame'], 'Guiding Bolt') },
        { origin: 'background', name: 'Magic Initiate; Wizard', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Wizard', ['Fire Bolt', 'Light'], 'Thunderwave') },
      ],
    }),
  )
  await page.getByRole('tab', { name: 'Spells' }).click()

  await expect(page.getByRole('group', { name: 'Magic Initiate (Cleric) spellcasting' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Magic Initiate (Wizard) spellcasting' })).toBeVisible()
})
