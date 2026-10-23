import { expect, test, type Locator, type Page } from '@playwright/test'

/* C-1 (D380). Seeded at schema 63. Pseudodragon: a Piercing bite and a {@actSave con} {@dc 12} sting (DATA.md). */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const PACT = { name: 'Pact of the Chain', source: XPHB, level: 1 }
const INVESTMENT = { name: 'Investment of the Chain Master', source: XPHB, level: 5 }

function warlock(id: string, invocations: object[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 63,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 6 }],
    levelOrder: Array.from({ length: 6 }, () => ({ className: 'Warlock', classSource: XPHB })),
    createdAtLevel: 6,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys']) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: invocations }],
    familiar: { name: 'Pseudodragon', source: 'XMM' },
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
  await page.getByRole('tab', { name: 'Extras' }).click()
}

const tab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Extras' })
const familiarRow = (page: Page): Locator => tab(page).locator('.extras-tab__item').first()
const formSwitch = (page: Page): Locator => familiarRow(page).getByRole('group', { name: 'Familiar form' })
const damageSwitch = (page: Page): Locator => familiarRow(page).getByRole('group', { name: 'Familiar damage type' })

async function statBlock(page: Page): Promise<Locator> {
  await familiarRow(page).getByRole('button', { name: 'Pseudodragon', exact: true }).click()
  return page.getByRole('dialog', { name: 'Pseudodragon', exact: true })
}

async function reopen(page: Page): Promise<void> {
  await page.reload()
  await page.getByRole('tab', { name: 'Extras' }).click()
}

test('C-1 1: Aquatic adds Swim 40 ft. and survives a reload', async ({ page }) => {
  await open(page, warlock('c1-1', [PACT, INVESTMENT]))
  await expect(familiarRow(page)).toContainText('Choose Aerial or Aquatic')
  await expect(familiarRow(page).locator('.extras-tab__cell').nth(2)).not.toContainText('swim')
  await formSwitch(page).getByRole('button', { name: /Aquatic/ }).click()
  await expect(familiarRow(page).locator('.extras-tab__cell').nth(2)).toContainText('swim 40 ft')
  await expect(familiarRow(page)).not.toContainText('Choose Aerial or Aquatic')
  await reopen(page)
  await expect(formSwitch(page).getByRole('button', { name: /Aquatic/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(familiarRow(page).locator('.extras-tab__cell').nth(2)).toContainText('swim 40 ft')
})

test('C-1 2: Radiant replaces the bite\'s Piercing, survives a reload, Original brings it back', async ({ page }) => {
  await open(page, warlock('c1-2', [PACT, INVESTMENT]))
  await damageSwitch(page).getByRole('button', { name: 'Radiant' }).click()
  let dialog = await statBlock(page)
  await expect(dialog).toContainText('Radiant damage')
  await expect(dialog).not.toContainText('Piercing damage')
  await page.keyboard.press('Escape')

  await reopen(page)
  await expect(damageSwitch(page).getByRole('button', { name: 'Radiant' })).toHaveAttribute('aria-pressed', 'true')
  dialog = await statBlock(page)
  await expect(dialog).toContainText('Radiant damage')
  await page.keyboard.press('Escape')

  await damageSwitch(page).getByRole('button', { name: 'Original' }).click()
  dialog = await statBlock(page)
  await expect(dialog).toContainText('Piercing damage')
  await expect(dialog).not.toContainText('Radiant damage')
})

test('C-1 3: the familiar\'s save DC is the Warlock\'s spell save DC', async ({ page }) => {
  await open(page, warlock('c1-3', [PACT, INVESTMENT]))
  await page.getByRole('tab', { name: 'Spells' }).click()
  const dc = (await page.getByRole('button', { name: 'Warlock save DC breakdown' }).innerText()).trim()
  expect(dc).toBe('14')
  await page.getByRole('tab', { name: 'Extras' }).click()
  const dialog = await statBlock(page)
  await expect(dialog).toContainText(`DC ${dc}`)
  await expect(dialog).not.toContainText('DC 12')
})

test('C-1 4a: the invocation from a custom item alone shows the switches', async ({ page }) => {
  const chain = { name: 'Chain Charm', source: 'custom', quantity: 1, custom: { name: 'Chain Charm', kind: 'other', invocations: [{ name: INVESTMENT.name, source: XPHB }] } }
  await open(page, warlock('c1-4a', [PACT], { inventory: [chain] }))
  await expect(formSwitch(page)).toBeVisible()
  await expect(damageSwitch(page)).toBeVisible()
  await expect(familiarRow(page)).toContainText('Quick Attack')
})

test('C-1 4b: without the invocation the stored choices sleep — no switches, no Quick Attack, data unchanged', async ({ page }) => {
  await open(page, warlock('c1-4b', [PACT], { familiar: { name: 'Pseudodragon', source: 'XMM', chainMasterForm: 'aquatic', chainMasterDamage: 'radiant' } }))
  await expect(familiarRow(page)).toBeVisible()
  await expect(formSwitch(page)).toHaveCount(0)
  await expect(damageSwitch(page)).toHaveCount(0)
  await expect(familiarRow(page)).not.toContainText('Quick Attack')
  await expect(familiarRow(page).locator('.extras-tab__cell').nth(2)).not.toContainText('swim')
  const dialog = await statBlock(page)
  await expect(dialog).toContainText('Piercing damage')
  await expect(dialog).toContainText('DC 12')
})

test('C-1 5: a custom item with Familiar AC +1 still raises the AC while the invocation is active', async ({ page }) => {
  const charm = { name: 'Familiar Charm', source: 'custom', quantity: 1, custom: { name: 'Familiar Charm', kind: 'other', bonuses: [{ target: 'familiarArmourClass', amount: 1 }] } }
  await open(page, warlock('c1-5', [PACT, INVESTMENT], { inventory: [charm], familiar: { name: 'Pseudodragon', source: 'XMM', chainMasterDamage: 'radiant' } }))
  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  const manage = page.getByRole('dialog', { name: 'Manage Extras' })
  await manage.getByRole('button', { name: 'Pseudodragon stat block' }).first().click()
  const base = Number(/AC (\d+)/.exec(await manage.locator('.beast__vitals').first().innerText())?.[1])
  await page.keyboard.press('Escape')

  await expect(familiarRow(page).locator('.extras-tab__cell').nth(0)).toHaveText(String(base + 1))
  const dialog = await statBlock(page)
  await expect(dialog.locator('.beast__vitals')).toContainText(`AC ${base + 1}`)
  await expect(dialog).toContainText('Radiant damage')
})
