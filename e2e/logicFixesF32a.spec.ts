import { expect, test, type Locator, type Page } from '@playwright/test'
import { fillUpToBackground, expectStep, next } from './wizard.ts'

/* F-32a. Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))

function seeded(id: string, className: string, subclass: string | null, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 15, charisma: 12 } },
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

test('F-32a a: Warlock 5 — Eldritch Blast shows 1d10 in the Spells Effect and the Actions Damage', async ({ page }) => {
  await open(page, seeded('f32a-a', 'Warlock', null, 5, { classSkills: ['arcana', 'deception'], spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys']) }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const effect = page
    .getByRole('tabpanel', { name: 'Spells' })
    .locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Eldritch Blast$/ }) })
    .locator('.sheet__spell-effect')
  await expect(effect).toContainText('1d10')
  await expect(effect).toContainText('Force')

  await page.getByRole('tab', { name: 'Actions' }).click()
  const row = page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: 'Eldritch Blast breakdown', exact: true }) })
  await expect(row).toContainText('1d10')
})

test('F-32a b: Paladin 3 Oath of Conquest — one Features row "Channel Divinity", with its boxes', async ({ page }) => {
  await open(page, seeded('f32a-b', 'Paladin', 'Oath of Conquest', 3, { classSkills: ['athletics', 'persuasion'], spellChoices: [] }))
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const paladin = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Paladin Features', exact: true })
  const rows = paladin.locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: /^Channel Divinity$/ }) })
  await expect(rows).toHaveCount(1)
  await expect(rows.getByRole('group', { name: 'Channel Divinity uses', exact: true }).getByRole('button')).toHaveCount(2)
})

test('F-32a c: Druid 2 without a familiar — Manage Extras opens on Wild Shape', async ({ page }) => {
  await open(page, seeded('f32a-c', 'Druid', null, 2, { classSkills: ['arcana', 'nature'], spellChoices: [] }))
  await page.getByRole('tab', { name: 'Extras' }).click()
  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  const select = page.getByRole('dialog', { name: 'Manage Extras' }).getByRole('combobox', { name: 'Category' })
  await expect(select.locator('option')).toHaveText(['Familiar', 'Wild Shape'])
  await expect(select).toHaveValue('wildShape')
})

/** How many lines the word occupies inside the row header — 1 when it is not broken. */
const wordLines = (header: Locator, word: string): Promise<number> =>
  header.evaluate((element, target) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = (node.textContent ?? '').toLowerCase().indexOf(target)
      if (index === -1) continue
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + target.length)
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
    }
    return -1
  }, word)

test('F-32a d: at 390 px the BACKGROUND and MODIFIER row headers each stay on one line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fillUpToBackground(page, { name: 'Phone', level: 1, species: 'Dwarf|XPHB' })
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  const table = page.locator('.ability-table')
  expect(await wordLines(table.getByRole('rowheader', { name: /background/i }), 'background')).toBe(1)
  expect(await wordLines(table.getByRole('rowheader', { name: /modifier/i }), 'modifier')).toBe(1)
})
