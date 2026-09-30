import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectStep, fillUpToBackground, next, select, wizardNav } from './wizard.js'

/*
 * R9c (D210). The wizard's Spells step renders the Manage Spells class section;
 * Next still needs the exact counts. Fighter → Eldritch Knight 3 is the one
 * caster wizard.ts can reach (Wizard list, 1st-level cap, counts from the class table).
 */
const prepared = (page: Page): Locator => page.getByRole('region', { name: 'Prepared Spells' })
const addSpells = (page: Page): Locator => page.getByRole('region', { name: 'Add Spells' })
const counter = (page: Page, label: 'Cantrips' | 'Prepared'): Locator => page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })

async function counts(page: Page, label: 'Cantrips' | 'Prepared'): Promise<{ have: number; max: number }> {
  const [, have, max] = (await counter(page, label).innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
  return { have: have!, max: max! }
}

/** Adds the first offered spell of one kind and returns its name. */
async function addFirst(page: Page, button: RegExp): Promise<string> {
  const target = addSpells(page).getByRole('button', { name: button }).first()
  const name = ((await target.getAttribute('aria-label')) ?? '').replace(button, '').trim()
  await target.click()
  return name
}

test('R9c: Eldritch Knight 3 — the Spells step uses the class section, Next needs both counters full, and the picks reach the sheet', async ({ page }) => {
  const options = { name: 'Wizard Spells Knight', level: 3, species: 'Dwarf|XPHB', subclass: 'Eldritch Knight' }
  await fillUpToBackground(page, options)
  await next(page)
  await expectStep(page, 'Languages')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  const scores: [string, string][] = [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]
  for (const [ability, score] of scores) await select(page, ability).selectOption({ label: score })
  await next(page)
  await expectStep(page, 'Spells')
  const nextButton = wizardNav(page).getByRole('button', { name: 'Next', exact: true })

  await test.step('a: class section, both subsections, real counters, no "Always prepared from" list', async () => {
    await expect(prepared(page)).toBeVisible()
    await expect(addSpells(page)).toBeVisible()
    await expect(counter(page, 'Cantrips')).toHaveText(/^Cantrips: 0\/\d+$/)
    await expect(counter(page, 'Prepared')).toHaveText(/^Prepared: 0\/\d+$/)
    await expect(page.getByText(/Always prepared from/)).toHaveCount(0)
    await expect(nextButton).toBeDisabled()
  })

  const cantrips = (await counts(page, 'Cantrips')).max
  const leveled = (await counts(page, 'Prepared')).max

  await test.step('e: level pills and search narrow the offered list', async () => {
    const pills = addSpells(page).getByRole('group', { name: 'Filter by level' })
    await pills.getByRole('button', { name: '1st', exact: true }).click()
    await expect(addSpells(page).locator('.manage-spells__level')).toHaveText(['1st Level'])
    await pills.getByRole('button', { name: '1st', exact: true }).click()
    await expect(addSpells(page).locator('.manage-spells__level')).toHaveText(['Cantrips', '1st Level'])
    await addSpells(page).getByRole('searchbox', { name: 'Search Fighter spells' }).fill('magic missile')
    await expect(addSpells(page).locator('.manage-spells__name')).toHaveText(['Magic Missile'])
    await addSpells(page).getByRole('searchbox', { name: 'Search Fighter spells' }).fill('')
  })

  const picked: string[] = []
  await test.step('b+c: Add/Prepare fill the counters, Next stays blocked until both are full, full counters disable the rest', async () => {
    for (let i = 0; i < cantrips; i++) picked.push(await addFirst(page, /^Add /))
    await expect(counter(page, 'Cantrips')).toHaveText(`Cantrips: ${cantrips}/${cantrips}`)
    await expect(nextButton).toBeDisabled()
    for (const button of await addSpells(page).getByRole('button', { name: /^Add / }).all()) await expect(button).toBeDisabled()

    for (let i = 0; i < leveled - 1; i++) picked.push(await addFirst(page, /^Prepare /))
    await expect(nextButton).toBeDisabled()
    picked.push(await addFirst(page, /^Prepare /))
    await expect(counter(page, 'Prepared')).toHaveText(`Prepared: ${leveled}/${leveled}`)
    await expect(nextButton).toBeEnabled()
    for (const button of await addSpells(page).getByRole('button', { name: /^Prepare / }).all()) await expect(button).toBeDisabled()

    // Unprepare / Delete in Prepared Spells frees a slot and blocks Next again.
    const last = picked[picked.length - 1]!
    await prepared(page).getByRole('button', { name: `Unprepare ${last}`, exact: true }).click()
    await expect(counter(page, 'Prepared')).toHaveText(`Prepared: ${leveled - 1}/${leveled}`)
    await expect(nextButton).toBeDisabled()
    await addSpells(page).getByRole('button', { name: `Prepare ${last}`, exact: true }).click()
    await expect(nextButton).toBeEnabled()

    const firstCantrip = picked[0]!
    await prepared(page).getByRole('button', { name: `Delete ${firstCantrip}`, exact: true }).click()
    await expect(counter(page, 'Cantrips')).toHaveText(`Cantrips: ${cantrips - 1}/${cantrips}`)
    await expect(nextButton).toBeDisabled()
    await addSpells(page).getByRole('button', { name: `Add ${firstCantrip}`, exact: true }).click()
    await expect(nextButton).toBeEnabled()
  })

  await test.step('d: the picks are on the sheet and in the drawer', async () => {
    await next(page)
    await expectStep(page, 'Hit points')
    await page.getByRole('button', { name: /Use the average/ }).click()
    await next(page)
    await expectStep(page, 'Starting equipment')
    await page.getByRole('group', { name: /From your class/ }).getByRole('radio').last().check()
    await page.getByRole('group', { name: /From your background/ }).getByRole('radio').last().check()
    await next(page)
    await expectStep(page, 'Review and save')
    await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
    await expect(page).toHaveURL(/#\/character\/[^/]+$/)

    await page.getByRole('tab', { name: 'Spells' }).click()
    const tab = page.getByRole('tabpanel', { name: 'Spells' })
    for (const name of picked) await expect(tab.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
    for (const name of picked) await expect(drawer.getByRole('region', { name: 'Prepared Spells' }).locator('.manage-spells__name', { hasText: new RegExp(`^${name}$`) })).toHaveCount(1)
  })
})
