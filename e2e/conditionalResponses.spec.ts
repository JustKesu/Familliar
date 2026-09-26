import { expect, test, type Page } from '@playwright/test'

/* D198: conditional damage responses are listed under "Only in certain conditions" in the Defenses drawer. */
const STORAGE_KEY = 'familliar:characters'

function seeded(id: string, className: string, level: number, subclass: string | null, featName?: string) {
  return {
    schemaVersion: 48,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass, level }],
    abilityScores: { method: 'standardArray', scores: { strength: 10, dexterity: 15, constitution: 13, intelligence: 8, wisdom: 14, charisma: 12 } },
    species: { name: 'Human', source: 'XPHB' },
    spellChoices: [],
    ...(featName ? { featAsiChoices: [{ level: 19, kind: 'feat', name: featName, source: 'XPHB' }] } : {}),
  }
}

async function conditionalList(page: Page, saved: { id: string }) {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
  await page.getByRole('button', { name: 'Defenses details' }).click()
  return page.getByRole('dialog').locator('.sheet__damage-response-conditional')
}

test('D198 a: Shadow Sorcery 18 lists Umbral Form resistance with its condition', async ({ page }) => {
  const list = await conditionalList(page, seeded('d198-umbral', 'Sorcerer', 18, 'Shadow Sorcery'))
  await expect(list).toContainText('Necrotic — resistance (Umbral Form (Sorcerer (Shadow Sorcery)))')
  await expect(list).toContainText('while Umbral Form is active')
  await expect(list).not.toContainText('Force')
  await expect(list).not.toContainText('Radiant')
})

test('D198 b: Boon of the Night Spirit lists all-except-Psychic/Radiant with its condition', async ({ page }) => {
  const list = await conditionalList(page, seeded('d198-boon', 'Fighter', 19, null, 'Boon of the Night Spirit'))
  await expect(list).toContainText('Fire — resistance (Boon of the Night Spirit)')
  await expect(list).toContainText('while within Dim Light or Darkness')
  await expect(list).not.toContainText('Psychic')
})
