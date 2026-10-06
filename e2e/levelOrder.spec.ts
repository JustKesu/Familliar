import { expect, test, type Page } from '@playwright/test'
import { next, wizardNav } from './wizard.ts'

/* M1a (D317): the level history is written and kept in sync, with nothing visible. Seeded at schema 56, as in restsAndUi.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }

const saved = {
  schemaVersion: 56,
  id: 'm1a',
  name: 'm1a',
  classes: [{ ...FIGHTER, subclass: null, level: 1 }],
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 } },
  species: { name: 'Human', source: 'XPHB' },
  speciesSize: 'M',
  fightingStyle: 'Archery',
  masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
  spellChoices: [],
}

async function stored(page: Page): Promise<{ schemaVersion: number; levelOrder?: unknown[] }> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

test('M1a: a schema-56 Fighter gains a level history on its first save; Level up appends, Remove level drops it', async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto('/#/character/m1a')

  await page.getByRole('tab', { name: 'Notes' }).click()
  await page.getByText('Poznámky', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Poznámky' }).fill('saved once')
  await expect.poll(async () => (await stored(page)).levelOrder).toEqual([FIGHTER])
  expect((await stored(page)).schemaVersion).toBe(58)

  await page.getByRole('button', { name: 'Level up to 2' }).click()
  const saveLevel = wizardNav(page).getByRole('button', { name: 'Save level 2' })
  for (let steps = 0; steps < 8 && !(await saveLevel.isVisible()); steps++) {
    const average = page.getByRole('radio', { name: /^Average/ })
    if (await average.isVisible()) await average.check()
    await next(page)
  }
  await saveLevel.click()
  await expect(page).toHaveURL(/#\/character\/m1a$/)
  await expect.poll(async () => (await stored(page)).levelOrder).toEqual([FIGHTER, FIGHTER])

  await page.getByRole('button', { name: 'Remove level 2' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 2?' })
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(async () => (await stored(page)).levelOrder).toEqual([FIGHTER])
})
