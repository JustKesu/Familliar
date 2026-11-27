import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep, next, wizardNav } from './wizard.ts'

/* NPC-1 (D437): NPCs are full characters flagged `npc`, listed only in the DM area's NPCs tab. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }

function character(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 73,
    id,
    name,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: ABILITIES,
    species: { name: 'Elf', source: 'XPHB' },
    currentHp: 20,
    ...extra,
  }
}

async function seed(page: Page, extra: Record<string, unknown>[] = []): Promise<void> {
  const subjects = [character('c-aria', 'Aria'), character('n-bandit', 'Bandit', { npc: true }), ...extra]
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(subjects) },
  )
}

const card = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const more = (page: Page, name: string) => page.getByRole('button', { name: `More actions for ${name}`, exact: true })
const cardNames = (page: Page) => page.locator('.char-card__name')
const stored = (page: Page): Promise<{ id: string; name: string; npc?: boolean; currentHp?: number }[]> =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)

test('NPC-1 a: the home list shows only the player character, the NPCs tab only the NPC', async ({ page }) => {
  await seed(page)
  await page.goto('/#/')
  await expect(cardNames(page)).toHaveText(['Aria'])
  await page.goto('/#/dm/npcs')
  await expect(page.getByRole('tab', { name: 'NPCs' })).toHaveAttribute('aria-selected', 'true')
  await expect(cardNames(page)).toHaveText(['Bandit'])
  await card(page, 'Bandit').click()
  await expect(page).toHaveURL(/#\/character\/n-bandit$/)
})

test('NPC-1 b, c: New NPC runs the wizard to its sheet; Back, Edit and Back again return to the NPCs tab', async ({ page }) => {
  test.setTimeout(120_000)
  await seed(page)
  await page.goto('/#/dm/npcs')
  await page.getByRole('button', { name: 'New NPC' }).click()
  await expect(page).toHaveURL(/#\/dm\/npcs\/new$/)
  await createFighter(page, { name: 'Guard', level: 1, species: 'Dwarf|XPHB', alreadyOpen: true })
  expect((await stored(page)).find((c) => c.name === 'Guard')?.npc).toBe(true)

  await page.goBack()
  await expect(page).toHaveURL(/#\/dm\/npcs$/)
  await expect(cardNames(page)).toHaveText(['Bandit', 'Guard'])

  await card(page, 'Guard').click()
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await page.getByLabel('Character name').fill('Guard captain')
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 12 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  // Save replaced the pushed Edit route with the sheet, so two Backs pass the sheet and reach the NPCs tab.
  await page.goBack()
  await page.goBack()
  await expect(page).toHaveURL(/#\/dm\/npcs$/)
  await expect(cardNames(page)).toHaveText(['Bandit', 'Guard captain'])
  expect((await stored(page)).find((c) => c.name === 'Guard captain')?.npc).toBe(true)

  await page.goto('/#/')
  await expect(cardNames(page)).toHaveText(['Aria'])
})

test('NPC-1 b2: Cancel in the New NPC wizard returns to the NPCs tab', async ({ page }) => {
  await seed(page)
  await page.goto('/#/dm/npcs')
  await page.getByRole('button', { name: 'New NPC' }).click()
  await expectStep(page, 'Class and level')
  await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/#\/dm\/npcs$/)
})

test('NPC-1 d, e: Duplicate needs a name and gives an independent NPC', async ({ page }) => {
  await seed(page)
  await page.goto('/#/dm/npcs')
  await more(page, 'Bandit').click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Duplicate Bandit' })
  const name = dialog.getByRole('textbox', { name: 'Name of the copy' })
  await expect(name).toHaveValue('Bandit copy')
  await name.fill('   ')
  await expect(dialog.getByRole('button', { name: 'Duplicate' })).toBeDisabled()
  await name.fill('Bandit two')
  await dialog.getByRole('button', { name: 'Duplicate' }).click()
  await expect(cardNames(page)).toHaveText(['Bandit', 'Bandit two'])

  const copy = (await stored(page)).find((c) => c.name === 'Bandit two')!
  expect(copy.id).not.toBe('n-bandit')
  expect(copy.npc).toBe(true)

  await card(page, 'Bandit two').click()
  await page.getByRole('group', { name: 'Damage and healing' }).getByRole('spinbutton', { name: 'Amount' }).fill('5')
  await page.getByRole('group', { name: 'Damage and healing' }).getByRole('button', { name: 'Damage' }).click()
  await expect.poll(async () => (await stored(page)).find((c) => c.name === 'Bandit two')?.currentHp).toBe(15)
  expect((await stored(page)).find((c) => c.id === 'n-bandit')?.currentHp).toBe(20)
})

test('NPC-1 f: Delete removes only that NPC', async ({ page }) => {
  await seed(page, [character('n-thug', 'Thug', { npc: true })])
  await page.goto('/#/dm/npcs')
  await more(page, 'Bandit').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Bandit?' })
  await dialog.getByRole('button', { name: 'Keep' }).click()
  await expect(cardNames(page)).toHaveText(['Bandit', 'Thug'])
  await more(page, 'Bandit').click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(cardNames(page)).toHaveText(['Thug'])
  expect((await stored(page)).map((c) => c.name)).toEqual(['Aria', 'Thug'])
})

test('NPC-1 g: an exported NPC imports as an NPC', async ({ page }) => {
  await seed(page)
  await page.goto('/#/dm/npcs')
  await more(page, 'Bandit').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const file = await download
  expect(JSON.parse(await readFile((await file.path()) as string, 'utf8'))[0].npc).toBe(true)

  await page.goto('/#/')
  await page.locator('input[type="file"]').setInputFiles((await file.path()) as string)
  await expect.poll(async () => (await stored(page)).filter((c) => c.name === 'Bandit' && c.npc).length).toBe(2)
  await expect(cardNames(page)).toHaveText(['Aria'])
  await page.goto('/#/dm/npcs')
  await expect(cardNames(page)).toHaveText(['Bandit', 'Bandit'])
})

test('NPC-1 h: at 390x844 the NPCs tab and its card buttons stay inside the viewport', async ({ page }) => {
  await seed(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/dm/npcs')
  await expect(card(page, 'Bandit')).toBeVisible()
  for (const locator of [page.getByRole('tab', { name: 'NPCs' }), page.getByRole('button', { name: 'New NPC' }), card(page, 'Bandit'), more(page, 'Bandit')]) {
    const box = await locator.evaluate((element) => element.getBoundingClientRect().right)
    expect(box).toBeLessThanOrEqual(390)
  }
  await more(page, 'Bandit').click()
  for (const label of ['Rename', 'Export', 'Duplicate', 'Delete']) {
    const right = await page.getByRole('button', { name: label, exact: true }).evaluate((element) => element.getBoundingClientRect().right)
    expect(right).toBeLessThanOrEqual(390)
  }
  const overflowing = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.dm, .dm *')).filter((element) => element.scrollWidth > element.clientWidth + 1).length,
  )
  expect(overflowing).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
