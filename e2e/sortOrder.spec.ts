import { expect, test } from '@playwright/test'

// F-18: lists sort the English way on a Czech browser, where the system collation puts "Ch" after "H".
test.use({ locale: 'cs-CZ' })

const BARD = {
  schemaVersion: 60,
  id: 'f18-bard',
  name: 'Bard f18',
  classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: {
    method: 'standardArray',
    scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 },
  },
}

test('F-18: Manage Spells lists "Charm Person" before "Healing Word" under a Czech locale', async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: 'familliar:characters', payload: JSON.stringify([BARD]) },
  )
  await page.goto(`/#/character/${BARD.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const names = await page
    .getByRole('dialog', { name: 'Manage Spells' })
    .getByRole('region', { name: 'Add Spells' })
    .locator('.manage-spells__name')
    .allTextContents()
  expect(names).toContain('Charm Person')
  expect(names).toContain('Healing Word')
  expect(names.indexOf('Charm Person')).toBeLessThan(names.indexOf('Healing Word'))
})
