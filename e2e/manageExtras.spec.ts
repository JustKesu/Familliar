import { expect, test, type Locator, type Page } from '@playwright/test'

/* R11a. Characters seeded into storage before the app loads, as in manageInventory.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 } }
const FIND_FAMILIAR = { name: 'Find Familiar', source: 'XPHB' }

function character(id: string, className: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 50,
    id,
    name: `${className} ${id}`,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    abilityScores: ABILITIES,
    ...extra,
  }
}

const withFindFamiliar = (className: string) => ({ spellChoices: [{ className, classSource: 'XPHB', spells: [FIND_FAMILIAR] }] })

async function openExtras(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
  await page.getByRole('tab', { name: 'Extras' }).click()
}

async function openManage(page: Page, subject: { id: string }): Promise<Locator> {
  await openExtras(page, subject)
  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  return drawer(page)
}

const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Manage Extras' })
const tab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Extras' })
const tabRows = (page: Page): Locator => tab(page).locator('.extras-tab__item')
const tabRow = (page: Page, name: string): Locator => tabRows(page).filter({ has: page.getByRole('button', { name, exact: true }) })
const addSection = (panel: Locator): Locator => panel.getByRole('region', { name: 'Add an Extra' })
const currentSection = (panel: Locator): Locator => panel.getByRole('region', { name: 'Current Extras' })
const search = (panel: Locator, text: string): Promise<void> => addSection(panel).getByRole('searchbox', { name: 'Search creatures' }).fill(text)
const category = (panel: Locator, label: string): Promise<string[]> => panel.getByRole('combobox', { name: 'Category' }).selectOption({ label })

test('R11a a: a character with neither category sees "No extras yet." and no MANAGE EXTRAS button', async ({ page }) => {
  await openExtras(page, character('r11a-a', 'Fighter', 3))
  await expect(tab(page)).toContainText('No extras yet.')
  await expect(page.getByRole('button', { name: 'Manage Extras' })).toHaveCount(0)
  await expect(tabRows(page)).toHaveCount(0)
})

test('R11a b: familiar ADD, REPLACE, DELETE, and it survives a reload', async ({ page }) => {
  const panel = await openManage(page, character('r11a-b', 'Wizard', 3, withFindFamiliar('Wizard')))
  await search(panel, 'Owl')
  await addSection(panel).getByRole('button', { name: 'Add Owl', exact: true }).click()

  const owl = tabRow(page, 'Owl')
  await expect(owl).toHaveCount(1)
  const cells = owl.locator('.extras-tab__cell')
  await expect(cells.nth(0)).toHaveText(/^\d+$/) // AC
  await expect(cells.nth(1)).toHaveText(/^\d+ \/ \d+$/) // current / average hit points (D213)
  await expect(cells.nth(2)).toContainText('ft.')

  await search(panel, 'Cat')
  await expect(addSection(panel).getByRole('button', { name: 'Replace Cat', exact: true })).toBeVisible()
  await addSection(panel).getByRole('button', { name: 'Replace Cat', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(1)
  await expect(tabRow(page, 'Cat')).toHaveCount(1)
  await expect(tabRow(page, 'Owl')).toHaveCount(0)
  await expect(addSection(panel).getByText('Current')).toBeVisible()

  await page.reload()
  await page.getByRole('tab', { name: 'Extras' }).click()
  await expect(tabRow(page, 'Cat')).toHaveCount(1)

  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  await currentSection(drawer(page)).getByRole('button', { name: 'Delete Cat', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(0)
  await expect(tab(page)).toContainText('No extras yet.')
})

test('R11a c: Wild Shape counter, FULL, disabled ADD, DELETE, "Uses your HP" and the pills', async ({ page }) => {
  const panel = await openManage(page, character('r11a-c', 'Druid', 2, { ...withFindFamiliar('Druid'), familiar: { name: 'Owl', source: 'XMM' } }))
  await category(panel, 'Wild Shape')
  const add = addSection(panel)
  const counter = add.locator('.manage-spells__counter')
  await expect(counter).toHaveText('Known forms: 0 / 4')
  await expect(add).toContainText('Maximum Challenge Rating 1/4')

  const addButtons = add.getByRole('button', { name: /^Add / })
  for (let known = 1; known <= 4; known++) {
    await addButtons.first().click()
    await expect(counter).toHaveText(`Known forms: ${known} / 4`)
  }
  await expect(add.locator('.manage-spells__counter--full')).toHaveCount(1)
  expect(await addButtons.count()).toBeGreaterThan(0)
  for (const button of await addButtons.all()) await expect(button).toBeDisabled()

  await currentSection(panel).getByRole('button', { name: /^Delete / }).last().click()
  await expect(counter).toHaveText('Known forms: 3 / 4')
  await expect(add.locator('.manage-spells__counter--full')).toHaveCount(0)
  await expect(addButtons.first()).toBeEnabled()

  await expect(tabRows(page)).toHaveCount(4) // the familiar and three forms
  await expect(tab(page).getByText('Uses your HP')).toHaveCount(3)
  await tab(page).getByRole('button', { name: 'Familiar', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(1)
  await tab(page).getByRole('button', { name: 'Wild Shape', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(3)
  await tab(page).getByRole('button', { name: 'All', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(4)
})

test('R11a d: Pact of the Chain forms are labelled in the panel and named in the tab Notes', async ({ page }) => {
  const subject = character('r11a-d', 'Warlock', 3, {
    ...withFindFamiliar('Warlock'),
    optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain' }] }],
  })
  const panel = await openManage(page, subject)
  await search(panel, 'Imp')
  const imp = addSection(panel).getByRole('button', { name: 'Add Imp', exact: true }).locator('xpath=ancestor::li[1]')
  await expect(imp).toContainText('Pact of the Chain')
  await addSection(panel).getByRole('button', { name: 'Add Imp', exact: true }).click()
  await expect(tabRow(page, 'Imp').locator('.extras-tab__notes')).toContainText('Pact of the Chain')
})

test('R11a e: a creature\'s name opens its stat block in a drawer, and Esc closes it', async ({ page }) => {
  await openExtras(page, character('r11a-e', 'Wizard', 3, { ...withFindFamiliar('Wizard'), familiar: { name: 'Owl', source: 'XMM' } }))
  await tab(page).getByRole('button', { name: 'Owl', exact: true }).click()
  const stat = page.getByRole('dialog', { name: 'Owl' })
  await expect(stat.getByRole('heading', { name: 'Actions' })).toBeVisible()
  await expect(stat.getByText('Initiative')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(stat).toHaveCount(0)
})

test('R11a f: Features & Traits shows neither a Familiar nor a Wild Shape forms section', async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    {
      key: STORAGE_KEY,
      payload: JSON.stringify([
        character('r11a-f', 'Druid', 2, {
          ...withFindFamiliar('Druid'),
          familiar: { name: 'Owl', source: 'XMM' },
          wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Badger', source: 'XMM' }] }],
        }),
      ]),
    },
  )
  await page.goto('/#/character/r11a-f')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  await expect(features.getByRole('heading', { name: 'Familiar', exact: true })).toHaveCount(0)
  await expect(features.getByRole('heading', { name: 'Wild Shape forms' })).toHaveCount(0)
  await expect(features.locator('.beast')).toHaveCount(0)
})

/* R11b (D213): the familiar's own hit points. Imp is a Pact of the Chain form; its maximum is read from the app, never hardcoded. */
const chainWarlock = (id: string, extra: Record<string, unknown> = {}) =>
  character(id, 'Warlock', 3, {
    ...withFindFamiliar('Warlock'),
    optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain' }] }],
    familiar: { name: 'Imp', source: 'XMM' },
    ...extra,
  })

const hpButton = (page: Page, name = 'Imp'): Locator => tab(page).getByRole('button', { name: `${name} hit points` })
const hpDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Imp — Hit Points' })

async function tabHp(page: Page, name = 'Imp'): Promise<{ current: number; max: number }> {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(await hpButton(page, name).innerText())
  if (!match) throw new Error('familiar HP cell has no "current / max"')
  return { current: Number(match[1]), max: Number(match[2]) }
}

async function openHp(page: Page, subject: { id: string }): Promise<{ max: number; panel: Locator }> {
  await openExtras(page, subject)
  const { max } = await tabHp(page)
  await hpButton(page).click()
  return { max, panel: hpDrawer(page) }
}

async function apply(panel: Locator, button: 'Heal' | 'Damage' | 'Temp', amount: number): Promise<void> {
  await panel.getByRole('spinbutton', { name: 'Amount' }).fill(String(amount))
  await panel.getByRole('button', { name: button, exact: true }).click()
}

const shown = (page: Page, panel: Locator, current: number, max: number) =>
  Promise.all([expect(panel.locator('.familiar-hp__value')).toHaveText(`${current} / ${max}`), expect(hpButton(page)).toHaveText(`${current} / ${max}`)])

test('R11b a: the row starts at max / max, opens its drawer, and Damage / Heal move both — healing stops at max', async ({ page }) => {
  const { max, panel } = await openHp(page, chainWarlock('r11b-a'))
  expect(max).toBeGreaterThan(10)
  await expect(panel).toBeVisible()
  await shown(page, panel, max, max)

  await apply(panel, 'Damage', 5)
  await shown(page, panel, max - 5, max)
  await apply(panel, 'Heal', 3)
  await shown(page, panel, max - 2, max)
  await apply(panel, 'Heal', 100)
  await shown(page, panel, max, max)
})

test('R11b b: temp HP is spent before current HP, and "+N temp" shows in the tab only while it exists', async ({ page }) => {
  const { max, panel } = await openHp(page, chainWarlock('r11b-b'))
  await apply(panel, 'Temp', 4)
  await expect(panel.locator('.familiar-hp__temp')).toHaveText('4')
  await expect(tab(page).locator('.extras-tab__temp')).toHaveText('+4 temp')

  await apply(panel, 'Damage', 6)
  await shown(page, panel, max - 2, max)
  await expect(panel.locator('.familiar-hp__temp')).toHaveText('—')
  await expect(tab(page).locator('.extras-tab__temp')).toHaveCount(0)
})

test('R11b c: at 0 HP the drawer says the familiar disappears, and RESUMMON restores full HP and clears temp', async ({ page }) => {
  const { max, panel } = await openHp(page, chainWarlock('r11b-c'))
  await expect(panel).not.toContainText('disappears')
  await apply(panel, 'Temp', 4)
  await apply(panel, 'Damage', max + 4)
  await shown(page, panel, 0, max)
  await expect(panel).toContainText('At 0 HP the familiar disappears. Resummon it when you cast Find Familiar again.')
  await expect(panel).toContainText('Restores full HP — use when you cast Find Familiar again.')
  await expect(tabRows(page)).toHaveCount(1) // the app never deletes it by itself

  await panel.getByRole('button', { name: 'Resummon', exact: true }).click()
  await shown(page, panel, max, max)
  await expect(panel.locator('.familiar-hp__temp')).toHaveText('—')
  await expect(panel).not.toContainText('disappears')
})

test('R11b d: a Short Rest changes nothing, a Long Rest restores full HP and clears temp', async ({ page }) => {
  const { max, panel } = await openHp(page, chainWarlock('r11b-d'))
  await apply(panel, 'Damage', 5)
  await apply(panel, 'Temp', 3)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(hpButton(page)).toHaveText(`${max - 5} / ${max}`)
  await expect(tab(page).locator('.extras-tab__temp')).toHaveText('+3 temp')

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(hpButton(page)).toHaveText(`${max} / ${max}`)
  await expect(tab(page).locator('.extras-tab__temp')).toHaveCount(0)
})

test('R11b e: REPLACE with another form starts that form at its full HP', async ({ page }) => {
  const { panel } = await openHp(page, chainWarlock('r11b-e'))
  await apply(panel, 'Damage', 5)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  const manage = drawer(page)
  await search(manage, 'Cat')
  await addSection(manage).getByRole('button', { name: 'Replace Cat', exact: true }).click()

  await expect(hpButton(page, 'Cat')).toBeVisible()
  const { current, max } = await tabHp(page, 'Cat')
  expect(current).toBe(max)
  await expect(tab(page).locator('.extras-tab__temp')).toHaveCount(0)
})

test('R11b f: current and temp HP survive a reload', async ({ page }) => {
  const { max, panel } = await openHp(page, chainWarlock('r11b-f'))
  await apply(panel, 'Damage', 5)
  await apply(panel, 'Temp', 4)

  await page.reload()
  await page.getByRole('tab', { name: 'Extras' }).click()
  await expect(hpButton(page)).toHaveText(`${max - 5} / ${max}`)
  await expect(tab(page).locator('.extras-tab__temp')).toHaveText('+4 temp')
})

test('R11b g: a stored familiar without Find Familiar keeps MANAGE EXTRAS, which shows only Current Extras and can DELETE it', async ({ page }) => {
  const panel = await openManage(page, character('r11b-g', 'Fighter', 3, { familiar: { name: 'Owl', source: 'XMM' } }))
  await expect(currentSection(panel)).toContainText('Owl')
  await expect(addSection(panel)).toHaveCount(0)
  await currentSection(panel).getByRole('button', { name: 'Delete Owl', exact: true }).click()
  await expect(tabRows(page)).toHaveCount(0)
  await expect(tab(page)).toContainText('No extras yet.')
})
