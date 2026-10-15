import { expect, test, type Page } from '@playwright/test'
import { fillUpToBackground, expectStep, next } from './wizard.ts'

/* F-31a: display text from the screenshot review. */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }],
    levelOrder: [{ className: 'Fighter', classSource: 'XPHB' }],
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Human', source: 'XPHB' },
    background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['athletics', 'perception'],
    fightingStyle: 'Defense',
    ...extra,
  }
}

async function seed(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
}

test('F-31 a: the Acolyte Magic Initiate shows as "Magic Initiate (Cleric)" on the Features tab', async ({ page }) => {
  await seed(
    page,
    fighter('f31-a', 1, {
      grantedFeats: [
        {
          origin: 'background',
          name: 'Magic Initiate; Cleric',
          source: 'XPHB',
          chosenAbility: 'wisdom',
          magicInitiate: {
            className: 'Cleric',
            classSource: 'XPHB',
            cantrips: [
              { name: 'Guidance', source: 'XPHB' },
              { name: 'Sacred Flame', source: 'XPHB' },
            ],
            spell: { name: 'Bless', source: 'XPHB' },
          },
        },
      ],
    }),
  )
  await page.goto('/#/character/f31-a')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const panel = page.getByRole('tabpanel', { name: 'Features & Traits' })
  await expect(panel.getByText('Magic Initiate (Cleric)').first()).toBeVisible()
  await expect(panel.getByText('Magic Initiate;')).toHaveCount(0)
})

test('F-31 d: Manage Feats > Add Feats names the Paladin and Ranger Fighting Style chips and the Dragonmark chip', async ({ page }) => {
  await seed(page, fighter('f31-d', 4))
  await page.goto('/#/character/f31-d')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const pills = page.getByRole('dialog', { name: 'Manage Feats' }).getByRole('region', { name: 'Add Feats' }).getByRole('group', { name: 'Filter by category' })
  await expect(pills.getByRole('button', { name: 'Fighting Style (Paladin)', exact: true })).toBeVisible()
  await expect(pills.getByRole('button', { name: 'Fighting Style (Ranger)', exact: true })).toBeVisible()
  await expect(pills.getByRole('button', { name: 'Dragonmark', exact: true })).toBeVisible()
  await expect(pills.getByRole('button', { name: 'FS:P', exact: true })).toHaveCount(0)
})

test('F-31 e: at 390 px the BACKGROUND label ends left of the first cell in the ability table', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fillUpToBackground(page, { name: 'Phone', level: 1, species: 'Dwarf|XPHB' })
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  const row = page.locator('.ability-table tr').filter({ has: page.getByRole('rowheader', { name: /background/i }) })
  const cell = await row.locator('td').first().boundingBox()
  // Table cells always share an edge, so the label's own text is what must clear the first cell.
  const text = await row.getByRole('rowheader').evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().right
  })
  expect(cell!.x - text).toBeGreaterThanOrEqual(2)
})
