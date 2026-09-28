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
  await expect(cells.nth(1)).toHaveText(/^\d+$/) // average hit points
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
