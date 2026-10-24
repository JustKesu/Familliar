import { expect, test, type Locator, type Page } from '@playwright/test'

/* TGS2-4b (D386): Spelldrinker's Channel Divinity options as two rows spending the Paladin pool. Seeds at schema 64. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const POOL = 'Channel Divinity'
const OPTIONS = ['Absorb Magic', 'Expeditious Command']

const character = {
  schemaVersion: 64,
  id: 'tgs2-cd',
  name: 'tgs2-cd',
  classes: [{ className: 'Paladin', classSource: XPHB, subclass: 'Oath of the Spelldrinker', level: 3 }],
  levelOrder: Array.from({ length: 3 }, () => ({ className: 'Paladin', classSource: XPHB })),
  createdAtLevel: 3,
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
  species: { name: 'Human', source: XPHB },
  speciesSize: 'M',
  background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  hitPointLevels: [2, 3].map((level) => ({ level, kind: 'average', dieResult: 6 })),
}

async function openSheet(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const row = (page: Page, name: string): Locator =>
  actions(page).locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
const useBoxes = (page: Page, name: string): Locator => row(page, name).getByRole('group', { name: `${POOL} uses`, exact: true })

test('TGS2-4b a-c: Paladin 3 Spelldrinker — two option rows share the Channel Divinity pool', async ({ page }) => {
  await openSheet(page)
  await page.getByRole('tab', { name: 'Actions' }).click()
  for (const name of OPTIONS) {
    await expect(row(page, name)).toHaveCount(1)
    await expect(useBoxes(page, name).getByRole('button', { name: `Use ${POOL}` })).toHaveCount(2)
  }

  await useBoxes(page, 'Absorb Magic').getByRole('button', { name: `Use ${POOL}` }).first().click()
  for (const name of OPTIONS) {
    await expect(useBoxes(page, name).locator('.sheet__use-box--used')).toHaveCount(1)
    await expect(useBoxes(page, name).getByRole('button', { name: `Use ${POOL}` })).toHaveCount(1)
  }

  // An empty pool leaves no "Use" box on either row, only undo boxes.
  await useBoxes(page, 'Expeditious Command').getByRole('button', { name: `Use ${POOL}` }).click()
  for (const name of OPTIONS) {
    await expect(useBoxes(page, name).getByRole('button', { name: `Use ${POOL}` })).toHaveCount(0)
    await expect(useBoxes(page, name).locator('.sheet__use-box--used')).toHaveCount(2)
  }
})

// As with Conquest|XGE (F-17 a), each option is its own Features row beside the one "Channel Divinity" row.
test('TGS2-4b d: Features shows Channel Divinity once and each option text once', async ({ page }) => {
  await openSheet(page)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const paladin = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Paladin Features', exact: true })
  const featureRow = (name: string): Locator =>
    paladin.locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
  await expect(featureRow(POOL)).toHaveCount(1)
  for (const [name, text] of [['Absorb Magic', 'You can refute certain spells'], ['Expeditious Command', 'issue a word of power']]) {
    await expect(featureRow(name)).toHaveCount(1)
    await featureRow(name).locator('.sheet__group-row-toggle').click()
    await expect(paladin.getByText(text)).toHaveCount(1)
  }
})
