import { expect, test, type Page } from '@playwright/test'

/* WM-1 (D420): Hexblade's Curse gets one use back on a Short Rest; Devil's Sight is listed in Senses. Seeds at schema 70. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const CURSE = "Hexblade's Curse"

function warlock3(id: string, subclass: string | null) {
  return {
    schemaVersion: 70,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass, level: 3 }],
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: "Devil's Sight", source: XPHB }] }],
  }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

test("WM-1 c: Hexblade 3 has one Hexblade's Curse use, back on a Short Rest", async ({ page }) => {
  await open(page, warlock3('wm1-c', 'The Hexblade'))
  await page.getByRole('tab', { name: 'Actions' }).click()
  const counter = page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: `${CURSE} uses`, exact: true }).first()
  await expect(counter.getByRole('button')).toHaveCount(1)
  await counter.getByRole('button').click()
  await expect(counter.getByRole('button', { pressed: true })).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(counter.getByRole('button', { pressed: true })).toHaveCount(0)
})

test("WM-1 d: Devil's Sight lists Devil's Sight 120 ft. in Senses", async ({ page }) => {
  await open(page, warlock3('wm1-d', null))
  await expect(page.locator('.sheet__senses-card .sheet__senses')).toContainText("Devil's Sight: 120 ft. — from invocation (Devil's Sight)")
})
